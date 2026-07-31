// POST /api/v1/drills/bulk-create-assign - Create and assign multiple drills at once
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withRole } from "@/lib/api/middleware";
import { connectToDatabase } from "@/lib/api/db";
import { logger } from "@/lib/api/logger";
import Drill from "@/models/drill";
import DrillAssignment from "@/models/drill-assignment";
import User from "@/models/user";
import { isValidUserId, toUserIdQuery } from "@/lib/api/user-id";
import {
  learningJourneyPartSchema,
  learningJourneyTopicSchema,
  refineLearningJourneyFields,
} from "@/domain/learning-journey/learning-journey.validation";
import { parseLearningJourneyPartId } from "@/domain/learning-journey/learning-journey.catalog";
import { assertLearnersEnrolledForDrill } from "@/domain/learning-journey/mission-enrollment.service";
import { notifyLearnersOfAssignment } from "@/domain/drills/drill.service";
import { parseDrillCompletionDateInput } from "@/lib/drill-completion-date";
import { getAssignedAtForWeek } from "@/lib/ai-drill-builder/week-utils";

interface BulkDrillInput {
  drillType: string;
  title?: string;
  content: Record<string, any>;
  studentId: string;
  completionDate: string;
  difficulty: string;
  // Left untyped on purpose — arbitrary request-body JSON, validated below via
  // journeyFieldsSchema before ever being written to a Drill document.
  topic?: unknown;
  part?: unknown;
  mission?: unknown;
  /** Drill-builder week context — places assignedAt in that week when set. */
  weekNumber?: number;
}

// Builds a map from character name to its normalized speaker key
function buildSpeakerKeyMap(
  studentCharacterName: string,
  aiCharacterNames: string[]
): Record<string, string> {
  const map: Record<string, string> = { [studentCharacterName]: "student" };
  aiCharacterNames.forEach((name, index) => {
    map[name] = `ai_${index}`;
  });
  return map;
}

// Replaces each dialogue turn's speaker with its normalized key (student/ai_0/ai_1/...)
function normalizeRoleplayScenes(
  scenes: any[],
  studentCharacterName: string,
  aiCharacterNames: string[]
): any[] {
  const speakerKeyMap = buildSpeakerKeyMap(studentCharacterName, aiCharacterNames);

  return scenes.map((scene) => ({
    ...scene,
    dialogue: (scene.dialogue ?? []).map((turn: any) => {
      const normalizedSpeaker = speakerKeyMap[turn.speaker];
      if (normalizedSpeaker === undefined) {
        logger.warn("Roleplay dialogue speaker not found in character map", {
          speaker: turn.speaker,
          studentCharacterName,
          aiCharacterNames,
        });
        return turn;
      }
      return { ...turn, speaker: normalizedSpeaker };
    }),
  }));
}

// Mirrors the validation the manual create route (`/api/v1/drills`) applies to
// `learning_journey_part`/`learning_journey_topic`, so bulk-created drills can never
// silently persist with a mismatched or non-canonical mission/topic (e.g. display
// labels like "Mission 1: ..." instead of the raw numeric id / topic slug).
const journeyFieldsSchema = z
  .object({
    learning_journey_part: learningJourneyPartSchema.optional(),
    learning_journey_topic: learningJourneyTopicSchema.optional(),
  })
  .superRefine((data, ctx) => {
    refineLearningJourneyFields(data, ctx, { requireAlways: true });
  });

// Maps the AI-generated/provided content object onto the type-specific Drill schema fields
function mapContentFields(
  drillType: string,
  content: Record<string, any>,
  studentCharacterNameOverride?: string
): Record<string, any> {
  switch (drillType) {
    case "vocabulary":
      return { target_sentences: content.target_sentences ?? [] };
    case "pronunciation":
      return { pronunciation_items: content.pronunciation_items ?? [] };
    case "roleplay": {
      const originalStudentCharacterName = content.student_character_name ?? "Student";
      const displayStudentCharacterName =
        studentCharacterNameOverride ?? originalStudentCharacterName;
      const aiCharacterNames = content.ai_character_names ?? [];
      const storedVoices = Array.isArray(content.ai_character_voice_keys)
        ? content.ai_character_voice_keys
        : [];
      return {
        roleplay_scenes: normalizeRoleplayScenes(
          content.roleplay_scenes ?? [],
          originalStudentCharacterName,
          aiCharacterNames
        ),
        student_character_name: displayStudentCharacterName,
        ai_character_names: aiCharacterNames,
        ai_character_voice_keys: aiCharacterNames.map(
          (_: string, i: number) => storedVoices[i] ?? ""
        ),
        drill_intro: content.drill_intro ?? "",
      };
    }
    case "matching":
      return { matching_pairs: content.matching_pairs ?? [] };
    case "definition":
      return { definition_items: content.definition_items ?? [] };
    case "grammar":
      return { grammar_items: content.grammar_items ?? [] };
    case "sentence_writing":
      return { sentence_writing_items: content.sentence_writing_items ?? [] };
    case "fill_blank":
      return { fill_blank_items: content.fill_blank_items ?? [] };
    case "key_phrases":
      return { key_phrase_items: content.key_phrase_items ?? [] };
    case "summary":
      return {
        article_title: content.article_title ?? "",
        article_content: content.article_content ?? "",
      };
    default:
      return {};
  }
}

async function handler(
  req: NextRequest,
  context: { userId: string; userRole: string }
): Promise<NextResponse> {
  try {
    const body = await req.json();
    const drills: BulkDrillInput[] = body?.drills;

    if (!Array.isArray(drills) || drills.length === 0) {
      return NextResponse.json(
        { code: "ValidationError", message: "drills (non-empty array) is required" },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const creator = await User.findById(context.userId).lean();
    if (!creator) {
      return NextResponse.json(
        { code: "ValidationError", message: "Creator user not found" },
        { status: 400 }
      );
    }

    const results = await Promise.all(
      drills.map(async (item) => {
        try {
          const {
            drillType,
            title,
            content,
            studentId,
            completionDate,
            difficulty,
            topic,
            part,
            mission,
            weekNumber,
          } = item;
          const rawPart = part ?? mission;
          const extractedPart = typeof rawPart === 'string' ? rawPart.match(/\d+/)?.[0] : rawPart;

          if (!drillType || !content || !studentId || !completionDate || !difficulty) {
            throw new Error(
              "Each drill requires drillType, content, studentId, completionDate, and difficulty"
            );
          }

          if (!isValidUserId(studentId)) {
            throw new Error(`Invalid studentId: ${studentId}`);
          }

          let dueDate: Date;
          try {
            dueDate = parseDrillCompletionDateInput(completionDate);
          } catch {
            throw new Error(`Invalid completionDate: ${completionDate}`);
          }

          const parsedPart = parseLearningJourneyPartId(extractedPart);

          const journeyValidation = journeyFieldsSchema.safeParse({
            learning_journey_part: parsedPart,
            learning_journey_topic: topic,
          });
          if (!journeyValidation.success) {
            throw new Error(
              journeyValidation.error.issues.map((issue) => issue.message).join("; ")
            );
          }
          const {
            learning_journey_part: validatedPart,
            learning_journey_topic: validatedTopic,
          } = journeyValidation.data;

          if (validatedPart != null) {
            await assertLearnersEnrolledForDrill({
              learnerIds: [studentId],
              part: validatedPart,
            });
          }

          const student = await User.findById(studentId)
            .select("firstName subscriptionActivatedAt createdAt")
            .lean();

          let studentCharacterNameOverride: string | undefined;
          if (drillType === "roleplay") {
            if (student && (student as any).firstName) {
              studentCharacterNameOverride = `Nurse ${(student as any).firstName}`;
            }
          }

          const drillData: any = {
            title: title ?? "",
            type: drillType,
            difficulty,
            date: dueDate,
            duration_days: 1,
            assigned_to: [studentId],
            context: content.context ?? "",
            is_active: true,
            created_by: (creator as any).email,
            createdById: toUserIdQuery(context.userId),
            totalAssignments: 0,
            totalCompletions: 0,
            averageScore: 0,
            averageCompletionTime: 0,
            ...mapContentFields(drillType, content, studentCharacterNameOverride),
          };

          if (validatedPart !== undefined) drillData.learning_journey_part = validatedPart;
          if (validatedTopic !== undefined) drillData.learning_journey_topic = validatedTopic;

          const drill = await Drill.create(drillData);

          const parsedWeek =
            typeof weekNumber === "number" &&
            Number.isFinite(weekNumber) &&
            weekNumber >= 1
              ? Math.floor(weekNumber)
              : undefined;
          const assignedAt =
            parsedWeek != null && student
              ? getAssignedAtForWeek(
                  parsedWeek,
                  (student as { subscriptionActivatedAt?: Date | null })
                    .subscriptionActivatedAt,
                  (student as { createdAt?: Date }).createdAt,
                )
              : new Date();

          const assignment = await DrillAssignment.create({
            drillId: drill._id,
            learnerId: toUserIdQuery(studentId),
            assignedBy: toUserIdQuery(context.userId),
            assignedAt,
            ...(parsedWeek != null ? { builderWeekNumber: parsedWeek } : {}),
            dueDate,
            status: "pending",
          });

          notifyLearnersOfAssignment(
            [
              {
                learnerId: studentId,
                _id: String(assignment._id),
                dueDate,
              },
            ],
            {
              _id: drill._id,
              title: drill.title ?? title ?? "",
              type: drill.type ?? drillType,
              learning_journey_part: drill.learning_journey_part ?? validatedPart,
              learning_journey_topic: drill.learning_journey_topic ?? validatedTopic,
            },
            {
              firstName: (creator as { firstName?: string }).firstName,
              lastName: (creator as { lastName?: string }).lastName,
              name: (creator as { name?: string }).name,
            }
          );

          return { success: true as const, drillId: drill._id.toString() };
        } catch (itemErr: any) {
          logger.error("Failed to create/assign drill in bulk operation", {
            drillType: item?.drillType,
            studentId: item?.studentId,
            error: itemErr.message,
          });
          return { success: false as const, error: itemErr.message };
        }
      })
    );

    const created = results.filter((r) => r.success).length;
    const failed = results.length - created;
    const drillIds = results
      .filter((r): r is { success: true; drillId: string } => r.success)
      .map((r) => r.drillId);

    return NextResponse.json(
      {
        code: "Success",
        message: "Bulk drill creation completed",
        data: { created, failed, drillIds },
      },
      { status: 200 }
    );
  } catch (error: any) {
    logger.error("Error in bulk drill create/assign", { error: error.message });
    return NextResponse.json(
      {
        code: "ServerError",
        message: "Failed to create and assign drills",
        error: error.message,
      },
      { status: 500 }
    );
  }
}

export const POST = withRole(["admin", "tutor"], handler);

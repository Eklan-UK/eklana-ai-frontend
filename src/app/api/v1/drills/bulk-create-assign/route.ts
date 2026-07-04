// POST /api/v1/drills/bulk-create-assign - Create and assign multiple drills at once
import { NextRequest, NextResponse } from "next/server";
import { withRole } from "@/lib/api/middleware";
import { connectToDatabase } from "@/lib/api/db";
import { logger } from "@/lib/api/logger";
import { Types } from "mongoose";
import Drill from "@/models/drill";
import DrillAssignment from "@/models/drill-assignment";
import User from "@/models/user";

interface BulkDrillInput {
  drillType: string;
  title?: string;
  content: Record<string, any>;
  studentId: string;
  completionDate: string;
  difficulty: string;
  topic?: string;
  part?: string;
}

// Maps the AI-generated/provided content object onto the type-specific Drill schema fields
function mapContentFields(drillType: string, content: Record<string, any>): Record<string, any> {
  switch (drillType) {
    case "vocabulary":
      return { target_sentences: content.target_sentences ?? [] };
    case "pronunciation":
      return { pronunciation_items: content.pronunciation_items ?? [] };
    case "roleplay":
      return {
        roleplay_scenes: content.roleplay_scenes ?? [],
        student_character_name: content.student_character_name ?? "Student",
        ai_character_names: content.ai_character_names ?? [],
        drill_intro: content.drill_intro ?? "",
      };
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
  context: { userId: Types.ObjectId; userRole: string }
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
          const { drillType, title, content, studentId, completionDate, difficulty, topic, part } = item;

          if (!drillType || !content || !studentId || !completionDate || !difficulty) {
            throw new Error(
              "Each drill requires drillType, content, studentId, completionDate, and difficulty"
            );
          }

          if (!Types.ObjectId.isValid(studentId)) {
            throw new Error(`Invalid studentId: ${studentId}`);
          }

          const dueDate = new Date(completionDate);
          if (Number.isNaN(dueDate.getTime())) {
            throw new Error(`Invalid completionDate: ${completionDate}`);
          }

          const drillData: any = {
            title: title ?? "",
            type: drillType,
            difficulty,
            date: dueDate,
            duration_days: 1,
            assigned_to: [studentId],
            context: "",
            is_active: true,
            created_by: (creator as any).email,
            createdById: context.userId,
            totalAssignments: 0,
            totalCompletions: 0,
            averageScore: 0,
            averageCompletionTime: 0,
            ...mapContentFields(drillType, content),
          };

          if (part !== undefined) drillData.learning_journey_part = part;
          if (topic !== undefined) drillData.learning_journey_topic = topic;

          const drill = await Drill.create(drillData);

          await DrillAssignment.create({
            drillId: drill._id,
            learnerId: new Types.ObjectId(studentId),
            assignedBy: context.userId,
            dueDate,
            status: "pending",
          });

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

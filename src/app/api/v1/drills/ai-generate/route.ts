import { NextRequest, NextResponse } from "next/server";
import { withRole } from "@/lib/api/middleware";
import { connectToDatabase } from "@/lib/api/db";
import { logger } from "@/lib/api/logger";
import { generateDrill } from "@/domain/drills/ai-drill-generator.service";
import { aggregateWeaknesses } from "@/domain/challenges/weakness-aggregator";
import StudentContext from "@/models/studentContext";
import User from "@/models/user";
import PromptTemplate from "@/models/promptTemplate";
import DrillAssignment from "@/models/drill-assignment";
import Drill from "@/models/drill";
import { Types } from "mongoose";
import {
  isValidPartTopicPair,
  parseLearningJourneyPartId,
} from "@/domain/learning-journey/learning-journey.catalog";

async function handler(
  req: NextRequest,
  context: { userId: any; userRole: string }
): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { drillType, drillTypes: drillTypesRaw, difficulty, context: drillContext, prompt, topic, part, studentId, studentIds } = body;

    const drillTypes: string[] = Array.isArray(drillTypesRaw)
      ? drillTypesRaw
      : drillType
        ? [drillType]
        : [];

    if (drillTypes.length === 0 || !prompt) {
      return NextResponse.json(
        { code: "ValidationError", message: "drillTypes (non-empty array) and prompt are required" },
        { status: 400 }
      );
    }

    if (!part || !topic) {
      return NextResponse.json(
        { code: "ValidationError", message: "part and topic are required" },
        { status: 400 }
      );
    }

    const journeyPart = parseLearningJourneyPartId(part);
    if (!journeyPart || !isValidPartTopicPair(journeyPart, String(topic))) {
      return NextResponse.json(
        { code: "ValidationError", message: "Invalid learning journey mission/topic pair" },
        { status: 400 }
      );
    }

    logger.info("Generating AI drill content", {
      drillTypes,
      difficulty,
      studentId,
      studentIds,
    });

    let studentContext: object | undefined;
    let drillWeaknesses: object[] | undefined;

    if (studentId && Types.ObjectId.isValid(studentId)) {
      try {
        await connectToDatabase();
        const learnerObjectId = new Types.ObjectId(studentId);

        const [contextDoc, user] = await Promise.all([
          StudentContext.findOne({ studentId: learnerObjectId }).lean(),
          User.findById(learnerObjectId).lean(),
        ]);

        if (contextDoc) {
          studentContext = contextDoc;
        }

        if (user) {
          const weekStartDate =
            (user as any).subscriptionActivatedAt ??
            new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
          const profile = await aggregateWeaknesses(learnerObjectId, weekStartDate);
          if (profile.topWeaknesses.length > 0) {
            drillWeaknesses = profile.topWeaknesses;
          }
        }
      } catch (enrichErr: any) {
        logger.warn("Failed to enrich drill with student context/weaknesses", {
          studentId,
          error: enrichErr.message,
        });
      }
    }

    const templatePromptByDrillType = new Map<string, string>();

    if (topic && part) {
      await Promise.all(
        drillTypes.map(async (dt) => {
          try {
            await connectToDatabase();
            const templateDoc = await PromptTemplate.findOne({ drillType: dt, topic, part }).lean();
            if (templateDoc) {
              templatePromptByDrillType.set(
                dt,
                templateDoc.template
                  .replace(/\{\{difficulty\}\}/g, difficulty ?? "intermediate")
                  .replace(/\{\{context\}\}/g, drillContext ?? "")
                  .replace(/\{\{topic\}\}/g, topic)
                  .replace(/\{\{part\}\}/g, part)
              );
            }
          } catch (templateErr: any) {
            logger.warn("Failed to fetch prompt template", {
              drillType: dt,
              topic,
              part,
              error: templateErr.message,
            });
          }
        })
      );
    }

    let drillHistory: object[] | undefined;

    if (studentId && Types.ObjectId.isValid(studentId)) {
      try {
        await connectToDatabase();
        const learnerObjectId = new Types.ObjectId(studentId);

        const assignments = await DrillAssignment.find(
          { learnerId: learnerObjectId },
          { drillId: 1, _id: 0 },
        ).lean();

        const drillIds = assignments.map((a) => a.drillId);

        if (drillIds.length > 0) {
          const drills = await Drill.find(
            { _id: { $in: drillIds } },
            { type: 1, title: 1, difficulty: 1, learning_journey_topic: 1, learning_journey_part: 1 },
          )
            .sort({ created_date: -1 })
            .limit(10)
            .lean();

          if (drills.length > 0) {
            drillHistory = drills.map((d) => ({
              type: d.type,
              title: d.title,
              difficulty: d.difficulty,
              learning_journey_topic: d.learning_journey_topic,
              learning_journey_part: d.learning_journey_part,
            }));
          }
        }
      } catch (historyErr: any) {
        logger.warn("Failed to fetch drill history for student", {
          studentId,
          error: historyErr.message,
        });
      }
    }

    const generated = await Promise.all(
      drillTypes.map(async (dt) => {
        const content = await generateDrill({
          drillType: dt as any,
          difficulty: difficulty ?? "intermediate",
          context: drillContext ?? "",
          prompt,
          topic,
          part,
          studentContext,
          drillWeaknesses,
          templatePrompt: templatePromptByDrillType.get(dt),
          drillHistory,
        });
        return { drillType: dt, content };
      })
    );

    return NextResponse.json(
      {
        code: "Success",
        message: "Drill content generated successfully",
        data: generated,
      },
      { status: 200 }
    );
  } catch (error: any) {
    logger.error("Error generating AI drill content", { error: error.message });
    return NextResponse.json(
      {
        code: "ServerError",
        message: "Failed to generate drill content",
        error: error.message,
      },
      { status: 500 }
    );
  }
}

export const POST = withRole(["admin", "tutor"], handler);

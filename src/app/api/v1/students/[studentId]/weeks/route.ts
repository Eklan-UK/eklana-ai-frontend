import { NextRequest, NextResponse } from "next/server";
import { withRole } from "@/lib/api/middleware";
import { connectToDatabase } from "@/lib/api/db";
import { logger } from "@/lib/api/logger";
import { Types } from "mongoose";
import User from "@/models/user";
import DrillAssignment from "@/models/drill-assignment";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

async function handler(
  _req: NextRequest,
  _context: { userId: any; userRole: string },
  params: { studentId: string },
): Promise<NextResponse> {
  try {
    const { studentId } = params;

    if (!Types.ObjectId.isValid(studentId)) {
      return NextResponse.json(
        { code: "ValidationError", message: "Invalid student ID" },
        { status: 400 },
      );
    }

    await connectToDatabase();

    const learnerObjectId = new Types.ObjectId(studentId);

    const user = await User.findById(learnerObjectId).lean();
    if (!user) {
      return NextResponse.json(
        { code: "NotFoundError", message: "Student not found" },
        { status: 404 },
      );
    }

    const anchor: Date =
      (user as any).subscriptionActivatedAt ?? (user as any).createdAt;

    const assignments = await DrillAssignment.find({ learnerId: learnerObjectId })
      .populate("drillId", "title type difficulty learning_journey_topic learning_journey_part is_active")
      .lean();

    const weekMap = new Map<number, object[]>();

    for (const assignment of assignments) {
      const assignedAt: Date = (assignment as any).assignedAt;
      const weekNumber = Math.max(
        1,
        Math.ceil((assignedAt.getTime() - anchor.getTime()) / WEEK_MS),
      );

      const drill = (assignment as any).drillId as any;

      const entry = {
        assignmentId: (assignment as any)._id,
        drillId: drill?._id ?? null,
        title: drill?.title ?? null,
        type: drill?.type ?? null,
        difficulty: drill?.difficulty ?? null,
        topic: drill?.learning_journey_topic ?? null,
        part: drill?.learning_journey_part ?? null,
        status: (assignment as any).status,
        assignedAt: (assignment as any).assignedAt,
        dueDate: (assignment as any).dueDate ?? null,
        completedAt: (assignment as any).completedAt ?? null,
      };

      const existing = weekMap.get(weekNumber);
      if (existing) {
        existing.push(entry);
      } else {
        weekMap.set(weekNumber, [entry]);
      }
    }

    const weeks = Array.from(weekMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([weekNumber, drills]) => ({ weekNumber, drills }));

    logger.info("Fetched student weekly drill breakdown", { studentId, weekCount: weeks.length });

    return NextResponse.json(
      { code: "Success", data: { weeks } },
      { status: 200 },
    );
  } catch (error: any) {
    logger.error("Error fetching student weeks", { error: error.message });
    return NextResponse.json(
      { code: "ServerError", message: "Failed to fetch student weeks", error: error.message },
      { status: 500 },
    );
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> },
) {
  const resolvedParams = await params;
  return withRole(["admin", "tutor"], (req, context) =>
    handler(req, context, resolvedParams),
  )(req);
}

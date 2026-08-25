import { NextRequest, NextResponse } from "next/server";
import { withRole } from "@/lib/api/middleware";
import { connectToDatabase } from "@/lib/api/db";
import { logger } from "@/lib/api/logger";
import { isValidUserId } from "@/lib/api/user-id";
import { isValidationError } from "@/lib/api/response";
import { moveStudentWeekDrills } from "@/lib/ai-drill-builder/resolve-drill-builder-weeks";
import {
  assertStaffCanReadLearner,
  resolveLearnerIdToUserIdString,
} from "@/lib/api/staff-learner-access";

async function postHandler(
  req: NextRequest,
  context: { userId: string; userRole: string },
  params: { studentId: string },
): Promise<NextResponse> {
  try {
    const { studentId } = params;

    if (!isValidUserId(studentId)) {
      return NextResponse.json(
        { code: "ValidationError", message: "Invalid student ID" },
        { status: 400 },
      );
    }

    const body = await req.json().catch(() => null);
    const assignmentIds = body?.assignmentIds;
    const rawTarget = body?.targetWeekNumber;
    const targetWeekNumber =
      typeof rawTarget === "number"
        ? rawTarget
        : typeof rawTarget === "string" && rawTarget.trim() !== ""
          ? Number(rawTarget)
          : NaN;

    if (!Array.isArray(assignmentIds) || assignmentIds.length === 0) {
      return NextResponse.json(
        {
          code: "ValidationError",
          message: "assignmentIds must be a non-empty array",
        },
        { status: 400 },
      );
    }

    if (
      !Number.isFinite(targetWeekNumber) ||
      !Number.isInteger(targetWeekNumber) ||
      targetWeekNumber < 1
    ) {
      return NextResponse.json(
        {
          code: "ValidationError",
          message: "targetWeekNumber must be a positive integer",
        },
        { status: 400 },
      );
    }

    await connectToDatabase();

    const canonicalLearnerId = await resolveLearnerIdToUserIdString(studentId);
    const access = await assertStaffCanReadLearner(context, canonicalLearnerId);
    if (access === "forbidden") {
      return NextResponse.json(
        { code: "NotFoundError", message: "Student not found" },
        { status: 404 },
      );
    }

    const data = await moveStudentWeekDrills({
      learnerId: canonicalLearnerId,
      assignmentIds,
      targetWeekNumber,
    });

    logger.info("Moved student week drills", {
      studentId,
      movedCount: data.movedCount,
      targetWeekNumber: data.targetWeekNumber,
    });

    return NextResponse.json({ code: "Success", data }, { status: 200 });
  } catch (error: unknown) {
    if (isValidationError(error)) {
      return NextResponse.json(
        { code: "ValidationError", message: error.message },
        { status: 400 },
      );
    }
    if (error instanceof Error && error.name === "NotFoundError") {
      return NextResponse.json(
        { code: "NotFoundError", message: error.message },
        { status: 404 },
      );
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error("Error moving student week drills", { error: message });
    return NextResponse.json(
      {
        code: "ServerError",
        message: "Failed to move drills",
        error: message,
      },
      { status: 500 },
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> },
) {
  const resolvedParams = await params;
  return withRole(["admin", "tutor"], (req, context) =>
    postHandler(req, context, resolvedParams),
  )(req);
}

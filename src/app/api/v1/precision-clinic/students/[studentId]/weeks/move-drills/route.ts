// POST /api/v1/precision-clinic/students/[studentId]/weeks/move-drills
import { NextRequest } from "next/server";
import { withRole } from "@/lib/api/middleware";
import { withErrorHandler } from "@/lib/api/error-handler";
import { connectToDatabase } from "@/lib/api/db";
import { apiResponse, NotFoundError, ValidationError } from "@/lib/api/response";
import { isValidUserId } from "@/lib/api/user-id";
import { logger } from "@/lib/api/logger";
import {
  assertStaffCanReadLearner,
  resolveLearnerIdToUserIdString,
} from "@/lib/api/staff-learner-access";
import { movePrecisionClinicStudentWeekDrills } from "@/lib/precision-clinic/resolve-precision-clinic-weeks";

async function postHandler(
  req: NextRequest,
  context: { userId: string; userRole: string },
  params: { studentId: string },
) {
  const { studentId } = params;

  if (!isValidUserId(studentId)) {
    throw new ValidationError("Invalid student ID");
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
    throw new ValidationError("assignmentIds must be a non-empty array");
  }

  if (
    !Number.isFinite(targetWeekNumber) ||
    !Number.isInteger(targetWeekNumber) ||
    targetWeekNumber < 1
  ) {
    throw new ValidationError("targetWeekNumber must be a positive integer");
  }

  await connectToDatabase();

  const canonicalLearnerId = await resolveLearnerIdToUserIdString(studentId);
  const access = await assertStaffCanReadLearner(context, canonicalLearnerId);
  if (access === "forbidden") {
    throw new NotFoundError("Student");
  }

  const data = await movePrecisionClinicStudentWeekDrills({
    learnerId: canonicalLearnerId,
    assignmentIds,
    targetWeekNumber,
  });

  logger.info("Moved precision clinic student week drills", {
    studentId: canonicalLearnerId,
    movedCount: data.movedCount,
    targetWeekNumber: data.targetWeekNumber,
  });

  return apiResponse.success(data);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> },
) {
  const resolvedParams = await params;
  return withRole(
    ["admin", "tutor"],
    withErrorHandler((r, c) => postHandler(r, c, resolvedParams)),
  )(req);
}

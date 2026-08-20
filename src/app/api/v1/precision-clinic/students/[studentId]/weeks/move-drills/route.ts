// POST /api/v1/precision-clinic/students/[studentId]/weeks/move-drills
import { NextRequest } from "next/server";
import { withRole } from "@/lib/api/middleware";
import { withErrorHandler } from "@/lib/api/error-handler";
import { connectToDatabase } from "@/lib/api/db";
import { apiResponse, ValidationError } from "@/lib/api/response";
import { isValidUserId } from "@/lib/api/user-id";
import { logger } from "@/lib/api/logger";
import { movePrecisionClinicStudentWeekDrills } from "@/lib/precision-clinic/resolve-precision-clinic-weeks";

async function postHandler(
  req: NextRequest,
  _context: { userId: string; userRole: string },
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

  const data = await movePrecisionClinicStudentWeekDrills({
    learnerId: studentId,
    assignmentIds,
    targetWeekNumber,
  });

  logger.info("Moved precision clinic student week drills", {
    studentId,
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
    ["admin"],
    withErrorHandler((r, c) => postHandler(r, c, resolvedParams)),
  )(req);
}

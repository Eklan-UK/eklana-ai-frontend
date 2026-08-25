// POST /api/v1/drills/[drillId]/assign - Assign a drill to one or more learners
import { NextRequest, NextResponse } from "next/server";
import { withRole } from "@/lib/api/middleware";
import { withErrorHandler } from "@/lib/api/error-handler";
import { connectToDatabase } from "@/lib/api/db";
import { Types } from "mongoose";
import { apiResponse, ValidationError } from "@/lib/api/response";
import { isValidUserId, toUserIdQuery, toUserIdQueryMulti } from "@/lib/api/user-id";
import Drill from "@/models/drill";
import DrillAssignment from "@/models/drill-assignment";
import User from "@/models/user";
import { assertLearnersEnrolledForDrill } from "@/domain/learning-journey/mission-enrollment.service";
import { assertLearnersEnrolledForClinic } from "@/domain/precision-clinic/clinic-enrollment.service";
import type { LearningJourneyPartId } from "@/domain/learning-journey/learning-journey.catalog";
import { notifyLearnersOfAssignment } from "@/domain/drills/drill.service";
import { getAssignedAtForWeek } from "@/lib/ai-drill-builder/week-utils";
import { assertStaffCanActOnLearners } from "@/lib/api/staff-learner-access";

async function handler(
  req: NextRequest,
  context: { userId: string; userRole: string },
  params: { drillId: string }
): Promise<NextResponse> {
  await connectToDatabase();

  const { drillId } = params;

  if (!Types.ObjectId.isValid(drillId)) {
    throw new ValidationError("Invalid drill ID format");
  }

  const body = await req.json();
  const { userIds, dueDate, weekNumber } = body as {
    userIds?: unknown;
    dueDate?: unknown;
    weekNumber?: unknown;
  };

  const parsedWeekNumber =
    typeof weekNumber === "number" &&
    Number.isFinite(weekNumber) &&
    weekNumber >= 1
      ? Math.floor(weekNumber)
      : typeof weekNumber === "string" &&
          weekNumber.trim() !== "" &&
          Number.isFinite(Number(weekNumber)) &&
          Number(weekNumber) >= 1
        ? Math.floor(Number(weekNumber))
        : undefined;

  if (!Array.isArray(userIds) || userIds.length === 0) {
    throw new ValidationError("userIds (non-empty array) is required");
  }

  // Accept UUID (Better Auth web sign-up, incl. Google/Apple OAuth) or
  // ObjectId (legacy/mobile) user ids — previously UUID ids were rejected
  // here, meaning drills could never be assigned to those students.
  for (const uid of userIds) {
    if (typeof uid !== "string" || !isValidUserId(uid)) {
      throw new ValidationError(`Invalid userId format: ${String(uid)}`);
    }
  }

  const drillObjectId = new Types.ObjectId(drillId);

  // Verify drill exists
  const drill = await Drill.findById(drillObjectId)
    .select("_id title type assigned_to learning_journey_part learning_journey_topic source")
    .lean()
    .exec();
  if (!drill) {
    return NextResponse.json(
      { code: "NotFound", message: "Drill not found" },
      { status: 404 }
    );
  }

  const assigner = await User.findById(context.userId)
    .select("firstName lastName name")
    .lean()
    .exec();

  // Validate all userIds belong to learners (role: user)
  const learners = await User.find({
    _id: { $in: toUserIdQueryMulti(userIds as string[]) },
    role: "user",
  })
    .select("_id subscriptionActivatedAt createdAt")
    .lean()
    .exec();

  const learnerById = new Map(
    learners.map((u) => [String(u._id), u] as const),
  );
  const validLearnerIds = new Set(learnerById.keys());
  const invalidIds = (userIds as string[]).filter((id) => !validLearnerIds.has(id));
  if (invalidIds.length > 0) {
    throw new ValidationError(
      `The following userIds are not valid learners (role: user): ${invalidIds.join(", ")}`
    );
  }

  const access = await assertStaffCanActOnLearners(
    context,
    userIds as string[],
  );
  if (access === "forbidden") {
    return apiResponse.notFound("Learner");
  }

  if (drill.source === "precision_clinic") {
    await assertLearnersEnrolledForClinic({
      learnerIds: userIds as string[],
    });
  } else {
    const journeyPart = drill.learning_journey_part as LearningJourneyPartId | undefined;
    if (journeyPart != null) {
      await assertLearnersEnrolledForDrill({
        learnerIds: userIds as string[],
        part: journeyPart,
      });
    }
  }

  const dueDateObj =
    typeof dueDate === "string" && dueDate.length > 0 ? new Date(dueDate) : undefined;

  const assignments: Array<{
    id: string;
    learnerId: string;
    status: string;
    dueDate?: string;
  }> = [];
  const newlyCreated: Array<{
    learnerId: string;
    _id: string;
    dueDate?: Date;
  }> = [];

  for (const uid of userIds as string[]) {
    // learnerId is stored as-is: Types.ObjectId for ObjectId-format users,
    // string for UUID users (DrillAssignment.learnerId is Schema.Types.Mixed).
    const learnerIdValue = toUserIdQuery(uid);
    const learner = learnerById.get(uid);
    const assignedAt =
      parsedWeekNumber != null && learner
        ? getAssignedAtForWeek(
            parsedWeekNumber,
            (learner as { subscriptionActivatedAt?: Date | null })
              .subscriptionActivatedAt,
            (learner as { createdAt?: Date }).createdAt,
          )
        : new Date();
    try {
      const assignment = await DrillAssignment.create({
        drillId: drillObjectId,
        learnerId: learnerIdValue,
        assignedBy: toUserIdQuery(context.userId),
        assignedAt,
        ...(parsedWeekNumber != null
          ? { builderWeekNumber: parsedWeekNumber }
          : {}),
        dueDate: dueDateObj,
        status: "pending",
      });

      // Keep drill.assigned_to in sync — add learner if not already present.
      // assigned_to is a [String] array, so always push the raw string id.
      await Drill.updateOne(
        { _id: drillObjectId, assigned_to: { $ne: uid } },
        { $push: { assigned_to: uid } }
      ).exec();

      assignments.push({
        id: String(assignment._id),
        learnerId: uid,
        status: assignment.status,
        dueDate: assignment.dueDate?.toISOString(),
      });
      newlyCreated.push({
        learnerId: uid,
        _id: String(assignment._id),
        dueDate: assignment.dueDate,
      });
    } catch (err: any) {
      if (err.code === 11000) {
        // Duplicate key — assignment already exists, return the existing row
        const existing = await DrillAssignment.findOne({
          drillId: drillObjectId,
          learnerId: learnerIdValue,
        })
          .select("_id status dueDate")
          .lean()
          .exec();
        if (existing) {
          assignments.push({
            id: String(existing._id),
            learnerId: uid,
            status: existing.status as string,
            dueDate: existing.dueDate ? (existing.dueDate as Date).toISOString() : undefined,
          });
        }
      } else {
        throw err;
      }
    }
  }

  if (newlyCreated.length > 0) {
    notifyLearnersOfAssignment(
      newlyCreated,
      {
        _id: String(drill._id),
        title: (drill as { title?: string }).title ?? "",
        type: (drill as { type?: string }).type ?? "",
        learning_journey_part: (drill as { learning_journey_part?: number | null })
          .learning_journey_part,
        learning_journey_topic: (drill as { learning_journey_topic?: string | null })
          .learning_journey_topic,
      },
      {
        firstName: (assigner as { firstName?: string } | null)?.firstName,
        lastName: (assigner as { lastName?: string } | null)?.lastName,
        name: (assigner as { name?: string } | null)?.name,
      }
    );
  }

  return apiResponse.success({ assignments });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ drillId: string }> }
) {
  const resolvedParams = await params;
  return withRole(
    ["admin", "tutor"],
    withErrorHandler((req, context) => handler(req, context, resolvedParams))
  )(req);
}

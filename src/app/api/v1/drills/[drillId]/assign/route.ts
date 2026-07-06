// POST /api/v1/drills/[drillId]/assign - Assign a drill to one or more learners
import { NextRequest, NextResponse } from "next/server";
import { withRole } from "@/lib/api/middleware";
import { withErrorHandler } from "@/lib/api/error-handler";
import { connectToDatabase } from "@/lib/api/db";
import { Types } from "mongoose";
import { apiResponse, ValidationError } from "@/lib/api/response";
import Drill from "@/models/drill";
import DrillAssignment from "@/models/drill-assignment";
import User from "@/models/user";

async function handler(
  req: NextRequest,
  context: { userId: Types.ObjectId; userRole: string },
  params: { drillId: string }
): Promise<NextResponse> {
  await connectToDatabase();

  const { drillId } = params;

  if (!Types.ObjectId.isValid(drillId)) {
    throw new ValidationError("Invalid drill ID format");
  }

  const body = await req.json();
  const { userIds, dueDate } = body as { userIds?: unknown; dueDate?: unknown };

  if (!Array.isArray(userIds) || userIds.length === 0) {
    throw new ValidationError("userIds (non-empty array) is required");
  }

  for (const uid of userIds) {
    if (typeof uid !== "string" || !Types.ObjectId.isValid(uid)) {
      throw new ValidationError(`Invalid userId format: ${String(uid)}`);
    }
  }

  const drillObjectId = new Types.ObjectId(drillId);

  // Verify drill exists
  const drill = await Drill.findById(drillObjectId).select("_id assigned_to").lean().exec();
  if (!drill) {
    return NextResponse.json(
      { code: "NotFound", message: "Drill not found" },
      { status: 404 }
    );
  }

  // Validate all userIds belong to learners (role: user)
  const learners = await User.find({
    _id: { $in: (userIds as string[]).map((id) => new Types.ObjectId(id)) },
    role: "user",
  })
    .select("_id")
    .lean()
    .exec();

  const validLearnerIds = new Set(learners.map((u) => String(u._id)));
  const invalidIds = (userIds as string[]).filter((id) => !validLearnerIds.has(id));
  if (invalidIds.length > 0) {
    throw new ValidationError(
      `The following userIds are not valid learners (role: user): ${invalidIds.join(", ")}`
    );
  }

  const dueDateObj =
    typeof dueDate === "string" && dueDate.length > 0 ? new Date(dueDate) : undefined;

  const assignments: Array<{
    id: string;
    learnerId: string;
    status: string;
    dueDate?: string;
  }> = [];

  for (const uid of userIds as string[]) {
    const learnerObjectId = new Types.ObjectId(uid);
    try {
      const assignment = await DrillAssignment.create({
        drillId: drillObjectId,
        learnerId: learnerObjectId,
        assignedBy: context.userId,
        assignedAt: new Date(),
        dueDate: dueDateObj,
        status: "pending",
      });

      // Keep drill.assigned_to in sync — add learner if not already present
      await Drill.updateOne(
        { _id: drillObjectId, assigned_to: { $ne: learnerObjectId } },
        { $push: { assigned_to: learnerObjectId } }
      ).exec();

      assignments.push({
        id: String(assignment._id),
        learnerId: uid,
        status: assignment.status,
        dueDate: assignment.dueDate?.toISOString(),
      });
    } catch (err: any) {
      if (err.code === 11000) {
        // Duplicate key — assignment already exists, return the existing row
        const existing = await DrillAssignment.findOne({
          drillId: drillObjectId,
          learnerId: learnerObjectId,
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

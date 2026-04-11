// GET /api/v1/tutor/students
// Get all students assigned to the authenticated tutor with drill counts
import { NextRequest, NextResponse } from "next/server";
import { withRole } from "@/lib/api/middleware";
import { connectToDatabase } from "@/lib/api/db";
import User from "@/models/user";
import Profile from "@/models/profile";
import DrillAssignment from "@/models/drill-assignment";
import config from "@/lib/api/config";
import { logger } from "@/lib/api/logger";
import { Types } from "mongoose";

async function handler(
	req: NextRequest,
	context: { userId: Types.ObjectId; userRole: string },
): Promise<NextResponse> {
	try {
		await connectToDatabase();

		const { searchParams } = new URL(req.url);
		const limit = parseInt(searchParams.get("limit") || String(config.defaultResLimit));
		const offset = parseInt(searchParams.get("offset") || String(config.defaultResOffset));

		const total = await Profile.countDocuments({ tutorId: context.userId }).exec();

		const profiles = await Profile.find({ tutorId: context.userId })
			.select("userId")
			.sort({ createdAt: -1 })
			.limit(limit)
			.skip(offset)
			.lean()
			.exec();

		const userIds = profiles.map((p) => p.userId);

		if (userIds.length === 0) {
			return NextResponse.json(
				{
					limit,
					offset,
					total,
					students: [],
				},
				{ status: 200 },
			);
		}

		const users = await User.find({ _id: { $in: userIds } })
			.select("-password -__v")
			.lean()
			.exec();

		const userById = new Map(users.map((u) => [u._id.toString(), u]));
		const orderedUsers = userIds
			.map((id) => userById.get(id.toString()))
			.filter((u): u is (typeof users)[number] => !!u);

		const drillCounts = await DrillAssignment.aggregate([
			{
				$match: {
					learnerId: { $in: userIds.map((id) => new Types.ObjectId(id)) },
					assignedBy: context.userId,
				},
			},
			{
				$group: {
					_id: "$learnerId",
					totalAssigned: { $sum: 1 },
					completed: {
						$sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
					},
					pending: {
						$sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] },
					},
					inProgress: {
						$sum: { $cond: [{ $eq: ["$status", "in-progress"] }, 1, 0] },
					},
				},
			},
		]).exec();

		const drillCountsMap = new Map(
			drillCounts.map((dc) => [
				dc._id.toString(),
				{
					drillsTotal: dc.totalAssigned,
					drillsCompleted: dc.completed,
					drillsActive: dc.pending + dc.inProgress,
				},
			]),
		);

		const students = orderedUsers.map((user) => {
			const counts = drillCountsMap.get(user._id.toString()) || {
				drillsTotal: 0,
				drillsCompleted: 0,
				drillsActive: 0,
			};

			const progress =
				counts.drillsTotal > 0
					? Math.round((counts.drillsCompleted / counts.drillsTotal) * 100)
					: 0;

			return {
				...user,
				userId: user,
				drillsTotal: counts.drillsTotal,
				drillsCompleted: counts.drillsCompleted,
				drillsActive: counts.drillsActive,
				progress,
			};
		});

		logger.info("Students fetched successfully for tutor", {
			tutorId: context.userId,
			returned: students.length,
			totalProfiles: total,
		});

		return NextResponse.json(
			{
				limit,
				offset,
				total,
				students,
			},
			{ status: 200 },
		);
	} catch (error: any) {
		logger.error("Error fetching students for tutor", error);
		return NextResponse.json(
			{
				code: "ServerError",
				message: "Internal Server Error",
				error: error.message,
			},
			{ status: 500 },
		);
	}
}

export const GET = withRole(["tutor"], handler);

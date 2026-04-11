/**
 * Permanently remove known demo/test users and related MongoDB documents.
 *
 * Matches users by case-insensitive firstName + lastName (exact pair).
 * Skips emails in DELETE_TEST_USERS_PROTECT_EMAILS (default: vandulinus@gmail.com).
 * Skips role "admin" unless --include-admin is passed.
 *
 * Usage:
 *   npx tsx scripts/delete-test-users-by-name.ts --dry-run
 *   npx tsx scripts/delete-test-users-by-name.ts
 *
 * Requires MONGO_URI in .env (same as the app).
 */
import "dotenv/config";
import mongoose, { Types } from "mongoose";
import { connectToDatabase } from "../src/lib/api/db";
import User from "../src/models/user";
import Profile from "../src/models/profile";
import DrillAssignment from "../src/models/drill-assignment";
import DrillAttempt from "../src/models/drill-attempt";
import Bookmark from "../src/models/bookmark";
import Activity from "../src/models/activity";
import DailyReflection from "../src/models/daily-reflection";
import DailyFocusCompletion from "../src/models/daily-focus-completion";
import DailyFocusProgress from "../src/models/daily-focus-progress";
import Progress from "../src/models/progress";
import UserStreak from "../src/models/user-streak";
import FCMToken from "../src/models/fcm-token";
import { Notification } from "../src/models/notification.model";
import { PushToken } from "../src/models/push-token.model";
import FutureSelf from "../src/models/future-self";
import ClassEnrollment from "../src/models/class-enrollment";
import SessionAttendance from "../src/models/session-attendance";
import LearningSession from "../src/models/learning-session";
import LearnerPronunciation from "../src/models/learner-pronunciation";
import LearnerPronunciationProgress from "../src/models/learner-pronunciation-progress";
import WordAnalytics from "../src/models/word-analytics";
import PronunciationAttempt from "../src/models/pronunciation-attempt";
import TutorAssignment from "../src/models/tutor-assignment";
import Tutor from "../src/models/tutor";
import LearnerConfidence from "../src/models/learner-confidence";
import PronunciationAssignment from "../src/models/pronunciation-assignment";

const NAME_PAIRS: ReadonlyArray<readonly [string, string]> = [
	["John", "Apple"],
	["John", "Doe"],
	["Test", "User"],
	["Apple", "John"],
	["Su", "Doer"],
	["Linus", "Vandu"],
	["Linus", "Daniel"],
];

const DRY_RUN = process.argv.includes("--dry-run");
const INCLUDE_ADMIN = process.argv.includes("--include-admin");

function escapeRegex(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function protectedEmails(): Set<string> {
	const raw =
		process.env.DELETE_TEST_USERS_PROTECT_EMAILS ||
		"vandulinus@gmail.com";
	return new Set(
		raw
			.split(",")
			.map((e) => e.trim().toLowerCase())
			.filter(Boolean),
	);
}

async function findMatchingUsers(): Promise<
	Array<{ _id: Types.ObjectId; email: string; firstName: string; lastName: string; role: string }>
> {
	const found: Array<{
		_id: Types.ObjectId;
		email: string;
		firstName: string;
		lastName: string;
		role: string;
	}> = [];

	for (const [first, last] of NAME_PAIRS) {
		const users = await User.find({
			firstName: new RegExp(`^${escapeRegex(first)}$`, "i"),
			lastName: new RegExp(`^${escapeRegex(last)}$`, "i"),
		})
			.select("email firstName lastName role")
			.lean()
			.exec();

		for (const u of users) {
			const id = u._id as Types.ObjectId;
			if (found.some((x) => x._id.equals(id))) continue;
			found.push({
				_id: id,
				email: String(u.email || ""),
				firstName: String(u.firstName || ""),
				lastName: String(u.lastName || ""),
				role: String(u.role || "user"),
			});
		}
	}

	return found;
}

async function deleteBetterAuthRecords(uid: Types.ObjectId): Promise<void> {
	const db = mongoose.connection.db;
	if (!db) return;
	const idStr = uid.toString();
	const q = { $or: [{ userId: uid }, { userId: idStr }] };
	for (const coll of ["sessions", "accounts"] as const) {
		try {
			const r = await db.collection(coll).deleteMany(q);
			if (r.deletedCount && DRY_RUN === false) {
				console.log(`    ${coll}: deleted ${r.deletedCount}`);
			}
		} catch (e: unknown) {
			console.warn(`    (skip ${coll}: ${e instanceof Error ? e.message : String(e)})`);
		}
	}
}

async function cascadeDeleteUser(uid: Types.ObjectId): Promise<void> {
	const ops: Promise<{ deletedCount?: number }>[] = [
		Profile.deleteMany({ $or: [{ userId: uid }, { tutorId: uid }] }),
		Tutor.deleteMany({ userId: uid }),
		DrillAssignment.deleteMany({
			$or: [{ learnerId: uid }, { assignedBy: uid }],
		}),
		DrillAttempt.deleteMany({ learnerId: uid }),
		Bookmark.deleteMany({ userId: uid }),
		Activity.deleteMany({ userId: uid }),
		DailyReflection.deleteMany({ userId: uid }),
		DailyFocusCompletion.deleteMany({ userId: uid }),
		DailyFocusProgress.deleteMany({ userId: uid }),
		Progress.deleteMany({ userId: uid }),
		UserStreak.deleteMany({ userId: uid }),
		FCMToken.deleteMany({ userId: uid }),
		Notification.deleteMany({ userId: uid }),
		PushToken.deleteMany({ userId: uid }),
		FutureSelf.deleteMany({ userId: uid }),
		ClassEnrollment.deleteMany({ learnerId: uid }),
		SessionAttendance.deleteMany({ learnerId: uid }),
		LearningSession.deleteMany({ learnerId: uid }),
		LearnerPronunciation.deleteMany({ learnerId: uid }),
		LearnerPronunciationProgress.deleteMany({ learnerId: uid }),
		WordAnalytics.deleteMany({ learnerId: uid }),
		PronunciationAttempt.deleteMany({ learnerId: uid }),
		TutorAssignment.deleteMany({
			$or: [{ learnerId: uid }, { tutorId: uid }],
		}),
		LearnerConfidence.deleteMany({ learnerId: uid }),
		PronunciationAssignment.deleteMany({
			$or: [{ learnerId: uid }, { assignedBy: uid }],
		}),
	];

	const results = await Promise.all(ops);
	const total = results.reduce((s, r) => s + (r.deletedCount || 0), 0);
	if (!DRY_RUN && total > 0) {
		console.log(`    App collections: deleted ~${total} document(s) (sum of counts)`);
	}

	await deleteBetterAuthRecords(uid);

	if (!DRY_RUN) {
		const del = await User.deleteOne({ _id: uid });
		console.log(`    users: deleted ${del.deletedCount}`);
	}
}

async function main() {
	const protect = protectedEmails();
	console.log("Connecting…");
	await connectToDatabase();
	console.log("Connected.\n");

	const candidates = await findMatchingUsers();
	const toProcess: typeof candidates = [];

	for (const u of candidates) {
		const em = u.email.toLowerCase();
		if (protect.has(em)) {
			console.log(
				`SKIP (protected email): ${u.firstName} ${u.lastName} <${u.email}> role=${u.role}`,
			);
			continue;
		}
		if (u.role === "admin" && !INCLUDE_ADMIN) {
			console.log(
				`SKIP (admin — pass --include-admin to delete): ${u.firstName} ${u.lastName} <${u.email}>`,
			);
			continue;
		}
		toProcess.push(u);
	}

	if (toProcess.length === 0) {
		console.log("No users to delete.");
		await mongoose.disconnect();
		return;
	}

	console.log(
		`${DRY_RUN ? "[DRY RUN] Would delete" : "Deleting"} ${toProcess.length} user(s):\n`,
	);
	for (const u of toProcess) {
		console.log(
			`- ${u.firstName} ${u.lastName} <${u.email}> id=${u._id.toString()} role=${u.role}`,
		);
	}

	if (DRY_RUN) {
		console.log("\nRun without --dry-run to apply.");
		await mongoose.disconnect();
		return;
	}

	for (const u of toProcess) {
		console.log(`\nDeleting ${u._id.toString()}…`);
		await cascadeDeleteUser(u._id);
	}

	console.log("\nDone.");
	await mongoose.disconnect();
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});

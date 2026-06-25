// Run once. Safe to re-run — only touches documents where drillType is missing.
// npx ts-node -r tsconfig-paths/register src/scripts/backfill-drill-type.ts

import './load-env';
import { Types } from 'mongoose';
import { connectToDatabase, disconnectFromDatabase } from '@/lib/api/db';
import DrillAttempt from '@/models/drill-attempt';
import DrillModel from '@/models/drill';

const BATCH_SIZE = 100;

async function main() {
	await connectToDatabase();

	const total = await DrillAttempt.countDocuments({
		$or: [{ drillType: null }, { drillType: { $exists: false } }],
	});

	console.log(`DrillAttempts missing drillType: ${total}`);

	if (total === 0) {
		console.log('Nothing to backfill.');
		await disconnectFromDatabase();
		return;
	}

	let updated = 0;

	while (true) {
		const batch = await DrillAttempt.find({
			$or: [{ drillType: null }, { drillType: { $exists: false } }],
		})
			.select('_id drillId')
			.limit(BATCH_SIZE)
			.lean();

		if (batch.length === 0) break;

		// Collect unique drillIds in this batch
		const drillIds = [...new Set(batch.map((a) => a.drillId.toString()))].map(
			(id) => new Types.ObjectId(id)
		);

		// Fetch matching Drill documents in one query
		const drills = await DrillModel.find({ _id: { $in: drillIds } })
			.select('_id type')
			.lean();

		const drillTypeMap = new Map<string, string>();
		for (const drill of drills) {
			drillTypeMap.set(drill._id.toString(), drill.type);
		}

		// Build bulkWrite ops — set drillType to the resolved type, or null if the drill no longer exists
		let resolvedCount = 0;
		const ops = batch.map((attempt) => {
			const type = drillTypeMap.get(attempt.drillId.toString()) ?? null;
			if (type !== null) resolvedCount++;
			return {
				updateOne: {
					filter: { _id: attempt._id },
					update: { $set: { drillType: type } },
				},
			};
		});

		if (ops.length > 0) {
			await DrillAttempt.bulkWrite(ops, { ordered: false });
		}

		updated += ops.length;
		const remaining = total - updated;
		console.log(`updated: ${updated} / ${total}  (remaining: ${remaining > 0 ? remaining : 0})`);

		// Every document in this batch was an orphan (no matching Drill) — writing null
		// again on the next iteration would loop forever. Stop here.
		if (resolvedCount === 0) {
			console.log(`Stopping — ${ops.length} orphaned documents have no matching Drill and cannot be resolved.`);
			break;
		}
	}

	console.log(`Done. ${updated} documents backfilled.`);
	await disconnectFromDatabase();
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});

import FreeTalkScenario from '@/models/free-talk-scenario';

/** Hard-delete scenarios whose completion date has passed. */
export async function purgeExpiredFreeTalkScenarios(): Promise<number> {
	const result = await FreeTalkScenario.deleteMany({
		completionDate: { $lte: new Date() },
	}).exec();
	return result.deletedCount ?? 0;
}

import 'dotenv/config';
import '@/models/user';
import '@/models/weekly-challenge';
import { connectToDatabase, disconnectFromDatabase } from '@/lib/api/db';
import WeeklyChallengeModel from '@/models/weekly-challenge';
import { Types } from 'mongoose';

async function main() {
  await connectToDatabase();
  const learnerId = new Types.ObjectId('6a55daebe105a075350942f9');
  const docs = await WeeklyChallengeModel.find({ learnerId }).sort({ weekStartDate: 1 }).lean();
  console.log(`Found ${docs.length} weekly_challenges doc(s) for Eunhye Lee`);
  for (const doc of docs as any[]) {
    console.log('----');
    console.log('weekStartDate:', doc.weekStartDate);
    console.log('status:', doc.status);
    console.log('generatedAt:', doc.generatedAt);
    console.log('challengeType:', doc.challengeType);
    console.log('weaknessProfile.primaryMission/topic:', doc.weaknessProfile?.primaryMission, doc.weaknessProfile?.primaryTopic);
    const seq = doc.content?.drillSequence ?? [];
    console.log('drillSequence length:', seq.length);
    const roleplay = seq.find((d: any) => d.drillType === 'roleplay');
    console.log('roleplay drill found:', !!roleplay);
    if (roleplay) {
      console.log(JSON.stringify(roleplay, null, 2));
    }
  }
  await disconnectFromDatabase();
}
main().catch(e => { console.error(e); process.exit(1); });

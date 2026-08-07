/**
 * Read-only diagnostic for badge system audit.
 * Usage: node scripts/diagnose-badges-audit.mjs
 */
import mongoose, { Types } from 'mongoose';
import { config } from 'dotenv';

config({ path: '.env' });

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.log('NO_URI');
    process.exit(1);
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
  const db = mongoose.connection.db;
  console.log('MONGO_CONNECTED', db.databaseName);

  const drills = db.collection('drills');
  const bookmarks = db.collection('bookmarks');
  const streaks = db.collection('user_streaks');
  const users = db.collection('users');
  const freeTalk = db.collection('freetalkattempts');
  const drillAttempts = db.collection('drillattempts');
  const dailyFocus = db.collection('dailyfocuscompletions');
  const assignments = db.collection('drillassignments');

  const byDiff = await drills
    .aggregate([{ $group: { _id: '$difficulty', n: { $sum: 1 } } }])
    .toArray();
  console.log('DRILL_DIFFICULTY_COUNTS', JSON.stringify(byDiff));

  const advancedSample = await drills
    .find({ difficulty: 'advanced' })
    .project({ _id: 1, title: 1, difficulty: 1 })
    .limit(3)
    .toArray();
  console.log(
    'ADVANCED_SAMPLE',
    JSON.stringify(
      advancedSample.map((d) => ({
        id: String(d._id),
        title: d.title,
        difficulty: d.difficulty,
      }))
    )
  );

  const drillBookmarks = await bookmarks.countDocuments({ type: 'drill' });
  const nonDrillBookmarks = await bookmarks.countDocuments({
    type: { $ne: 'drill' },
  });
  console.log(
    'BOOKMARK_COUNTS',
    JSON.stringify({ drill: drillBookmarks, nonDrill: nonDrillBookmarks })
  );

  const recentDrillBms = await bookmarks
    .find({ type: 'drill' })
    .sort({ createdAt: -1 })
    .limit(20)
    .toArray();
  const drillIds = recentDrillBms.map((b) => b.drillId).filter(Boolean);
  const drillDocs = await drills
    .find({ _id: { $in: drillIds } })
    .project({ difficulty: 1, title: 1 })
    .toArray();
  const diffMap = new Map(drillDocs.map((d) => [String(d._id), d]));
  const joined = recentDrillBms.map((b) => {
    const d = diffMap.get(String(b.drillId));
    const uid = b.userId;
    return {
      userId: String(uid),
      userIdType: typeof uid === 'object' ? 'ObjectId' : typeof uid,
      isUuid: typeof uid === 'string' && String(uid).includes('-'),
      drillId: String(b.drillId),
      difficulty: d?.difficulty ?? 'MISSING_DRILL',
      title: d?.title?.slice?.(0, 40) ?? null,
    };
  });
  console.log('RECENT_DRILL_BOOKMARKS', JSON.stringify(joined, null, 2));

  const withBadges = await streaks.countDocuments({
    'badges.0': { $exists: true },
  });
  const totalStreaks = await streaks.countDocuments({});
  const masterCollector = await streaks.countDocuments({
    'badges.badgeId': 'master-collector',
  });
  const badgeIdAgg = await streaks
    .aggregate([
      { $unwind: '$badges' },
      { $group: { _id: '$badges.badgeId', n: { $sum: 1 } } },
      { $sort: { n: -1 } },
    ])
    .toArray();
  console.log(
    'STREAK_BADGE_STATS',
    JSON.stringify({ totalStreaks, withBadges, masterCollector, byBadge: badgeIdAgg })
  );

  const advDrillIds = (
    await drills.find({ difficulty: 'advanced' }).project({ _id: 1 }).toArray()
  ).map((d) => d._id);

  const usersWithAdvBm = await bookmarks
    .aggregate([
      { $match: { type: 'drill', drillId: { $in: advDrillIds } } },
      { $group: { _id: '$userId' } },
      { $limit: 50 },
    ])
    .toArray();
  console.log('USERS_WITH_ADV_BOOKMARK', usersWithAdvBm.length);

  let missing = 0;
  let has = 0;
  let noStreak = 0;
  let uuidUsers = 0;
  const gapExamples = [];
  for (const u of usersWithAdvBm) {
    const uid = u._id;
    const isUuid = typeof uid === 'string' && String(uid).includes('-');
    if (isUuid) uuidUsers++;
    let streak = null;
    if (uid && typeof uid === 'object') {
      streak = await streaks.findOne({ userId: uid });
    } else if (typeof uid === 'string' && /^[0-9a-fA-F]{24}$/.test(uid)) {
      streak = await streaks.findOne({ userId: new Types.ObjectId(uid) });
    } else {
      streak = await streaks.findOne({ userId: uid });
    }
    const badges = streak?.badges ?? [];
    const unlocked = badges.some((b) => b.badgeId === 'master-collector');
    if (!streak) {
      noStreak++;
      if (gapExamples.length < 5) {
        gapExamples.push({
          userId: String(uid),
          isUuid,
          reason: 'no_user_streak',
        });
      }
    } else if (unlocked) {
      has++;
    } else {
      missing++;
      if (gapExamples.length < 5) {
        gapExamples.push({
          userId: String(uid),
          isUuid,
          reason: 'streak_without_master_collector',
          badgeIds: badges.map((b) => b.badgeId),
        });
      }
    }
  }
  console.log(
    'MASTER_COLLECTOR_GAP',
    JSON.stringify({
      sampled: usersWithAdvBm.length,
      has,
      missing,
      noStreak,
      uuidUsersAmongSample: uuidUsers,
      gapExamples,
    })
  );

  // Intermediate/beginner bookmarks that would NOT unlock Master Collector
  const nonAdvBookmarkUsers = await bookmarks
    .aggregate([
      { $match: { type: 'drill' } },
      {
        $lookup: {
          from: 'drills',
          localField: 'drillId',
          foreignField: '_id',
          as: 'drill',
        },
      },
      { $unwind: '$drill' },
      {
        $group: {
          _id: '$drill.difficulty',
          n: { $sum: 1 },
          users: { $addToSet: '$userId' },
        },
      },
    ])
    .toArray();
  console.log(
    'DRILL_BOOKMARKS_BY_DIFFICULTY',
    JSON.stringify(
      nonAdvBookmarkUsers.map((r) => ({
        difficulty: r._id,
        bookmarks: r.n,
        uniqueUsers: r.users.length,
      }))
    )
  );

  const uuidUserCount = await users.countDocuments({ _id: { $type: 'string' } });
  const oidUserCount = await users.countDocuments({ _id: { $type: 'objectId' } });
  console.log('USER_ID_FORMATS', JSON.stringify({ uuidUserCount, oidUserCount }));

  // Smoke counts for other badge criteria (existence only)
  const handoverPassing = await freeTalk
    .countDocuments({
      scenarioType: 'handover',
      'gradeResult.overallScore': { $gte: 70 },
    })
    .catch(() => -1);
  const challengeUsers = await users.countDocuments({
    zeroPauseProducts: 'challenge',
  });
  const passingAttempts = await drillAttempts
    .countDocuments({ score: { $gte: 70 }, completedAt: { $exists: true } })
    .catch(() => -1);
  const focusFirst = await dailyFocus
    .countDocuments({ isFirstCompletion: true, score: { $gte: 70 } })
    .catch(() => -1);
  const completedAssignments = await assignments
    .countDocuments({ status: 'completed' })
    .catch(() => -1);

  // Resolve collection name variants
  const allCols = (await db.listCollections().toArray()).map((c) => c.name);
  console.log(
    'RELEVANT_COLLECTIONS',
    JSON.stringify(
      allCols.filter((n) =>
        /badge|streak|bookmark|drill|user|freetalk|daily|assignment|attempt/i.test(n)
      )
    )
  );

  console.log(
    'OTHER_CRITERIA_COUNTS',
    JSON.stringify({
      handoverPassing,
      challengeUsers,
      passingAttempts,
      focusFirst,
      completedAssignments,
    })
  );

  // Badge unlock rate among ObjectId streak users vs whether they have any badges
  const streakWithUuidStyle = await streaks
    .find({})
    .project({ userId: 1, badges: 1 })
    .limit(5)
    .toArray();
  console.log(
    'STREAK_USERID_SAMPLES',
    JSON.stringify(
      streakWithUuidStyle.map((s) => ({
        userId: String(s.userId),
        userIdBsonType: s.userId?._bsontype || typeof s.userId,
        badgeCount: (s.badges || []).length,
      }))
    )
  );

  await mongoose.disconnect();
  console.log('DONE');
}

main().catch((e) => {
  console.log('MONGO_FAILED', e.message);
  process.exit(2);
});

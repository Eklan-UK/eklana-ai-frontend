/**
 * Drop the aisessions MongoDB collection.
 *
 * This collection held old conversational AI session summaries (free, topic,
 * drill modes). The Eklan Free Talk feature has been replaced with the
 * grading-based system — no session data is stored there any longer.
 *
 * Usage:
 *   npx ts-node -e "require('./scripts/drop-ai-sessions.ts')"
 * or via mongosh:
 *   db.aisessions.drop()
 */
import { connectToDatabase } from '@/lib/api/db';
import mongoose from 'mongoose';

async function dropAiSessions() {
  await connectToDatabase();
  const db = mongoose.connection.db;
  if (!db) throw new Error('No DB connection');

  const collections = await db.listCollections({ name: 'aisessions' }).toArray();
  if (collections.length === 0) {
    console.log('Collection "aisessions" does not exist — nothing to drop.');
    return;
  }

  await db.dropCollection('aisessions');
  console.log('Collection "aisessions" dropped successfully.');
}

dropAiSessions()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => mongoose.disconnect());

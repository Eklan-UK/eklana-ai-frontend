// Utility script to update existing users without roles
// Run this to fix users that were created before role was properly set
import { connectToDatabase } from './db';
import User from '@/models/user';
import { logger } from './logger';

/**
 * Update all users without a role to have 'learner' role
 * This is a one-time migration script
 */
export async function updateUsersWithoutRole(): Promise<void> {
  try {
    await connectToDatabase();
    
    const result = await User.updateMany(
      { 
        role: { $exists: false } as any,
        $or: [
          { role: null },
          { role: undefined },
          { role: '' }
        ]
      },
      { 
        $set: { role: 'learner' } 
      }
    );

    logger.info(`Updated ${result.modifiedCount} users without roles`);
    return;
  } catch (error: any) {
    logger.error('Error updating users without roles', {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}


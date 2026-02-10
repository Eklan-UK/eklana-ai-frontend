// scripts/fix-verification-index.ts
// Run this script to fix the MongoDB verification index
// Usage: npx tsx scripts/fix-verification-index.ts

import { connectToDatabase } from '../src/lib/api/db';
import { logger } from '../src/lib/api/logger';

async function fixVerificationIndex() {
  try {
    logger.info('Connecting to database...');
    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;
    
    if (!db) {
      throw new Error('Database connection not available');
    }

    const collection = db.collection('verifications');
    
    // Get existing indexes
    const indexes = await collection.indexes();
    logger.info('Existing indexes:', indexes);
    
    // Check if token index exists
    const tokenIndex = indexes.find((idx: any) => 
      idx.key && idx.key.token === 1
    );
    
    if (tokenIndex) {
      logger.info('Found existing token index, dropping it...');
      await collection.dropIndex('token_1');
      logger.info('Dropped old token index');
    }
    
    // Create new sparse unique index
    logger.info('Creating new sparse unique index on token...');
    await collection.createIndex(
      { token: 1 },
      { 
        unique: true, 
        sparse: true,
        name: 'token_1'
      }
    );
    logger.info('Successfully created sparse unique index on token');
    
    // Verify the new index
    const newIndexes = await collection.indexes();
    const newTokenIndex = newIndexes.find((idx: any) => 
      idx.key && idx.key.token === 1
    );
    logger.info('New token index:', newTokenIndex);
    
    logger.info('Index migration completed successfully!');
    process.exit(0);
  } catch (error: any) {
    logger.error('Error fixing verification index:', {
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  }
}

fixVerificationIndex();





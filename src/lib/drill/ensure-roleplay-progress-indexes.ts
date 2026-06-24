import RoleplayDrillProgress from '@/models/roleplay-drill-progress';
import { logger } from '@/lib/api/logger';

const INDEX_NAMES = {
  assignment: 'userId_1_drillAssignmentId_1',
  challenge: 'userId_1_challengeId_1_challengeItemIndex_1',
} as const;

function indexNeedsReplacement(
  idx: { partialFilterExpression?: Record<string, unknown> } | undefined,
  expectedSource: 'assignment' | 'weekly_challenge',
): boolean {
  if (!idx) return false;
  const source = idx.partialFilterExpression?.source;
  return source !== expectedSource;
}

/**
 * Replace legacy sparse unique indexes that treat (userId, null, null) as one slot
 * with partial indexes scoped to assignment vs weekly_challenge source.
 */
export async function ensureRoleplayProgressIndexes(): Promise<{
  dropped: string[];
  errors: string[];
  challengeIndexSource: string | null;
}> {
  const collection = RoleplayDrillProgress.collection;
  const dropped: string[] = [];
  const errors: string[] = [];

  let indexes = await collection.indexes();

  for (const [kind, name] of Object.entries(INDEX_NAMES) as Array<
    [keyof typeof INDEX_NAMES, string]
  >) {
    const idx = indexes.find((i) => i.name === name);
    const expectedSource = kind === 'assignment' ? 'assignment' : 'weekly_challenge';
    if (indexNeedsReplacement(idx, expectedSource)) {
      try {
        await collection.dropIndex(name);
        dropped.push(name);
        logger.info('Dropped legacy roleplay progress index', { name });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`drop ${name}: ${message}`);
        logger.warn('Failed to drop roleplay progress index', { name, message });
      }
    }
  }

  try {
    await collection.createIndex(
      { userId: 1, drillAssignmentId: 1 },
      {
        unique: true,
        partialFilterExpression: {
          source: 'assignment',
          drillAssignmentId: { $type: 'objectId' },
        },
        name: INDEX_NAMES.assignment,
      },
    );
    await collection.createIndex(
      { userId: 1, challengeId: 1, challengeItemIndex: 1 },
      {
        unique: true,
        partialFilterExpression: {
          source: 'weekly_challenge',
          challengeId: { $type: 'objectId' },
        },
        name: INDEX_NAMES.challenge,
      },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    errors.push(`create: ${message}`);
    logger.warn('Failed to create roleplay progress indexes', { message });
  }

  indexes = await collection.indexes();
  const challengeIdx = indexes.find((i) => i.name === INDEX_NAMES.challenge);
  const challengeIndexSource =
    (challengeIdx?.partialFilterExpression?.source as string | undefined) ?? null;

  return { dropped, errors, challengeIndexSource };
}

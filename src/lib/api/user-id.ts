// Shared utilities for handling dual-format user identifiers.
//
// Better Auth (web sign-up, including Google/Apple OAuth) generates UUID
// string `_id`s for users (see `generateId: () => crypto.randomUUID()` in
// better-auth.ts). Legacy accounts and mobile OAuth accounts (created via
// verify-id-token) use standard 24-char hex MongoDB ObjectIds.
//
// Any code that does `new Types.ObjectId(someUserId)` will throw for UUID
// users. These helpers let callers build queries that work for both formats
// without duplicating format-detection logic everywhere.
import { Types } from 'mongoose';

/**
 * True only for 24-char hex strings that Mongoose/MongoDB treat as ObjectIds.
 */
export function isObjectId(id: unknown): id is string {
	return typeof id === 'string' && Types.ObjectId.isValid(id) && /^[0-9a-fA-F]{24}$/.test(id);
}

/**
 * True for either a valid ObjectId string or a UUID string (Better Auth user id).
 * Rejects empty strings, non-strings, and other malformed values.
 */
export function isValidUserId(id: unknown): id is string {
	if (typeof id !== 'string' || id.length === 0) return false;
	if (isObjectId(id)) return true;
	// RFC 4122-ish UUID check (also accepts the loosely-formatted UUIDs
	// crypto.randomUUID() produces, which are always canonical v4 anyway).
	return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(id);
}

/**
 * Returns the correct Mongoose query value for a user/learner id field.
 * - ObjectId-shaped id -> Types.ObjectId (matches stored BSON ObjectId)
 * - UUID-shaped id -> the original string (matches stored string _id)
 *
 * Throws if the id is neither format, to surface bad input early instead of
 * silently matching zero documents.
 */
export function toUserIdQuery(id: string): Types.ObjectId | string {
	if (isObjectId(id)) {
		return new Types.ObjectId(id);
	}
	if (isValidUserId(id)) {
		return id;
	}
	throw new Error(`toUserIdQuery: "${id}" is not a valid ObjectId or UUID user id`);
}

/**
 * Builds a de-duplicated array of query values (Types.ObjectId | string) for
 * use in a Mongo `$in` clause, supporting a mix of ObjectId and UUID users in
 * the same array.
 */
export function toUserIdQueryMulti(ids: string[]): Array<Types.ObjectId | string> {
	const seen = new Set<string>();
	const result: Array<Types.ObjectId | string> = [];
	for (const id of ids) {
		if (seen.has(id)) continue;
		seen.add(id);
		result.push(toUserIdQuery(id));
	}
	return result;
}

/**
 * Returns a raw MongoDB driver filter for `_id` that works for both formats,
 * for use with `db.collection(...).findOne(...)` calls that bypass Mongoose's
 * schema-based casting (e.g. auth middleware working directly against the
 * `users` collection).
 */
export function toRawUserIdFilter(id: string): { _id: Types.ObjectId | string } {
	return { _id: toUserIdQuery(id) };
}

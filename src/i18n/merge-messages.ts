type JsonRecord = Record<string, unknown>;

function isPlainObject(v: unknown): v is JsonRecord {
  return (
    v !== null &&
    typeof v === "object" &&
    !Array.isArray(v) &&
    Object.getPrototypeOf(v) === Object.prototype
  );
}

/**
 * Deep-merge `override` onto `base`. Nested objects merge; leaves in `override` replace `base`.
 * Used so partial locale files fall back to English for missing keys.
 */
export function mergeMessages<T extends JsonRecord>(base: T, override: unknown): T {
  if (!override || !isPlainObject(override as object)) return base;
  const ov = override as JsonRecord;
  const out: JsonRecord = { ...base };
  for (const key of Object.keys(ov)) {
    const b = out[key];
    const o = ov[key];
    if (isPlainObject(b) && isPlainObject(o)) {
      out[key] = mergeMessages(b as JsonRecord, o);
    } else if (o !== undefined) {
      out[key] = o;
    }
  }
  return out as T;
}

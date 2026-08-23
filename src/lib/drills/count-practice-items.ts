function len(arr: unknown): number {
  return Array.isArray(arr) ? arr.length : 0;
}

/** Best-effort practice-item count from general Drill content fields. */
export function countDrillPracticeItems(drill: {
  target_sentences?: unknown;
  pronunciation_items?: unknown;
  matching_pairs?: unknown;
  definition_items?: unknown;
  grammar_items?: unknown;
  sentence_writing_items?: unknown;
  fill_blank_items?: unknown;
  key_phrase_items?: unknown;
  roleplay_scenes?: unknown;
  roleplay_dialogue?: unknown;
  listening_drill_content?: string;
  listening_drill_title?: string;
  article_content?: string;
  article_title?: string;
  sentence_drill_word?: string;
}): number {
  const fromArrays =
    len(drill.target_sentences) +
    len(drill.pronunciation_items) +
    len(drill.matching_pairs) +
    len(drill.definition_items) +
    len(drill.grammar_items) +
    len(drill.sentence_writing_items) +
    len(drill.fill_blank_items) +
    len(drill.key_phrase_items) +
    len(drill.roleplay_scenes);

  if (fromArrays > 0) return fromArrays;

  if (drill.listening_drill_content || drill.listening_drill_title) return 1;
  if (drill.article_content || drill.article_title) return 1;
  if (drill.sentence_drill_word) return 1;
  if (len(drill.roleplay_dialogue) > 0) return 1;

  return 0;
}

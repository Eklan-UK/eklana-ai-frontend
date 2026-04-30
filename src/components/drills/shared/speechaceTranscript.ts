import type { TextScore } from "@/services/speechace.service";

/** Best-effort transcript from Speechace scoring (word alignment + fallback text field). */
export function transcriptFromTextScore(
  textScore: TextScore | null | undefined
): string {
  if (!textScore) return "";
  const fromWords = textScore.word_score_list
    ?.map((w) => w.word)
    .filter(Boolean)
    .join(" ")
    .trim();
  if (fromWords) return fromWords;
  return (textScore.text || "").trim();
}

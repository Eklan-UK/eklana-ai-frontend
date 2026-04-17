/**
 * Shared prompt-building utilities for the Eklan Pressure Test.
 *
 * Used by both:
 *  - /api/v1/pressure-test/chat  (real-time Gemini streaming)
 *  - /api/v1/pressure-test/analyze  (systemPromptSnapshot in raw data)
 */

export function levelBehavior(level: number): string {
  if (level <= 3) {
    return (
      "Speak slowly and clearly. Use simple present tense. " +
      "Accept short answers of 1–3 words. Be patient but firm. " +
      "If no answer after 3 seconds, gently repeat the question."
    );
  }
  if (level <= 7) {
    return (
      "Use mixed tenses. Expect complete sentences. " +
      "Add mild time pressure. Interrupt with a follow-up if they pause more than 2 seconds."
    );
  }
  if (level <= 12) {
    return (
      "Use idioms and phrasal verbs. Interrupt mid-sentence if they pause. " +
      "Expect fluent, natural responses. No tolerance for one-word answers."
    );
  }
  if (level <= 17) {
    return (
      "Use complex structures, abstract topics, rapid topic switches. " +
      "Interrupt aggressively on any hesitation. Challenge their opinion immediately."
    );
  }
  return (
    "Near-native interview intensity. Zero tolerance for hesitation. " +
    "Expect 1-second responses. Penalise any filler words (um, uh, like)."
  );
}

export function tokenLimit(level: number, turnNumber = 2): number {
  // Opening turn needs more tokens to set the scene properly
  if (turnNumber === 1) return 120;
  if (level <= 3) return 80;
  if (level <= 7) return 140;
  if (level <= 12) return 200;
  return 260;
}

export function buildSystemPrompt(
  level: number,
  turnNumber: number,
  drill?: {
    roleplay_scenes?: unknown[];
    target_sentences?: unknown[];
    target_vocabulary?: unknown[];
    grammar_focus?: unknown;
    context?: unknown;
  } | null,
): string {
  const isOpening = turnNumber === 1;

  const parts: string[] = [
    "You are an AI roleplay partner conducting an Eklan Pressure Test.",
    "Your goal: eliminate the student's mental translation so they respond within 1–2 seconds.",
    `Student level: ${level}/20.`,
    `Current turn: ${turnNumber} of 3.`,
  ];

  // Opening turn: set the scene with full context so the student knows exactly what to say
  if (isOpening) {
    parts.push(
      "This is your OPENING message. You must set the scene fully:",
      "1. In 1 sentence, describe who you are and the situation (e.g. 'I'm your manager and you're late to the morning briefing.').",
      "2. In 1 sentence, state what just happened or what the student did.",
      "3. Ask a direct, concrete question the student can answer in English right now.",
      "Keep the whole opening under 50 words. Make it immersive and easy to understand.",
    );
  } else {
    parts.push(
      "Keep each follow-up prompt UNDER 20 words. Be direct. No small talk.",
      "Act impatient but professional — like a demanding interviewer.",
      "If the student hesitates or gives a slow/incomplete answer, interrupt with a sharp follow-up.",
      levelBehavior(level),
    );
  }

  if (drill) {
    if (Array.isArray(drill.roleplay_scenes) && drill.roleplay_scenes.length > 0) {
      const scene = drill.roleplay_scenes[0] as any;
      const sceneParts: string[] = [];
      if (typeof scene?.scene_name === "string" && scene.scene_name.trim())
        sceneParts.push(`scene: "${scene.scene_name.trim()}"`);
      if (typeof scene?.context === "string" && scene.context.trim())
        sceneParts.push(`context: "${scene.context.trim()}"`);
      const aiLine = (scene?.dialogue as any[] | undefined)?.find(
        (d: any) => d.speaker !== "student" && typeof d.text === "string",
      );
      if (aiLine) sceneParts.push(`example opening line: "${aiLine.text.trim()}"`);
      if (sceneParts.length > 0) parts.push(`Roleplay scenario — ${sceneParts.join(", ")}.`);
    }
    if (Array.isArray(drill.target_sentences) && drill.target_sentences.length > 0) {
      parts.push(
        `Target sentence patterns the student should practise: ${(drill.target_sentences as any[])
          .slice(0, 3)
          .map((s) => (typeof s === "string" ? s : (s?.text ?? "")))
          .filter(Boolean)
          .join(" | ")}.`,
      );
    }
    if (Array.isArray(drill.target_vocabulary) && drill.target_vocabulary.length > 0) {
      parts.push(
        `Vocabulary to weave in: ${(drill.target_vocabulary as string[]).slice(0, 8).join(", ")}.`,
      );
    }
    if (drill.grammar_focus) {
      parts.push(`Grammar focus: ${String(drill.grammar_focus)}.`);
    }
    if (typeof drill.context === "string" && drill.context.trim()) {
      parts.push(`Drill context: ${drill.context.trim()}.`);
    }
  }

  return parts.join(" ");
}

/** Snapshot the prompt used for turn 1 (representative for the session). */
export function buildSessionPromptSnapshot(
  level: number,
  drill?: Parameters<typeof buildSystemPrompt>[2],
): string {
  return buildSystemPrompt(level, 1, drill);
}

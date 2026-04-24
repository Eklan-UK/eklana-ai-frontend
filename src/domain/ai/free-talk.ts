/**
 * Free Talk + Roleplay shared helpers (prompts, URL params, vocabulary matching).
 */

/**
 * Decodes a vocab query param: JSON array (preferred) or pipe‑separated list (legacy).
 */
export function parseVocabListParam(raw: string | null | undefined): string[] {
	if (!raw?.trim()) return [];
	const decoded = decodeURIComponent(raw.trim());
	try {
		const parsed = JSON.parse(decoded) as unknown;
		if (Array.isArray(parsed)) {
			return parsed.map((x) => String(x).trim()).filter(Boolean);
		}
	} catch {
		/* not JSON */
	}
	return decoded
		.split("|")
		.map((s) => s.trim())
		.filter(Boolean);
}

export function encodeVocabListForUrl(words: string[]): string {
	if (words.length === 0) return "";
	return encodeURIComponent(JSON.stringify(words));
}

function escapeRegex(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Returns canonical vocabulary entries that appear in the user's text (word / phrase).
 */
export function findVocabularyUsedInText(
	userText: string,
	canonicalVocabulary: string[]
): string[] {
	const text = userText || "";
	if (!text.trim() || canonicalVocabulary.length === 0) return [];

	const used = new Set<string>();
	for (const entry of canonicalVocabulary) {
		const phrase = (entry || "").trim();
		if (!phrase) continue;
		if (phrase.includes(" ")) {
			if (text.toLowerCase().includes(phrase.toLowerCase())) {
				used.add(phrase);
			}
		} else {
			const re = new RegExp(`\\b${escapeRegex(phrase)}\\b`, "i");
			if (re.test(text)) used.add(phrase);
		}
	}
	return [...used];
}

export type DrillFreeTalkOverlay = {
	scenarioDescription: string;
	vocabularyList: string[];
	/** Index into `roleplay_scenes` when the URL selected a specific scene. */
	activeSceneIndex: number | null;
	/**
	 * Formatted script lines from the tutor (per-scene `dialogue` or top-level `roleplay_dialogue`)
	 * so the model matches interview / technical / roleplay content, not a generic chat.
	 */
	referenceScript: string;
};

function labelDialogueSpeaker(
	speaker: string,
	studentName: string | undefined,
	aiNames: string[] | undefined
): string {
	const s = (speaker || "").trim();
	if (s === "student")
		return (studentName && studentName.trim()) || "Student";
	const m = /^ai_(\d+)$/.exec(s);
	if (m) {
		const i = parseInt(m[1], 10);
		if (aiNames && aiNames[i] != null && String(aiNames[i]).trim() !== "")
			return String(aiNames[i]).trim();
		return `Interviewer/Partner ${i + 1}`;
	}
	return s || "Speaker";
}

function coerceDialogueLines(
	raw: unknown[] | undefined
): Array<{ speaker: string; text: string }> {
	if (!Array.isArray(raw) || !raw.length) return [];
	return raw
		.map((l) => {
			if (!l || typeof l !== "object") return { speaker: "", text: "" };
			const rec = l as Record<string, unknown>;
			const speaker = String(rec.speaker ?? rec.role ?? "");
			const text = String(
				rec.text ?? rec.line ?? (typeof rec.content === "string" ? rec.content : "") ?? ""
			);
			return { speaker, text };
		})
		.filter((l) => l.speaker || l.text.trim());
}

/**
 * Merges legacy single `ai_character_name` with `ai_character_names` for label lookup (ai_0, ai_1, …).
 */
export function resolveAiNameList(drill: {
	ai_character_name?: string;
	ai_character_names?: string[];
}): string[] | undefined {
	if (Array.isArray(drill.ai_character_names) && drill.ai_character_names.length > 0) {
		const names = drill.ai_character_names
			.map((n) => (n == null ? "" : String(n).trim()))
			.filter(Boolean);
		if (names.length) return names;
	}
	if (drill.ai_character_name && String(drill.ai_character_name).trim() !== "")
		return [String(drill.ai_character_name).trim()];
	return undefined;
}

/**
 * Flattens tutor dialogue lines for inclusion in the system prompt.
 */
export function formatDrillDialogueForPrompt(
	lines: Array<{ speaker: string; text: string }> | unknown[] | undefined,
	studentName: string | undefined,
	aiNames: string[] | undefined
): string {
	const normalized = Array.isArray(lines) ? coerceDialogueLines(lines) : [];
	if (!normalized.length) return "";
	return normalized
		.map((l) => `${labelDialogueSpeaker(l.speaker, studentName, aiNames)}: ${(l.text || "").trim()}`)
		.filter((row) => row.length > 3)
		.join("\n");
}

/**
 * Resolves a focused scene from a drill for Free Talk + roleplay.
 */
export function resolveDrillFreeTalkOverlay(
	drill: {
		title?: string;
		context?: string;
		roleplay_scenes?: any[];
		roleplay_dialogue?: any[];
		student_character_name?: string;
		ai_character_name?: string;
		ai_character_names?: string[];
	},
	scenarioId: string | null | undefined,
	vocabularyList: string[] | undefined
): DrillFreeTalkOverlay | null {
	const v = (vocabularyList || []).map((s) => String(s).trim()).filter(Boolean);
	const raw =
		scenarioId != null && scenarioId !== "" ? String(scenarioId).trim() : "";
	const idx = raw ? parseInt(raw, 10) : NaN;

	const studentName = drill.student_character_name;
	const aiNames = resolveAiNameList(drill);

	let scenarioDescription = "";
	const validSceneIndex =
		raw !== "" &&
		Number.isInteger(idx) &&
		idx >= 0 &&
		drill.roleplay_scenes &&
		drill.roleplay_scenes[idx]
			? idx
			: null;

	if (validSceneIndex != null) {
		const scene = drill.roleplay_scenes![validSceneIndex];
		const title = scene.scene_name || scene.title || scene.name;
		const ctx = scene.context || scene.description;
		const setting = scene.setting;
		const parts: string[] = [];
		if (title) parts.push(String(title));
		if (ctx) parts.push(String(ctx));
		if (setting) parts.push(`Setting: ${setting}`);
		scenarioDescription = parts.length > 0 ? parts.join(" — ") : "";
	}
	if (!scenarioDescription && v.length > 0) {
		const fallback = [drill.context, drill.title].filter(Boolean).join(" — ") || "English practice";
		scenarioDescription = fallback;
	}
	if (!scenarioDescription && v.length === 0) return null;

	let referenceScript = "";
	if (validSceneIndex != null) {
		const scene = drill.roleplay_scenes![validSceneIndex];
		const perScene = scene?.dialogue;
		if (Array.isArray(perScene) && perScene.length > 0) {
			referenceScript = formatDrillDialogueForPrompt(perScene, studentName, aiNames);
		}
	}
	// Do NOT use top-level `roleplay_dialogue` as a stand-in for one scene: it often contains
	// *all* scenes' lines, which makes Interview + Technical run together. Only use it when
	// no specific scene is selected, or the drill is effectively single-scene.
	const sceneCount = Array.isArray(drill.roleplay_scenes) ? drill.roleplay_scenes.length : 0;
	if (
		!referenceScript &&
		Array.isArray(drill.roleplay_dialogue) &&
		drill.roleplay_dialogue.length > 0
	) {
		if (validSceneIndex == null || sceneCount <= 1) {
			referenceScript = formatDrillDialogueForPrompt(
				drill.roleplay_dialogue,
				studentName,
				aiNames
			);
		}
	}

	return {
		scenarioDescription,
		vocabularyList: v,
		activeSceneIndex: validSceneIndex,
		referenceScript,
	};
}

export function buildFreeTalkSystemInstruction(input: {
	topic: string | null;
	scenarioDescription: string | null;
	vocabularyList: string[];
}): string {
	const topicLabel = input.topic
		? input.topic === "pressure-test"
			? "Ekln Pressure Test — short, high-tempo practice"
			: `Topic: ${input.topic.replace(/-/g, " ")}`
		: "General English conversation";

	let instruction = `You are Eklan, a warm English practice partner. ${topicLabel}.\n`;

	if (input.scenarioDescription) {
		instruction += `\nSESSION SETTING (keep the conversation in this world):\n${input.scenarioDescription}\n`;
	}
	if (input.vocabularyList.length > 0) {
		instruction += `\nTARGET WORDS for this session (weave them into dialogue naturally; praise correct usage; gentle corrections if misused):\n${input.vocabularyList.map((w, i) => `${i + 1}. ${w}`).join("\n")}\n`;
	}
	instruction += `\nKeep responses concise, natural, and conversational (typically 2–4 sentences). Do not use JSON or code blocks.`;
	return instruction;
}

/**
 * Shorter context string for the Live / voice free-talk pipeline.
 */
export function buildFreeTalkVoiceContextPrompt(input: {
	topic: string | null;
	scenarioDescription: string | null;
	vocabularyList: string[];
}): string {
	const base = input.topic
		? input.topic === "pressure-test"
			? "Ekln Pressure Test: respond quickly. Keep replies brief. Nudge the user to answer fast when appropriate."
			: `Practice English in a ${input.topic.replace(/-/g, " ")} conversation. Be natural, encouraging, and conversational.`
		: "Practice English conversation. Be natural, encouraging, and conversational.";

	if (!input.scenarioDescription && input.vocabularyList.length === 0) {
		return base;
	}
	let extra = "";
	if (input.scenarioDescription) {
		extra += ` SESSION SETTING: ${input.scenarioDescription}`;
	}
	if (input.vocabularyList.length > 0) {
		extra += ` TARGET WORDS: ${input.vocabularyList.join(", ")}. Use these in context and praise the learner when they use them well.`;
	}
	return `${base}${extra}`;
}

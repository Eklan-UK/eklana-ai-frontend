import type {
	PrecisionClinicDrillType,
	PrecisionClinicDifficulty,
	ClinicSoundGroup,
	ClinicKeyPhraseQuestion,
	ClinicMatchingPair,
	ClinicGrammarPattern,
	ClinicSentenceWritingWord,
} from '@/hooks/usePrecisionClinic';
import {
	PRECISION_CLINIC_DRILL_TYPE_LABELS,
} from '@/hooks/usePrecisionClinic';
import type {
	ClinicCreateFormState,
	ClinicAiModalState,
} from './clinic-create.types';

export const CLINIC_TYPE_SUBTITLES: Record<PrecisionClinicDrillType, string> = {
	pronunciation: 'Target specific sounds with grouped words and practice sentences.',
	key_phrases: 'Add multiple-choice questions with prompts and correct answers.',
	matching: 'Add pairs for students to match. Optional translations for context.',
	grammar: 'Define grammar patterns with example sentences and optional hints.',
	sentence_writing: 'Provide words or expressions for students to write sentences with.',
	listening: 'Add content that students will listen to using text-to-speech.',
	summary: 'Provide an article for students to read and summarise.',
};

export function getDefaultCompletionDate(): string {
	const d = new Date();
	d.setDate(d.getDate() + 7);
	return d.toISOString().slice(0, 10);
}

export function emptySoundGroup(): ClinicSoundGroup {
	return {
		targetSound: '',
		words: [{ word: '', practiceSentence: '' }],
	};
}

export function emptyQuestion(): ClinicKeyPhraseQuestion {
	return {
		respondentName: '',
		prompt: '',
		options: ['', ''],
		correctAnswer: '',
	};
}

export function emptyPair(): ClinicMatchingPair {
	return { left: '', right: '', leftTranslation: '', rightTranslation: '' };
}

export function emptyPattern(): ClinicGrammarPattern {
	return { pattern: '', exampleSentence: '', hint: '' };
}

export function emptyWord(): ClinicSentenceWritingWord {
	return { word: '', hint: '' };
}

export function getDefaultClinicForm(
	type: PrecisionClinicDrillType = 'pronunciation'
): ClinicCreateFormState {
	return {
		title: '',
		type,
		difficulty: 'beginner',
		context: '',
		completionDate: getDefaultCompletionDate(),
		durationDays: 7,
		preGenerateAudio: true,
		ttsVoiceKey: '',
		assignedLearnerIds: [],
		soundGroups: [emptySoundGroup()],
		questions: [emptyQuestion()],
		pairs: [emptyPair()],
		patterns: [emptyPattern()],
		words: [emptyWord()],
		contentTitle: '',
		content: '',
		articleTitle: '',
		articleContent: '',
		importedText: '',
	};
}

export function getDefaultAiModalState(
	form: ClinicCreateFormState
): ClinicAiModalState {
	return {
		studentIds: [...form.assignedLearnerIds],
		title: form.title,
		drillTypes: [form.type],
		difficulty: form.difficulty,
		context: form.context,
		prompt: '',
	};
}

export function learnerDisplayName(user: {
	firstName?: string;
	lastName?: string;
	name?: string;
	email?: string;
}): string {
	const full = `${user.firstName || ''} ${user.lastName || ''}`.trim();
	return full || user.name || user.email || 'Unknown';
}

export function learnerInitials(name: string): string {
	const parts = name.trim().split(/\s+/).filter(Boolean);
	if (parts.length === 0) return '?';
	if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
	return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}

/** Map API / AI document into form state. */
export function formFromClinicDrill(drill: Record<string, unknown>): ClinicCreateFormState {
	const type = (drill.type as PrecisionClinicDrillType) || 'pronunciation';
	const base = getDefaultClinicForm(type);
	const completion =
		typeof drill.completionDate === 'string'
			? drill.completionDate.slice(0, 10)
			: drill.completionDate
				? new Date(drill.completionDate as string).toISOString().slice(0, 10)
				: base.completionDate;

	const assigned = Array.isArray(drill.assignedLearnerIds)
		? drill.assignedLearnerIds.map((id) => String(id))
		: [];

	return {
		...base,
		title: String(drill.title ?? ''),
		type,
		difficulty: (drill.difficulty as PrecisionClinicDifficulty) || 'beginner',
		context: String(drill.context ?? ''),
		completionDate: completion,
		durationDays:
			typeof drill.durationDays === 'number' && drill.durationDays > 0
				? drill.durationDays
				: 7,
		preGenerateAudio: Boolean(drill.preGenerateAudio ?? true),
		ttsVoiceKey: String(drill.ttsVoiceKey ?? ''),
		assignedLearnerIds: assigned,
		soundGroups:
			Array.isArray(drill.soundGroups) && drill.soundGroups.length > 0
				? (drill.soundGroups as ClinicSoundGroup[])
				: base.soundGroups,
		questions:
			Array.isArray(drill.questions) && drill.questions.length > 0
				? (drill.questions as ClinicKeyPhraseQuestion[])
				: base.questions,
		pairs:
			Array.isArray(drill.pairs) && drill.pairs.length > 0
				? (drill.pairs as ClinicMatchingPair[])
				: base.pairs,
		patterns:
			Array.isArray(drill.patterns) && drill.patterns.length > 0
				? (drill.patterns as ClinicGrammarPattern[])
				: base.patterns,
		words:
			Array.isArray(drill.words) && drill.words.length > 0
				? (drill.words as ClinicSentenceWritingWord[])
				: base.words,
		contentTitle: String(drill.contentTitle ?? ''),
		content: String(drill.content ?? ''),
		articleTitle: String(drill.articleTitle ?? ''),
		articleContent: String(drill.articleContent ?? ''),
		importedText: '',
	};
}

/** Apply AI generate result content into form fields. */
export function applyAiContentToForm(
	form: ClinicCreateFormState,
	result: {
		drillType?: string;
		title?: string;
		content?: Record<string, unknown>;
	}
): ClinicCreateFormState {
	const content = result.content ?? {};
	const type = (result.drillType as PrecisionClinicDrillType) || form.type;
	const next: ClinicCreateFormState = {
		...form,
		type,
		title: result.title?.trim() || form.title,
	};

	if (Array.isArray(content.soundGroups) && content.soundGroups.length > 0) {
		next.soundGroups = content.soundGroups as ClinicSoundGroup[];
	}
	if (Array.isArray(content.questions) && content.questions.length > 0) {
		next.questions = content.questions as ClinicKeyPhraseQuestion[];
	}
	if (Array.isArray(content.pairs) && content.pairs.length > 0) {
		next.pairs = content.pairs as ClinicMatchingPair[];
	}
	if (Array.isArray(content.patterns) && content.patterns.length > 0) {
		next.patterns = content.patterns as ClinicGrammarPattern[];
	}
	if (Array.isArray(content.words) && content.words.length > 0) {
		next.words = content.words as ClinicSentenceWritingWord[];
	}
	if (typeof content.contentTitle === 'string') {
		next.contentTitle = content.contentTitle;
	}
	if (typeof content.content === 'string') {
		next.content = content.content;
	}
	if (typeof content.articleTitle === 'string') {
		next.articleTitle = content.articleTitle;
	}
	if (typeof content.articleContent === 'string') {
		next.articleContent = content.articleContent;
	}

	return next;
}

function trimOptional(value: string | undefined): string | undefined {
	const t = (value ?? '').trim();
	return t || undefined;
}

export function buildCreatePayload(
	form: ClinicCreateFormState,
	opts: { requireAssignment: boolean }
): Record<string, unknown> {
	const assignedLearnerIds = opts.requireAssignment
		? form.assignedLearnerIds
		: form.assignedLearnerIds;

	const payload: Record<string, unknown> = {
		title: form.title.trim(),
		type: form.type,
		difficulty: form.difficulty,
		context: form.context.trim(),
		completionDate: form.completionDate
			? new Date(`${form.completionDate}T23:59:59.000Z`).toISOString()
			: null,
		durationDays: Math.max(1, Number(form.durationDays) || 7),
		preGenerateAudio: form.preGenerateAudio,
		ttsVoiceKey: form.ttsVoiceKey.trim() || null,
		assignedLearnerIds,
	};

	switch (form.type) {
		case 'pronunciation':
			payload.soundGroups = form.soundGroups
				.map((g) => ({
					targetSound: g.targetSound.trim(),
					words: (g.words ?? [])
						.map((w) => ({
							word: w.word.trim(),
							practiceSentence: w.practiceSentence.trim(),
						}))
						.filter((w) => w.word && w.practiceSentence),
				}))
				.filter((g) => g.targetSound && g.words.length > 0);
			break;
		case 'key_phrases':
			payload.questions = form.questions
				.map((q) => ({
					respondentName: trimOptional(q.respondentName),
					prompt: q.prompt.trim(),
					options: (q.options ?? []).map((o) => o.trim()).filter(Boolean),
					correctAnswer: q.correctAnswer.trim(),
				}))
				.filter((q) => q.prompt && q.options.length >= 2 && q.correctAnswer);
			break;
		case 'matching':
			payload.pairs = form.pairs
				.map((p) => ({
					left: p.left.trim(),
					right: p.right.trim(),
					leftTranslation: trimOptional(p.leftTranslation),
					rightTranslation: trimOptional(p.rightTranslation),
				}))
				.filter((p) => p.left && p.right);
			break;
		case 'grammar':
			payload.patterns = form.patterns
				.map((p) => ({
					pattern: p.pattern.trim(),
					exampleSentence: p.exampleSentence.trim(),
					hint: trimOptional(p.hint),
				}))
				.filter((p) => p.pattern && p.exampleSentence);
			break;
		case 'sentence_writing':
			payload.words = form.words
				.map((w) => ({
					word: w.word.trim(),
					hint: trimOptional(w.hint),
				}))
				.filter((w) => w.word);
			break;
		case 'listening':
			payload.contentTitle = form.contentTitle.trim();
			payload.content = form.content.trim() || form.importedText.trim();
			break;
		case 'summary':
			payload.articleTitle = form.articleTitle.trim();
			payload.articleContent =
				form.articleContent.trim() || form.importedText.trim();
			break;
	}

	return payload;
}

export function validateClinicForm(
	form: ClinicCreateFormState,
	opts: { requireAssignment: boolean }
): string | null {
	if (!form.type) return 'Select a drill type';
	if (opts.requireAssignment && form.assignedLearnerIds.length === 0) {
		return 'Select at least one student to assign';
	}

	switch (form.type) {
		case 'pronunciation': {
			const groups = form.soundGroups.filter(
				(g) =>
					g.targetSound.trim() &&
					g.words.some((w) => w.word.trim() && w.practiceSentence.trim())
			);
			if (groups.length === 0) {
				return 'Add at least one sound group with a word and practice sentence';
			}
			break;
		}
		case 'key_phrases': {
			const ok = form.questions.some(
				(q) =>
					q.prompt.trim() &&
					q.options.filter((o) => o.trim()).length >= 2 &&
					q.correctAnswer.trim() &&
					q.options.map((o) => o.trim()).includes(q.correctAnswer.trim())
			);
			if (!ok) {
				return 'Add at least one question with 2+ options and a valid correct answer';
			}
			break;
		}
		case 'matching': {
			if (!form.pairs.some((p) => p.left.trim() && p.right.trim())) {
				return 'Add at least one matching pair';
			}
			break;
		}
		case 'grammar': {
			if (
				!form.patterns.some(
					(p) => p.pattern.trim() && p.exampleSentence.trim()
				)
			) {
				return 'Add at least one grammar pattern with an example sentence';
			}
			break;
		}
		case 'sentence_writing': {
			if (!form.words.some((w) => w.word.trim())) {
				return 'Add at least one word or expression';
			}
			break;
		}
		case 'listening': {
			if (!(form.content.trim() || form.importedText.trim())) {
				return 'Add listening content';
			}
			break;
		}
		case 'summary': {
			if (!(form.articleContent.trim() || form.importedText.trim())) {
				return 'Add article content';
			}
			break;
		}
	}

	return null;
}

export function downloadClinicTemplate(type: PrecisionClinicDrillType): void {
	const label = PRECISION_CLINIC_DRILL_TYPE_LABELS[type];
	const rows: string[][] = (() => {
		switch (type) {
			case 'pronunciation':
				return [
					['targetSound', 'word', 'practiceSentence'],
					['R/L', 'priority', 'My priority is to improve my English this year.'],
				];
			case 'key_phrases':
				return [
					['respondentName', 'prompt', 'option1', 'option2', 'option3', 'correctAnswer'],
					[
						'Nurse',
						'A patient says they are in pain. What do you say?',
						'Where does it hurt?',
						'Go home now.',
						'That is fine.',
						'Where does it hurt?',
					],
				];
			case 'matching':
				return [
					['left', 'right', 'leftTranslation', 'rightTranslation'],
					['hypertension', 'high blood pressure', '', ''],
				];
			case 'grammar':
				return [
					['pattern', 'exampleSentence', 'hint'],
					['present perfect', 'I have worked here for five years.', 'Use have/has + past participle'],
				];
			case 'sentence_writing':
				return [
					['word', 'hint'],
					['assess', 'Check a patient condition'],
				];
			case 'listening':
				return [
					['contentTitle', 'content'],
					['Ward Handover', 'Nurse A: The patient in bed 3 has...'],
				];
			case 'summary':
				return [
					['articleTitle', 'articleContent'],
					['Patient Education', 'Hand hygiene is essential...'],
				];
		}
	})();

	const csv = rows
		.map((row) =>
			row
				.map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
				.join(',')
		)
		.join('\n');
	const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = `precision-clinic-${type}-template.csv`;
	document.body.appendChild(a);
	a.click();
	URL.revokeObjectURL(url);
	document.body.removeChild(a);
	void label;
}

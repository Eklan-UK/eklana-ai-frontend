import { Types } from 'mongoose';
import DrillAttempt from '@/models/drill-attempt';
import PronunciationAttemptModel from '@/models/pronunciation-attempt';
import FreeTalkAttempt from '@/models/free-talk-attempt';
import Bookmark from '@/models/bookmark';
import type { IDrillAttempt } from '@/models/drill-attempt';
import type { IPronunciationAttempt } from '@/models/pronunciation-attempt';
import type { IFreeTalkAttempt } from '@/models/free-talk-attempt';
import type { WeaknessSignal, WeaknessProfile } from './types';

function clamp(value: number): number {
	return Math.max(0, Math.min(1, value));
}

function severityFromScore(score: number): number {
	return clamp(1 - score / 100);
}

function extractPronunciationSignals(
	pronAttempts: IPronunciationAttempt[]
): WeaknessSignal[] {
	if (pronAttempts.length === 0) return [];

	const avgTextScore =
		pronAttempts.reduce((sum, a) => sum + a.textScore, 0) / pronAttempts.length;
	const avgFluency =
		pronAttempts.reduce((sum, a) => sum + (a.fluencyScore ?? a.textScore), 0) /
		pronAttempts.length;

	// Collect unique incorrect phonemes (from SpeechAce's flat incorrectPhonemes field)
	const phonemeFreq = new Map<string, number>();
	for (const attempt of pronAttempts) {
		for (const p of attempt.incorrectPhonemes ?? []) {
			phonemeFreq.set(p, (phonemeFreq.get(p) ?? 0) + 1);
		}
	}
	const topPhonemes = [...phonemeFreq.entries()]
		.sort((a, b) => b[1] - a[1])
		.slice(0, 5)
		.map(([p]) => p);

	// Collect scored phonemes from wordScores[].phonemes[] for finer-grained data
	const phonemeScoreMap = new Map<string, number[]>();
	for (const attempt of pronAttempts) {
		for (const ws of attempt.wordScores ?? []) {
			for (const p of ws.phonemes ?? []) {
				const list = phonemeScoreMap.get(p.phoneme) ?? [];
				list.push(p.score);
				phonemeScoreMap.set(p.phoneme, list);
			}
		}
	}
	// Only consider phonemes seen at least twice to filter out one-off noise
	const weakScoredPhonemes = [...phonemeScoreMap.entries()]
		.filter(([, scores]) => scores.length >= 2)
		.map(([phoneme, scores]) => ({
			phoneme,
			avg: scores.reduce((s, v) => s + v, 0) / scores.length,
		}))
		.filter(({ avg }) => avg < 70)
		.sort((a, b) => a.avg - b.avg)
		.slice(0, 5);

	const signals: WeaknessSignal[] = [];

	if (avgTextScore < 85) {
		signals.push({
			drillType: 'pronunciation',
			category: 'pronunciation',
			severity: severityFromScore(avgTextScore),
			evidence: [
				`Average pronunciation score: ${avgTextScore.toFixed(1)}`,
				...(topPhonemes.length > 0
					? [`Weak phonemes: ${topPhonemes.join(', ')}`]
					: []),
			],
			label:
				topPhonemes.length > 0
					? `Pronunciation — phonemes: ${topPhonemes.join(', ')}`
					: 'Pronunciation accuracy',
		});
	}

	if (avgFluency < 80) {
		signals.push({
			drillType: 'pronunciation',
			category: 'fluency',
			severity: severityFromScore(avgFluency),
			evidence: [`Average fluency score: ${avgFluency.toFixed(1)}`],
			label: 'Fluency',
		});
	}

	// Surface consistently weak phonemes from scored data even when overall scores
	// pass the threshold above — ensures generation always has phoneme-level evidence.
	if (weakScoredPhonemes.length > 0 && avgTextScore >= 85) {
		const labels = weakScoredPhonemes.map(({ phoneme, avg }) => `${phoneme} (${avg.toFixed(0)})`);
		signals.push({
			drillType: 'pronunciation',
			category: 'pronunciation',
			severity: severityFromScore(weakScoredPhonemes[0].avg),
			evidence: [`Consistently weak phonemes: ${labels.join(', ')}`],
			label: `Phoneme accuracy — ${weakScoredPhonemes.slice(0, 3).map((p) => p.phoneme).join(', ')}`,
		});
	}

	return signals;
}

function extractVocabularySignals(
	attempts: IDrillAttempt[],
	drillType: 'vocabulary' | 'key_phrases'
): WeaknessSignal[] {
	const weakWords: string[] = [];
	let totalScore = 0;
	let count = 0;

	for (const attempt of attempts) {
		const wordScores =
			drillType === 'vocabulary'
				? attempt.vocabularyResults?.wordScores
				: attempt.keyPhrasesResults?.items?.map((item) => ({
						word: item.prompt,
						score: item.pronunciationScore ?? (item.isCorrect ? 100 : 0),
						attempts: item.attempts,
						pronunciationScore: item.pronunciationScore,
					}));

		if (!wordScores) continue;

		for (const ws of wordScores) {
			const score = ws.pronunciationScore ?? ws.score;
			totalScore += score;
			count++;
			if (score < 70 || (ws.attempts > 2)) {
				weakWords.push(ws.word ?? (ws as { prompt?: string }).prompt ?? '');
			}
		}
	}

	if (count === 0) return [];
	const avg = totalScore / count;
	if (avg >= 85 && weakWords.length === 0) return [];

	const uniqueWeak = [...new Set(weakWords)].slice(0, 5);
	return [
		{
			drillType,
			category: 'vocabulary',
			severity: severityFromScore(avg),
			evidence: [
				`Average score: ${avg.toFixed(1)}`,
				...(uniqueWeak.length > 0
					? [`Struggled with: ${uniqueWeak.join(', ')}`]
					: []),
			],
			label:
				drillType === 'key_phrases' ? 'Key phrases accuracy' : 'Vocabulary pronunciation',
		},
	];
}

function extractRoleplaySignals(attempts: IDrillAttempt[]): WeaknessSignal[] {
	let fluencyTotal = 0;
	let pronTotal = 0;
	let count = 0;

	for (const attempt of attempts) {
		for (const scene of attempt.roleplayResults?.sceneScores ?? []) {
			fluencyTotal += scene.fluencyScore ?? scene.score;
			pronTotal += scene.pronunciationScore ?? scene.score;
			count++;
		}
	}

	if (count === 0) return [];

	const avgFluency = fluencyTotal / count;
	const avgPron = pronTotal / count;
	const signals: WeaknessSignal[] = [];

	if (avgFluency < 75) {
		signals.push({
			drillType: 'roleplay',
			category: 'fluency',
			severity: severityFromScore(avgFluency),
			evidence: [`Average roleplay fluency: ${avgFluency.toFixed(1)}`],
			label: 'Roleplay fluency',
		});
	}

	if (avgPron < 75) {
		signals.push({
			drillType: 'roleplay',
			category: 'pronunciation',
			severity: severityFromScore(avgPron),
			evidence: [`Average roleplay pronunciation: ${avgPron.toFixed(1)}`],
			label: 'Roleplay pronunciation',
		});
	}

	return signals;
}

function extractAccuracySignals(
	attempts: IDrillAttempt[],
	drillType: 'fill_blank' | 'matching' | 'definition'
): WeaknessSignal[] {
	const accuracies: number[] = [];

	for (const attempt of attempts) {
		let accuracy: number | undefined;

		if (drillType === 'fill_blank') {
			const r = attempt.fillBlankResults;
			if (r?.totalBlanks && r.totalBlanks > 0) {
				accuracy = r.score ?? ((r.correctBlanks ?? 0) / r.totalBlanks) * 100;
			}
		} else if (drillType === 'matching') {
			const r = attempt.matchingResults;
			if (r?.accuracy != null) accuracy = r.accuracy;
		} else {
			const r = attempt.definitionResults;
			if (r?.accuracy != null) accuracy = r.accuracy;
		}

		if (accuracy != null) accuracies.push(accuracy);
	}

	if (accuracies.length === 0) return [];

	const avg = accuracies.reduce((s, v) => s + v, 0) / accuracies.length;
	if (avg >= 80) return [];

	const categoryMap: Record<string, WeaknessSignal['category']> = {
		fill_blank: 'grammar',
		matching: 'vocabulary',
		definition: 'vocabulary',
	};

	return [
		{
			drillType,
			category: categoryMap[drillType],
			severity: severityFromScore(avg),
			evidence: [`Average accuracy: ${avg.toFixed(1)}%`],
			label: `${drillType.replace('_', ' ')} accuracy`,
		},
	];
}

function extractGrammarSignals(attempts: IDrillAttempt[]): WeaknessSignal[] {
	let scoreTotal = 0;
	let count = 0;
	const weakPatterns: string[] = [];

	for (const attempt of attempts) {
		const r = attempt.grammarResults;
		if (!r) continue;

		if (r.accuracy != null) {
			scoreTotal += r.accuracy * 100;
			count++;
		}

		for (const ps of r.patternScores ?? []) {
			if (ps.score < 70 || ps.attempts > 2) {
				weakPatterns.push(ps.pattern);
			}
		}
	}

	if (count === 0 && weakPatterns.length === 0) return [];

	const avg = count > 0 ? scoreTotal / count : 50;
	if (avg >= 80 && weakPatterns.length === 0) return [];

	const uniqueWeak = [...new Set(weakPatterns)].slice(0, 5);
	return [
		{
			drillType: 'grammar',
			category: 'grammar',
			severity: severityFromScore(avg),
			evidence: [
				`Average grammar accuracy: ${avg.toFixed(1)}%`,
				...(uniqueWeak.length > 0
					? [`Weak patterns: ${uniqueWeak.join(', ')}`]
					: []),
			],
			label: 'Grammar accuracy',
		},
	];
}

function buildPronunciationFrequencySignal(
	attempts: IPronunciationAttempt[]
): WeaknessSignal | null {
	if (attempts.length === 0) return null;

	const phonemeFreq = new Map<string, number>();
	const wordFreq = new Map<string, number>();

	for (const attempt of attempts) {
		for (const p of attempt.incorrectPhonemes ?? []) {
			if (p) phonemeFreq.set(p, (phonemeFreq.get(p) ?? 0) + 1);
		}
		for (const ws of attempt.wordScores ?? []) {
			if (ws.score < 70 && ws.word) {
				wordFreq.set(ws.word, (wordFreq.get(ws.word) ?? 0) + 1);
			}
		}
	}

	if (phonemeFreq.size === 0 && wordFreq.size === 0) return null;

	const topPhonemes = [...phonemeFreq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
	const topWords = [...wordFreq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
	const topCount = topPhonemes[0]?.[1] ?? topWords[0]?.[1] ?? 0;
	const severity = clamp(topCount / 8);

	const evidence: string[] = [];
	if (topPhonemes.length > 0) {
		evidence.push(`Frequent phoneme errors: ${topPhonemes.map(([p]) => p).join(', ')}`);
	}
	if (topWords.length > 0) {
		evidence.push(`Low-scoring words: ${topWords.map(([w]) => w).join(', ')}`);
	}

	const label =
		topPhonemes.length > 0
			? `Pronunciation — recurring phonemes: ${topPhonemes.slice(0, 3).map(([p]) => p).join(', ')}`
			: `Pronunciation — low-scoring words: ${topWords.slice(0, 3).map(([w]) => w).join(', ')}`;

	return { drillType: 'pronunciation', category: 'pronunciation', severity, evidence, label };
}

function buildBookmarkSignal(
	bookmarks: Array<{ content: string }>
): WeaknessSignal | null {
	if (bookmarks.length === 0) return null;

	const contentFreq = new Map<string, number>();
	for (const bm of bookmarks) {
		if (bm.content) contentFreq.set(bm.content, (contentFreq.get(bm.content) ?? 0) + 1);
	}
	if (contentFreq.size === 0) return null;

	const topContents = [...contentFreq.entries()]
		.sort((a, b) => b[1] - a[1])
		.slice(0, 5)
		.map(([content]) => content);

	const severity = clamp(contentFreq.size / 10);

	return {
		drillType: 'vocabulary',
		category: 'vocabulary',
		severity,
		evidence: topContents,
		label: `Bookmarked vocabulary (${contentFreq.size} item${contentFreq.size !== 1 ? 's' : ''})`,
	};
}

async function computeAllTimePhonemeAnalysis(
	learnerId: Types.ObjectId,
	tenDaysAgo: Date
): Promise<{ signal: WeaknessSignal | null; masteredPhonemes: string[] }> {
	const [allTimePhonemes, recentPhonemeScores] = await Promise.all([
		PronunciationAttemptModel.aggregate([
			{ $match: { learnerId } },
			{ $unwind: '$incorrectPhonemes' },
			{ $match: { incorrectPhonemes: { $nin: [null, ''] } } },
			{ $group: { _id: '$incorrectPhonemes', count: { $sum: 1 } } },
			{ $sort: { count: -1 } },
			{ $limit: 10 },
		]),
		PronunciationAttemptModel.aggregate([
			{ $match: { learnerId, createdAt: { $gte: tenDaysAgo } } },
			{ $unwind: '$incorrectPhonemes' },
			{ $match: { incorrectPhonemes: { $nin: [null, ''] } } },
			{ $group: { _id: '$incorrectPhonemes', avgScore: { $avg: '$textScore' } } },
		]),
	]);

	if ((allTimePhonemes as unknown[]).length === 0) return { signal: null, masteredPhonemes: [] };

	const recentScoreMap = new Map<string, number>(
		(recentPhonemeScores as Array<{ _id: string; avgScore: number }>).map((r) => [r._id, r.avgScore])
	);

	const masteredPhonemes: string[] = [];
	const difficultPhonemes: Array<{ phoneme: string; count: number }> = [];

	for (const { _id: phoneme, count } of allTimePhonemes as Array<{ _id: string; count: number }>) {
		const recentAvg = recentScoreMap.get(phoneme);
		if (recentAvg != null && recentAvg >= 80) {
			masteredPhonemes.push(phoneme);
		} else {
			difficultPhonemes.push({ phoneme, count });
		}
	}

	if (difficultPhonemes.length === 0) return { signal: null, masteredPhonemes };

	const severity = clamp(difficultPhonemes[0].count / 30);

	return {
		signal: {
			drillType: 'pronunciation',
			category: 'pronunciation',
			severity,
			evidence: [
				`All-time difficult phonemes: ${difficultPhonemes.map((d) => d.phoneme).join(', ')}`,
			],
			label: `Pronunciation — persistent phonemes: ${difficultPhonemes.slice(0, 3).map((d) => d.phoneme).join(', ')}`,
		},
		masteredPhonemes,
	};
}

function deduplicateByDrillType(signals: WeaknessSignal[]): WeaknessSignal[] {
	const byDrillType = new Map<string, WeaknessSignal>();
	for (const signal of signals) {
		const existing = byDrillType.get(signal.drillType);
		if (!existing) {
			byDrillType.set(signal.drillType, { ...signal, evidence: [...signal.evidence] });
		} else {
			if (signal.severity > existing.severity) existing.label = signal.label;
			existing.severity = Math.max(existing.severity, signal.severity);
			const seen = new Set(existing.evidence);
			for (const e of signal.evidence) {
				if (!seen.has(e)) {
					existing.evidence.push(e);
					seen.add(e);
				}
			}
		}
	}
	return [...byDrillType.values()];
}

function pickTopFour(signals: WeaknessSignal[]): WeaknessSignal[] {
	const sorted = [...signals].sort((a, b) => b.severity - a.severity);
	const preferred = ['pronunciation', 'vocabulary', 'roleplay', 'key_phrases'];
	const picked: WeaknessSignal[] = [];
	const usedTypes = new Set<string>();

	for (const dt of preferred) {
		const signal = sorted.find((s) => s.drillType === dt);
		if (signal) {
			picked.push(signal);
			usedTypes.add(dt);
		}
		if (picked.length === 4) break;
	}

	for (const signal of sorted) {
		if (picked.length >= 4) break;
		if (!usedTypes.has(signal.drillType)) {
			picked.push(signal);
			usedTypes.add(signal.drillType);
		}
	}

	return picked.sort((a, b) => b.severity - a.severity);
}

export async function aggregateWeaknesses(
	learnerId: Types.ObjectId,
	weekStartDate: Date
): Promise<WeaknessProfile> {
	const now = new Date();

	// 6-day window for existing drill / free-talk signals
	const weekStartLookback = new Date(now);
	weekStartLookback.setUTCDate(weekStartLookback.getUTCDate() - 10);
	weekStartLookback.setUTCHours(0, 0, 0, 0);
	const dateFilter = { $gte: weekStartLookback, $lt: now };

	// 10-day window for new pronunciation-frequency and bookmark signals
	const tenDaysAgo = new Date(now);
	tenDaysAgo.setUTCDate(tenDaysAgo.getUTCDate() - 10);

	const [
		drillAttempts,
		pronAttempts,
		freeTalkAttempts,
		recentPronAttempts,
		recentBookmarks,
		allTimeAnalysis,
	] = await Promise.all([
		DrillAttempt.find({ learnerId, completedAt: dateFilter }).lean() as Promise<IDrillAttempt[]>,
		PronunciationAttemptModel.find({ learnerId, createdAt: dateFilter }).lean() as Promise<IPronunciationAttempt[]>,
		FreeTalkAttempt.find({ learnerId, createdAt: dateFilter }).lean() as Promise<IFreeTalkAttempt[]>,
		PronunciationAttemptModel.find({ learnerId, createdAt: { $gte: tenDaysAgo } }).lean() as Promise<IPronunciationAttempt[]>,
		Bookmark.find({
			userId: learnerId,
			createdAt: { $gte: tenDaysAgo },
			type: { $in: ['word', 'sentence'] },
		}).lean(),
		computeAllTimePhonemeAnalysis(learnerId, tenDaysAgo),
	]);

	// Group drill attempts by type
	const byType = new Map<string, IDrillAttempt[]>();
	for (const attempt of drillAttempts) {
		const type = inferDrillType(attempt);
		if (!type) continue;
		const bucket = byType.get(type) ?? [];
		bucket.push(attempt);
		byType.set(type, bucket);
	}

	const freqSignal = buildPronunciationFrequencySignal(recentPronAttempts);
	const bmSignal = buildBookmarkSignal(recentBookmarks as Array<{ content: string }>);

	const allSignals: WeaknessSignal[] = [
		...extractPronunciationSignals(pronAttempts),
		...extractVocabularySignals(byType.get('vocabulary') ?? [], 'vocabulary'),
		...extractVocabularySignals(byType.get('key_phrases') ?? [], 'key_phrases'),
		...extractRoleplaySignals(byType.get('roleplay') ?? []),
		...extractAccuracySignals(byType.get('fill_blank') ?? [], 'fill_blank'),
		...extractAccuracySignals(byType.get('matching') ?? [], 'matching'),
		...extractAccuracySignals(byType.get('definition') ?? [], 'definition'),
		...extractGrammarSignals(byType.get('grammar') ?? []),
		...extractFreeTalkSignals(freeTalkAttempts),
		// sentence, summary, listening: skipped — no reliable automated weakness signal
		...(freqSignal ? [freqSignal] : []),
		...(bmSignal ? [bmSignal] : []),
		...(allTimeAnalysis.signal ? [allTimeAnalysis.signal] : []),
	];

	const meaningful = allSignals.filter((s) => s.severity > 0);
	const deduplicated = deduplicateByDrillType(meaningful);
	deduplicated.sort((a, b) => b.severity - a.severity);
	const topFour = pickTopFour(deduplicated);

	return {
		learnerId,
		weekStartDate,
		weaknesses: deduplicated,
		topWeaknesses: topFour,
		masteredPhonemes: allTimeAnalysis.masteredPhonemes.length > 0 ? allTimeAnalysis.masteredPhonemes : undefined,
		generatedAt: new Date(),
	};
}

function extractFreeTalkSignals(attempts: IFreeTalkAttempt[]): WeaknessSignal[] {
	const graded = attempts.filter((a) => a.gradeResult !== null);
	if (graded.length === 0) return [];

	const weakBehaviourNames: string[] = [];
	let severitySum = 0;

	for (const attempt of graded) {
		const { overallScore, maxScore, behaviours } = attempt.gradeResult!;
		if (maxScore > 0) {
			severitySum += clamp(1 - overallScore / maxScore);
		}
		for (const b of behaviours) {
			if (b.result === 'none' || b.result === 'partial') {
				weakBehaviourNames.push(b.name);
			}
		}
	}

	if (weakBehaviourNames.length === 0) return [];

	const severity = clamp(severitySum / graded.length);

	const scenarioTypeFreq = new Map<string, number>();
	for (const attempt of graded) {
		if (!attempt.scenarioType) continue;
		const t = attempt.scenarioType;
		scenarioTypeFreq.set(t, (scenarioTypeFreq.get(t) ?? 0) + 1);
	}
	const topScenarioType = [...scenarioTypeFreq.entries()].sort((a, b) => b[1] - a[1])[0][0];

	const uniqueWeakNames = [...new Set(weakBehaviourNames)].slice(0, 5);

	return [
		{
			drillType: 'free_talk',
			category: 'fluency',
			severity,
			evidence: uniqueWeakNames,
			label: `Clinical communication — ${topScenarioType}`,
		},
	];
}

function inferDrillType(attempt: IDrillAttempt): string | null {
	return attempt.drillType ?? null;
}

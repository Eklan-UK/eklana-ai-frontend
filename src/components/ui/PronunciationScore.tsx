"use client";

import { CheckCircle, XCircle, AlertCircle, TrendingUp, Award, BarChart3 } from "lucide-react";
import { Card } from "./Card";
import type { TextScore, WordScore, PhoneScore, SyllableScore } from "@/services/speechace-direct.service";

interface PronunciationScoreProps {
	textScore: TextScore;
}

export function PronunciationScore({ textScore }: PronunciationScoreProps) {
	const getScoreColor = (score: number) => {
		if (score >= 80) return "text-green-600";
		if (score >= 60) return "text-yellow-600";
		return "text-red-600";
	};

	const getScoreBgColor = (score: number) => {
		if (score >= 80) return "bg-green-100";
		if (score >= 60) return "bg-yellow-100";
		return "bg-red-100";
	};

	const getScoreIcon = (score: number) => {
		if (score >= 80) return <CheckCircle className="w-5 h-5 text-green-600" />;
		if (score >= 60) return <AlertCircle className="w-5 h-5 text-yellow-600" />;
		return <XCircle className="w-5 h-5 text-red-600" />;
	};

	const mainScore = textScore.speechace_score.pronunciation;

	return (
		<div className="space-y-4">
			{/* Overall Score */}
			<Card className="bg-gradient-to-br from-green-50 to-blue-50 border-green-200">
				<div className="flex items-center justify-between mb-4">
					<div className="flex items-center gap-3">
						<div
							className={`w-16 h-16 rounded-full ${getScoreBgColor(
								mainScore
							)} flex items-center justify-center`}
						>
							<span className={`text-2xl font-bold ${getScoreColor(mainScore)}`}>
								{Math.round(mainScore)}
							</span>
						</div>
						<div>
							<p className="text-sm font-medium text-gray-600">Speechace Score</p>
							<p className="text-xs text-gray-500">Pronunciation Accuracy</p>
						</div>
					</div>
					{getScoreIcon(mainScore)}
				</div>
				<p className="text-sm text-gray-700 font-medium mb-2">Text: "{textScore.text}"</p>
			</Card>

			{/* Test Scores */}
			<Card>
				<h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
					<Award className="w-4 h-4" />
					Test Scores
				</h3>
				<div className="grid grid-cols-2 gap-3">
					<div className="p-3 bg-blue-50 rounded-lg">
						<p className="text-xs text-gray-600 mb-1">IELTS</p>
						<p className="text-lg font-bold text-blue-600">
							{textScore.ielts_score.pronunciation}
						</p>
					</div>
					<div className="p-3 bg-primary-50 rounded-lg">
						<p className="text-xs text-gray-600 mb-1">PTE</p>
						<p className="text-lg font-bold text-primary-600">
							{textScore.pte_score.pronunciation}
						</p>
					</div>
					<div className="p-3 bg-orange-50 rounded-lg">
						<p className="text-xs text-gray-600 mb-1">TOEIC</p>
						<p className="text-lg font-bold text-orange-600">
							{textScore.toeic_score.pronunciation}
						</p>
					</div>
					<div className="p-3 bg-green-50 rounded-lg">
						<p className="text-xs text-gray-600 mb-1">CEFR</p>
						<p className="text-lg font-bold text-green-600">
							{textScore.cefr_score.pronunciation}
						</p>
					</div>
				</div>
			</Card>

			{/* Word-by-Word Scores */}
			{textScore.word_score_list.map((wordScore, wordIndex) => (
				<Card key={wordIndex}>
					<div className="flex items-center justify-between mb-4">
						<div>
							<h3 className="text-base font-semibold text-gray-900">
								{wordScore.word}
							</h3>
							<p className="text-xs text-gray-500">Word Quality Score</p>
						</div>
						<div
							className={`w-14 h-14 rounded-full ${getScoreBgColor(
								wordScore.quality_score
							)} flex items-center justify-center`}
						>
							<span
								className={`text-lg font-bold ${getScoreColor(
									wordScore.quality_score
								)}`}
							>
								{Math.round(wordScore.quality_score)}
							</span>
						</div>
					</div>

					{/* Syllable Breakdown */}
					{wordScore.syllable_score_list.length > 0 && (
						<div className="mb-4">
							<h4 className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1">
								<BarChart3 className="w-3 h-3" />
								Syllables
							</h4>
							<div className="flex gap-2 flex-wrap">
								{wordScore.syllable_score_list.map((syllable, sylIndex) => (
									<div
										key={sylIndex}
										className="flex-1 min-w-[80px] p-2 bg-gray-50 rounded-lg"
									>
										<p className="text-xs font-medium text-gray-900 mb-1">
											{syllable.letters}
										</p>
										<div className="flex items-center justify-between">
											<span
												className={`text-xs font-bold ${getScoreColor(
													syllable.quality_score
												)}`}
											>
												{Math.round(syllable.quality_score)}
											</span>
											{syllable.stress_level !== null && (
												<span className="text-xs text-gray-500">
													Stress: {syllable.stress_level}
												</span>
											)}
										</div>
									</div>
								))}
							</div>
						</div>
					)}

					{/* Phone (Phoneme) Breakdown */}
					{wordScore.phone_score_list.length > 0 && (
						<div>
							<h4 className="text-xs font-semibold text-gray-700 mb-2">
								Phonemes
							</h4>
							<div className="flex gap-1 flex-wrap">
								{wordScore.phone_score_list.map((phone, phoneIndex) => (
									<div
										key={phoneIndex}
										className={`px-2 py-1 rounded text-xs font-medium ${getScoreBgColor(
											phone.quality_score
										)} ${getScoreColor(phone.quality_score)}`}
										title={`${phone.phone}: ${Math.round(phone.quality_score)}%`}
									>
										{phone.phone}
										<span className="ml-1 text-[10px]">
											{Math.round(phone.quality_score)}
										</span>
									</div>
								))}
							</div>
						</div>
					)}
				</Card>
			))}
		</div>
	);
}


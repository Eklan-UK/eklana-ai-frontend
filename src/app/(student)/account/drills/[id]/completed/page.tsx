"use client";

import React from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  ArrowLeft,
  CheckCircle,
  Clock,
  Target,
  BookOpen,
  Loader2,
  AlertCircle,
  XCircle,
  Clock3,
  FileText,
} from "lucide-react";
import Link from "next/link";
import { apiRequest } from "@/lib/api";
import { formatDate, getDrillTypeInfo } from "@/utils/drill";
import { useQuery } from "@tanstack/react-query";

interface DrillAttempt {
  _id: string;
  score?: number;
  timeSpent: number;
  completedAt?: string;
  vocabularyResults?: {
    wordScores: Array<{
      word: string;
      score: number;
      attempts: number;
      pronunciationScore?: number;
    }>;
  };
  roleplayResults?: {
    sceneScores: Array<{
      sceneName: string;
      score: number;
      fluencyScore?: number;
      pronunciationScore?: number;
    }>;
  };
  matchingResults?: {
    pairsMatched: number;
    totalPairs: number;
    accuracy: number;
    incorrectPairs?: Array<{
      left: string;
      right: string;
      attemptedMatch: string;
    }>;
  };
  definitionResults?: {
    wordsDefined: number;
    totalWords: number;
    accuracy: number;
    wordScores: Array<{
      word: string;
      score: number;
      attempts: number;
    }>;
  };
  grammarResults?: {
    patternsPracticed?: number;
    totalPatterns?: number;
    accuracy?: number;
    patternScores?: Array<{
      pattern: string;
      score: number;
      attempts: number;
    }>;
    // New reviewable structure
    patterns?: Array<{
      pattern: string;
      example: string;
      hint?: string;
      sentences: Array<{ text: string; index: number }>;
    }>;
    reviewStatus?: "pending" | "reviewed";
    patternReviews?: Array<{
      patternIndex: number;
      sentenceIndex: number;
      isCorrect: boolean;
      correctedText?: string;
      reviewedAt?: string;
      reviewedBy?: any;
    }>;
  };
  sentenceWritingResults?: {
    sentencesWritten: number;
    totalSentences: number;
    accuracy: number;
    wordScores: Array<{
      word: string;
      score: number;
      attempts: number;
    }>;
  };
  sentenceResults?: {
    word: string;
    definition: string;
    sentences: Array<{
      text: string;
      index: number;
    }>;
    // Multi-word support
    words?: Array<{
      word: string;
      definition: string;
      sentences: Array<{
        text: string;
        index: number;
      }>;
    }>;
    reviewStatus: "pending" | "reviewed";
    sentenceReviews?: Array<{
      sentenceIndex: number;
      isCorrect: boolean;
      correctedText?: string;
      reviewedAt?: string;
      reviewedBy?: any;
    }>;
  };
  summaryResults?: {
    summaryProvided: boolean;
    articleTitle?: string;
    articleContent?: string;
    summary?: string;
    wordCount?: number;
    score?: number;
    qualityScore?: number;
    reviewStatus?: "pending" | "reviewed";
    review?: {
      feedback?: string;
      isAcceptable: boolean;
      correctedVersion?: string;
      reviewedAt?: string;
      reviewedBy?: any;
    };
  };
  listeningResults?: {
    completed: boolean;
    timeSpent: number;
  };
}

interface DrillAssignment {
  _id: string;
  drillId: {
    _id: string;
    title: string;
    type: string;
    difficulty: string;
  };
  dueDate?: string;
  completedAt?: string;
  status: string;
}

// Review Status Badge Component
function ReviewStatusBadge({
  status,
  correctCount,
  totalCount,
  isSummary,
  isAcceptable,
}: {
  status: "pending" | "reviewed" | undefined;
  correctCount?: number;
  totalCount?: number;
  isSummary?: boolean;
  isAcceptable?: boolean;
}) {
  if (status === "reviewed") {
    // For summary drills, show Acceptable/Needs Improvement
    if (isSummary) {
      return (
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${isAcceptable
              ? "bg-green-100 text-green-700"
              : "bg-amber-100 text-amber-700"
            }`}
        >
          {isAcceptable ? (
            <CheckCircle className="w-4 h-4" />
          ) : (
            <AlertCircle className="w-4 h-4" />
          )}
          <span className="text-sm font-medium">
            {isAcceptable ? "Acceptable" : "Needs Improvement"}
          </span>
        </div>
      );
    }

    // For other drills, show correct count
    const allCorrect = correctCount === totalCount;
    return (
      <div
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${allCorrect
            ? "bg-green-100 text-green-700"
            : "bg-amber-100 text-amber-700"
          }`}
      >
        {allCorrect ? (
          <CheckCircle className="w-4 h-4" />
        ) : (
          <AlertCircle className="w-4 h-4" />
        )}
        <span className="text-sm font-medium">
          {allCorrect
            ? "All Correct!"
            : `${correctCount}/${totalCount} Correct`}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 text-amber-600">
      <Clock3 className="w-4 h-4" />
      <span className="text-sm font-medium">Pending Review</span>
    </div>
  );
}

export default function DrillCompletedPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const drillId = params.id as string;
  const assignmentId = searchParams.get("assignmentId");

  // React Query hook to fetch drill attempt data
  const {
    data: attemptData,
    isLoading: loading,
    error: queryError,
  } = useQuery({
    queryKey: ["drills", "assignments", assignmentId, "attempts"],
    queryFn: async () => {
      if (!assignmentId) {
        throw new Error("Assignment ID is required");
      }
      const response = await apiRequest<{
        code: string;
        message: string;
        data: {
          assignment: DrillAssignment;
          attempts: DrillAttempt[];
          latestAttempt: DrillAttempt | null;
          totalAttempts: number;
        };
      }>(`/drills/assignments/${assignmentId}/attempts`, {
        method: "GET",
      });

      if (response.code === "Success" && response.data) {
        return response.data;
      }
      throw new Error("Failed to load submission");
    },
    enabled: !!assignmentId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const assignment = attemptData?.assignment || null;
  const attempt = attemptData?.latestAttempt || null;
  const error = queryError?.message || (!assignmentId ? "Assignment ID is required" : null);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  // Calculate review stats for different drill types
  const getReviewStats = () => {
    if (!attempt) return null;

    // For sentence drills
    if (attempt.sentenceResults) {
      const { reviewStatus, sentenceReviews, sentences, words } =
        attempt.sentenceResults;

      // Calculate total sentences (multi-word support)
      let totalCount = 0;
      if (words && words.length > 0) {
        totalCount = words.reduce((acc, w) => acc + (w.sentences?.length || 0), 0);
      } else {
        totalCount = sentences?.length || 0;
      }

      if (reviewStatus === "reviewed" && sentenceReviews) {
        const correctCount = sentenceReviews.filter((r) => r.isCorrect).length;
        return { status: reviewStatus, correctCount, totalCount };
      }
      return { status: reviewStatus, correctCount: 0, totalCount };
    }

    // For grammar drills
    if (attempt.grammarResults?.patterns && attempt.grammarResults.reviewStatus) {
      const { reviewStatus, patternReviews, patterns } = attempt.grammarResults;
      if (reviewStatus === "reviewed" && patternReviews) {
        const correctCount = patternReviews.filter((r) => r.isCorrect).length;
        const totalCount = patterns.reduce(
          (acc, p) => acc + (p.sentences?.length || 0),
          0
        );
        return { status: reviewStatus, correctCount, totalCount };
      }
      const totalCount = patterns.reduce(
        (acc, p) => acc + (p.sentences?.length || 0),
        0
      );
      return { status: reviewStatus, correctCount: 0, totalCount };
    }

    // For summary drills
    if (attempt.summaryResults) {
      const { reviewStatus, review } = attempt.summaryResults;
      if (reviewStatus === "reviewed" && review) {
        return {
          status: reviewStatus,
          correctCount: review.isAcceptable ? 1 : 0,
          totalCount: 1,
          isSummary: true,
          isAcceptable: review.isAcceptable,
        };
      }
      return { status: reviewStatus, correctCount: 0, totalCount: 1, isSummary: true };
    }

    return null;
  };

  const reviewStats = getReviewStats();

  const renderResults = () => {
    if (!attempt) return null;

    const drillType = assignment?.drillId?.type || "";

    switch (drillType) {
      case "vocabulary":
        if (attempt.vocabularyResults?.wordScores) {
          return (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Word Scores
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {attempt.vocabularyResults.wordScores.map((wordScore, idx) => (
                  <Card key={idx} className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-gray-900">
                          {wordScore.word}
                        </p>
                        <p className="text-sm text-gray-500">
                          Attempts: {wordScore.attempts}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-[#22c55e]">
                          {wordScore.score}%
                        </p>
                        {wordScore.pronunciationScore !== undefined && (
                          <p className="text-xs text-gray-500">
                            Pronunciation: {wordScore.pronunciationScore}%
                          </p>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          );
        }
        break;

      case "roleplay":
        if (attempt.roleplayResults?.sceneScores) {
          return (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Scene Scores
              </h3>
              <div className="space-y-3">
                {attempt.roleplayResults.sceneScores.map((scene, idx) => (
                  <Card key={idx} className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-semibold text-gray-900">
                        {scene.sceneName}
                      </p>
                      <p className="text-lg font-bold text-[#22c55e]">
                        {scene.score}%
                      </p>
                    </div>
                    <div className="flex gap-4 text-sm text-gray-600">
                      {scene.fluencyScore !== undefined && (
                        <span>Fluency: {scene.fluencyScore}%</span>
                      )}
                      {scene.pronunciationScore !== undefined && (
                        <span>Pronunciation: {scene.pronunciationScore}%</span>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          );
        }
        break;

      case "matching":
        if (attempt.matchingResults) {
          return (
            <div className="space-y-4">
              <Card className="p-6">
                <div className="grid grid-cols-3 gap-4 text-center mb-4">
                  <div>
                    <p className="text-2xl font-bold text-[#22c55e]">
                      {attempt.matchingResults.pairsMatched}
                    </p>
                    <p className="text-sm text-gray-500">Matched</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">
                      {attempt.matchingResults.totalPairs}
                    </p>
                    <p className="text-sm text-gray-500">Total</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-[#22c55e]">
                      {Math.round(attempt.matchingResults.accuracy)}%
                    </p>
                    <p className="text-sm text-gray-500">Accuracy</p>
                  </div>
                </div>
                {attempt.matchingResults.incorrectPairs &&
                  attempt.matchingResults.incorrectPairs.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <h4 className="font-semibold text-gray-900 mb-2">
                        Incorrect Matches
                      </h4>
                      <div className="space-y-2">
                        {attempt.matchingResults.incorrectPairs.map(
                          (pair, idx) => (
                            <div
                              key={idx}
                              className="text-sm text-gray-600 bg-red-50 p-2 rounded"
                            >
                              <span className="font-medium">{pair.left}</span> →{" "}
                              <span className="font-medium">{pair.right}</span>{" "}
                              (attempted: {pair.attemptedMatch})
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  )}
              </Card>
            </div>
          );
        }
        break;

      case "definition":
        if (attempt.definitionResults) {
          return (
            <div className="space-y-4">
              <Card className="p-6">
                <div className="grid grid-cols-3 gap-4 text-center mb-4">
                  <div>
                    <p className="text-2xl font-bold text-[#22c55e]">
                      {attempt.definitionResults.wordsDefined}
                    </p>
                    <p className="text-sm text-gray-500">Defined</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">
                      {attempt.definitionResults.totalWords}
                    </p>
                    <p className="text-sm text-gray-500">Total</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-[#22c55e]">
                      {Math.round(attempt.definitionResults.accuracy)}%
                    </p>
                    <p className="text-sm text-gray-500">Accuracy</p>
                  </div>
                </div>
              </Card>
              {attempt.definitionResults.wordScores &&
                attempt.definitionResults.wordScores.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">
                      Word Scores
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {attempt.definitionResults.wordScores.map(
                        (wordScore, idx) => (
                          <Card key={idx} className="p-3">
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-gray-900">
                                {wordScore.word}
                              </span>
                              <span className="text-sm font-semibold text-[#22c55e]">
                                {wordScore.score}%
                              </span>
                            </div>
                          </Card>
                        )
                      )}
                    </div>
                  </div>
                )}
            </div>
          );
        }
        break;

      case "grammar":
        // New reviewable grammar results
        if (attempt.grammarResults?.patterns) {
          const { patterns, reviewStatus, patternReviews } =
            attempt.grammarResults;
          const isReviewed = reviewStatus === "reviewed" && patternReviews;

          return (
            <div className="space-y-6">
              {patterns.map((patternItem, patternIdx) => (
                <Card key={patternIdx} className="p-6">
                  {/* Pattern Header */}
                  <div className="mb-4 pb-4 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      {patternItem.pattern}
                    </h3>
                    {patternItem.hint && (
                      <p className="text-sm text-gray-500">{patternItem.hint}</p>
                    )}
                    <div className="mt-2 bg-green-50 border border-green-200 rounded-lg p-3">
                      <p className="text-xs text-green-600 font-medium mb-1">
                        Example:
                      </p>
                      <p className="text-sm text-green-800">
                        {patternItem.example}
                      </p>
                    </div>
                  </div>

                  {/* Sentences */}
                  <div className="space-y-4">
                    <h4 className="font-medium text-gray-700">Your Sentences:</h4>
                    {patternItem.sentences?.map((sentence, sentenceIdx) => {
                      const review = isReviewed
                        ? patternReviews?.find(
                          (r) =>
                            r.patternIndex === patternIdx &&
                            r.sentenceIndex === sentence.index
                        )
                        : null;
                      const isCorrect = review?.isCorrect ?? null;

                      return (
                        <div
                          key={sentenceIdx}
                          className={`rounded-lg border-2 ${isCorrect === true
                              ? "border-green-300 bg-green-50"
                              : isCorrect === false
                                ? "border-red-200 bg-white"
                                : "border-gray-200 bg-gray-50"
                            }`}
                        >
                          <div className="p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-3 flex-1">
                                <span
                                  className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${isCorrect === true
                                      ? "bg-green-200 text-green-700"
                                      : isCorrect === false
                                        ? "bg-red-100 text-red-600"
                                        : "bg-gray-200 text-gray-600"
                                    }`}
                                >
                                  {sentence.index + 1}
                                </span>
                                <p className="text-gray-900 pt-0.5">
                                  {sentence.text}
                                </p>
                              </div>
                              {isReviewed && (
                                <div className="flex-shrink-0">
                                  {isCorrect ? (
                                    <CheckCircle className="w-6 h-6 text-green-600" />
                                  ) : (
                                    <XCircle className="w-6 h-6 text-red-500" />
                                  )}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Correction */}
                          {isReviewed &&
                            !isCorrect &&
                            review?.correctedText && (
                              <div className="border-t border-green-200 bg-green-100 p-4 rounded-b-lg">
                                <div className="flex items-start gap-2">
                                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                                  <div>
                                    <p className="text-xs font-semibold text-green-700 mb-1">
                                      Corrected Version:
                                    </p>
                                    <p className="text-green-900 font-medium">
                                      {review.correctedText}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )}
                        </div>
                      );
                    })}
                  </div>
                </Card>
              ))}

              {!isReviewed && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Clock3 className="w-5 h-5 text-amber-600" />
                    <div>
                      <p className="font-medium text-amber-800">
                        Pending Review
                      </p>
                      <p className="text-sm text-amber-700">
                        Your submission is waiting to be reviewed by your tutor.
                        You'll be notified when feedback is available.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        }
        // Legacy format
        if (attempt.grammarResults?.patternScores) {
          return (
            <div className="space-y-4">
              <Card className="p-6">
                <div className="grid grid-cols-3 gap-4 text-center mb-4">
                  <div>
                    <p className="text-2xl font-bold text-[#22c55e]">
                      {attempt.grammarResults.patternsPracticed}
                    </p>
                    <p className="text-sm text-gray-500">Practiced</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">
                      {attempt.grammarResults.totalPatterns}
                    </p>
                    <p className="text-sm text-gray-500">Total</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-[#22c55e]">
                      {Math.round(attempt.grammarResults.accuracy || 0)}%
                    </p>
                    <p className="text-sm text-gray-500">Accuracy</p>
                  </div>
                </div>
              </Card>
              {attempt.grammarResults.patternScores.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">
                    Pattern Scores
                  </h4>
                  <div className="space-y-2">
                    {attempt.grammarResults.patternScores.map(
                      (patternScore, idx) => (
                        <Card key={idx} className="p-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-700">
                              {patternScore.pattern}
                            </span>
                            <span className="text-sm font-semibold text-[#22c55e]">
                              {patternScore.score}%
                            </span>
                          </div>
                        </Card>
                      )
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        }
        break;

      case "sentence_writing":
        // Legacy format
        if (attempt.sentenceWritingResults) {
          return (
            <div className="space-y-4">
              <Card className="p-6">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-[#22c55e]">
                      {attempt.sentenceWritingResults.sentencesWritten}
                    </p>
                    <p className="text-sm text-gray-500">Written</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">
                      {attempt.sentenceWritingResults.totalSentences}
                    </p>
                    <p className="text-sm text-gray-500">Total</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-[#22c55e]">
                      {Math.round(attempt.sentenceWritingResults.accuracy)}%
                    </p>
                    <p className="text-sm text-gray-500">Accuracy</p>
                  </div>
                </div>
              </Card>
            </div>
          );
        }
      // eslint-disable-next-line no-fallthrough

      case "sentence":
        if (attempt.sentenceResults) {
          const { word, definition, sentences, words, reviewStatus, sentenceReviews } =
            attempt.sentenceResults;
          const isReviewed =
            reviewStatus === "reviewed" &&
            sentenceReviews &&
            sentenceReviews.length > 0;

          // Handle multi-word format
          const allWords =
            words && words.length > 0
              ? words
              : [{ word, definition, sentences }];

          // Calculate global sentence index for finding reviews
          const getGlobalIndex = (wordIdx: number, sentenceIdx: number) => {
            let globalIdx = 0;
            for (let i = 0; i < wordIdx; i++) {
              globalIdx += allWords[i]?.sentences?.length || 0;
            }
            return globalIdx + sentenceIdx;
          };

          return (
            <div className="space-y-6">
              {allWords.map((wordItem, wordIdx) => (
                <Card key={wordIdx} className="p-6">
                  {/* Word Header */}
                  <div className="mb-4 pb-4 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      {allWords.length > 1
                        ? `Word ${wordIdx + 1}: ${wordItem.word}`
                        : wordItem.word}
                    </h3>
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <p className="text-xs text-gray-500 mb-1">
                        Your Definition:
                      </p>
                      <p className="text-gray-900">{wordItem.definition}</p>
                    </div>
                  </div>

                  {/* Sentences */}
                  <div className="space-y-4">
                    <h4 className="font-medium text-gray-700">Your Sentences:</h4>
                    {wordItem.sentences?.map((sentence, sentenceIdx) => {
                      const globalIdx = getGlobalIndex(wordIdx, sentenceIdx);
                      const review = isReviewed
                        ? sentenceReviews?.find(
                          (r: any) =>
                            r.sentenceIndex === globalIdx ||
                            r.sentenceIndex === sentence.index
                        )
                        : null;
                      const isCorrect = review?.isCorrect ?? null;

                      return (
                        <div
                          key={sentenceIdx}
                          className={`rounded-lg border-2 ${isCorrect === true
                              ? "border-green-300 bg-green-50"
                              : isCorrect === false
                                ? "border-red-200 bg-white"
                                : "border-gray-200 bg-gray-50"
                            }`}
                        >
                          <div className="p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-3 flex-1">
                                <span
                                  className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${isCorrect === true
                                      ? "bg-green-200 text-green-700"
                                      : isCorrect === false
                                        ? "bg-red-100 text-red-600"
                                        : "bg-gray-200 text-gray-600"
                                    }`}
                                >
                                  {sentenceIdx + 1}
                                </span>
                                <p className="text-gray-900 pt-0.5">
                                  {sentence.text}
                                </p>
                              </div>
                              {isReviewed && (
                                <div className="flex-shrink-0">
                                  {isCorrect ? (
                                    <CheckCircle className="w-6 h-6 text-green-600" />
                                  ) : (
                                    <XCircle className="w-6 h-6 text-red-500" />
                                  )}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Correction */}
                          {isReviewed && !isCorrect && review?.correctedText && (
                            <div className="border-t border-green-200 bg-green-100 p-4 rounded-b-lg">
                              <div className="flex items-start gap-2">
                                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                                <div>
                                  <p className="text-xs font-semibold text-green-700 mb-1">
                                    Corrected Version:
                                  </p>
                                  <p className="text-green-900 font-medium">
                                    {review.correctedText}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </Card>
              ))}

              {!isReviewed && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Clock3 className="w-5 h-5 text-amber-600" />
                    <div>
                      <p className="font-medium text-amber-800">Pending Review</p>
                      <p className="text-sm text-amber-700">
                        Your submission is waiting to be reviewed. You'll be
                        notified when feedback is available.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        }
        break;

      case "summary":
        if (attempt.summaryResults) {
          const { summary, wordCount, reviewStatus, review, articleTitle } =
            attempt.summaryResults;
          const isReviewed = reviewStatus === "reviewed" && review;

          return (
            <div className="space-y-6">
              {/* Your Summary */}
              <Card className="p-6">
                <div className="mb-4 pb-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-green-500" />
                    Your Summary
                    {wordCount && (
                      <span className="text-sm font-normal text-gray-500 ml-2">
                        ({wordCount} words)
                      </span>
                    )}
                  </h3>
                  {articleTitle && (
                    <p className="text-sm text-gray-500 mt-1">
                      Passage: {articleTitle}
                    </p>
                  )}
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {summary || "No summary provided"}
                  </p>
                </div>
              </Card>

              {/* Review Feedback */}
              {isReviewed ? (
                <Card
                  className={`p-6 ${review.isAcceptable
                      ? "bg-green-50 border-2 border-green-200"
                      : "bg-amber-50 border-2 border-amber-200"
                    }`}
                >
                  <div className="flex items-start gap-3 mb-4">
                    {review.isAcceptable ? (
                      <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
                    ) : (
                      <AlertCircle className="w-6 h-6 text-amber-600 flex-shrink-0" />
                    )}
                    <div>
                      <h3
                        className={`font-semibold ${review.isAcceptable
                            ? "text-green-900"
                            : "text-amber-900"
                          }`}
                      >
                        {review.isAcceptable
                          ? "Great job! Your summary is acceptable."
                          : "Your summary needs improvement."}
                      </h3>
                    </div>
                  </div>

                  {/* Tutor Feedback */}
                  {review.feedback && (
                    <div className="mb-4">
                      <h4
                        className={`text-sm font-semibold mb-2 ${review.isAcceptable
                            ? "text-green-800"
                            : "text-amber-800"
                          }`}
                      >
                        Tutor Feedback:
                      </h4>
                      <p
                        className={`${review.isAcceptable
                            ? "text-green-700"
                            : "text-amber-700"
                          } leading-relaxed`}
                      >
                        {review.feedback}
                      </p>
                    </div>
                  )}

                  {/* Corrected Version */}
                  {!review.isAcceptable && review.correctedVersion && (
                    <div className="mt-4 pt-4 border-t border-green-200">
                      <h4 className="text-sm font-semibold text-green-800 mb-2 flex items-center gap-2">
                        <CheckCircle className="w-4 h-4" />
                        Improved Version:
                      </h4>
                      <div className="bg-green-100 p-4 rounded-lg">
                        <p className="text-green-900 leading-relaxed whitespace-pre-wrap">
                          {review.correctedVersion}
                        </p>
                      </div>
                    </div>
                  )}
                </Card>
              ) : (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Clock3 className="w-5 h-5 text-amber-600" />
                    <div>
                      <p className="font-medium text-amber-800">
                        Pending Review
                      </p>
                      <p className="text-sm text-amber-700">
                        Your summary is waiting to be reviewed. You'll receive
                        feedback from your tutor soon.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        }
        break;

      case "listening":
        if (attempt.listeningResults) {
          return (
            <div className="space-y-4">
              <Card className="p-6">
                <div className="text-center">
                  <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Listening Completed
                  </h3>
                  <p className="text-sm text-gray-600">
                    You successfully completed the listening drill.
                  </p>
                </div>
              </Card>
            </div>
          );
        }
        break;

      default:
        return (
          <Card className="p-6">
            <p className="text-gray-500 text-center">
              No detailed results available for this drill type.
            </p>
          </Card>
        );
    }

    return null;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-[#22c55e]" />
      </div>
    );
  }

  if (error || !assignment || !attempt) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <Link
            href="/account"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Account
          </Link>
          <Card className="p-8 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              {error || "Submission not found"}
            </h2>
            <p className="text-gray-500 mb-6">
              {error ||
                "We couldn't find the submission for this drill. Please try again."}
            </p>
            <Link href="/account">
              <Button variant="primary">Go to Account</Button>
            </Link>
          </Card>
        </div>
      </div>
    );
  }

  const typeInfo = getDrillTypeInfo(assignment.drillId.type);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/account/drills"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to My Drills
          </Link>
          <div className="flex items-center justify-between flex-wrap gap-4 mb-2">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{typeInfo.icon}</span>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {assignment.drillId.title}
                </h1>
                <p className="text-sm text-gray-500 capitalize">
                  {assignment.drillId.type.replace("_", " ")} •{" "}
                  {assignment.drillId.difficulty}
                </p>
              </div>
            </div>
            {/* Review Status Badge */}
            {reviewStats && (
              <ReviewStatusBadge
                status={reviewStats.status}
                correctCount={reviewStats.correctCount}
                totalCount={reviewStats.totalCount}
                isSummary={(reviewStats as any).isSummary}
                isAcceptable={(reviewStats as any).isAcceptable}
              />
            )}
          </div>
        </div>

        {/* Overall Score Card */}
        <Card className="p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Submission Details
            </h2>
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="w-5 h-5" />
              <span className="font-semibold">Completed</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-3xl font-bold text-[#22c55e] mb-1">
                {attempt.score || 0}%
              </p>
              <p className="text-sm text-gray-600">Overall Score</p>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Clock className="w-5 h-5 text-blue-600" />
                <p className="text-2xl font-bold text-gray-900">
                  {formatTime(attempt.timeSpent)}
                </p>
              </div>
              <p className="text-sm text-gray-600">Time Spent</p>
            </div>
            <div className="text-center p-4 bg-primary-50 rounded-lg">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Target className="w-5 h-5 text-primary-600" />
                <p className="text-2xl font-bold text-gray-900 capitalize">
                  {assignment.drillId.difficulty}
                </p>
              </div>
              <p className="text-sm text-gray-600">Difficulty</p>
            </div>
          </div>

          {attempt.completedAt && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <BookOpen className="w-4 h-4" />
                <span>Completed on: {formatDate(attempt.completedAt)}</span>
              </div>
            </div>
          )}
        </Card>

        {/* Detailed Results */}
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Detailed Results
          </h2>
          {renderResults()}
        </div>

        {/* Actions */}
        <div className="flex gap-4">
          <Link href="/account/drills" className="flex-1">
            <Button variant="primary" fullWidth>
              Back to My Drills
            </Button>
          </Link>
          {assignmentId && (
            <Link
              href={`/account/drills/${drillId}?assignmentId=${assignmentId}`}
              className="flex-1"
            >
              <Button variant="outline" fullWidth>
                View Drill Again
              </Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

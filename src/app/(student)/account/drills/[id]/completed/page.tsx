"use client";

import React, { useEffect, useState } from "react";
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
} from "lucide-react";
import Link from "next/link";
import { apiRequest } from "@/lib/api";
import { formatDate, getDrillTypeInfo } from "@/utils/drill";
import { toast } from "sonner";

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
    patternsPracticed: number;
    totalPatterns: number;
    accuracy: number;
    patternScores: Array<{
      pattern: string;
      score: number;
      attempts: number;
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
  summaryResults?: {
    summaryProvided: boolean;
    score?: number;
    wordCount?: number;
    qualityScore?: number;
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

export default function DrillCompletedPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const drillId = params.id as string;
  const assignmentId = searchParams.get("assignmentId");

  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState<DrillAttempt | null>(null);
  const [assignment, setAssignment] = useState<DrillAssignment | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!assignmentId) {
      setError("Assignment ID is required");
      setLoading(false);
      return;
    }

    const fetchAttempt = async () => {
      try {
        setLoading(true);
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
          setAssignment(response.data.assignment);
          setAttempt(response.data.latestAttempt);
        } else {
          setError("Failed to load submission");
        }
      } catch (err: any) {
        console.error("Error fetching drill attempt:", err);
        setError(err.message || "Failed to load submission");
        toast.error("Failed to load submission");
      } finally {
        setLoading(false);
      }
    };

    fetchAttempt();
  }, [assignmentId]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

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
        if (attempt.grammarResults) {
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
                      {Math.round(attempt.grammarResults.accuracy)}%
                    </p>
                    <p className="text-sm text-gray-500">Accuracy</p>
                  </div>
                </div>
              </Card>
              {attempt.grammarResults.patternScores &&
                attempt.grammarResults.patternScores.length > 0 && (
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
        break;

      case "summary":
        if (attempt.summaryResults) {
          return (
            <div className="space-y-4">
              <Card className="p-6">
                <div className="space-y-4">
                  {attempt.summaryResults.score !== undefined && (
                    <div className="text-center">
                      <p className="text-3xl font-bold text-[#22c55e]">
                        {attempt.summaryResults.score}%
                      </p>
                      <p className="text-sm text-gray-500">Overall Score</p>
                    </div>
                  )}
                  {attempt.summaryResults.wordCount !== undefined && (
                    <div className="text-center">
                      <p className="text-xl font-semibold text-gray-900">
                        {attempt.summaryResults.wordCount}
                      </p>
                      <p className="text-sm text-gray-500">Words</p>
                    </div>
                  )}
                  {attempt.summaryResults.qualityScore !== undefined && (
                    <div className="text-center">
                      <p className="text-xl font-semibold text-gray-900">
                        {attempt.summaryResults.qualityScore}%
                      </p>
                      <p className="text-sm text-gray-500">Quality Score</p>
                    </div>
                  )}
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
            href="/account"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Account
          </Link>
          <div className="flex items-center gap-3 mb-2">
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
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Target className="w-5 h-5 text-purple-600" />
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
                <span>
                  Completed on: {formatDate(attempt.completedAt)}
                </span>
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
          <Link href="/account" className="flex-1">
            <Button variant="primary" fullWidth>
              Back to Account
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


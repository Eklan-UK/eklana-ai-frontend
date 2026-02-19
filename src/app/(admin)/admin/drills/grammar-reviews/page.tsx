"use client";

import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useDrillReviews, type GrammarSubmission } from "@/hooks/useDrillReviews";
import {
  ArrowLeft,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  User,
  FileText,
  Eye,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Send,
  BookOpen,
  Lightbulb,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

interface Learner {
  _id: string;
  name: string;
  email: string;
}

interface PatternResult {
  pattern: string;
  example: string;
  hint?: string;
  sentences: Array<{ text: string; index: number }>;
}

interface GrammarResult {
  patterns?: PatternResult[];
  reviewStatus: "pending" | "reviewed";
  patternReviews?: Array<{
    patternIndex: number;
    sentenceIndex: number;
    isCorrect: boolean;
    correctedText?: string;
    reviewedAt?: string;
  }>;
}

interface Submission {
  attemptId: string;
  drill: {
    _id: string;
    title: string;
    type: string;
  };
  grammarResults: GrammarResult;
  completedAt: string;
  score?: number;
  timeSpent: number;
}

interface LearnerSubmissions {
  learner: Learner;
  submissions: Submission[];
}

// Review Modal Component
function ReviewModal({
  submission,
  onClose,
  onSubmitReview,
}: {
  submission: Submission;
  onClose: () => void;
  onSubmitReview: (
    attemptId: string,
    reviews: Array<{
      patternIndex: number;
      sentenceIndex: number;
      isCorrect: boolean;
      correctedText?: string;
    }>
  ) => void;
}) {
  const { grammarResults } = submission;
  const patterns = grammarResults.patterns || [];
  const totalPatterns = patterns.length;
  const [currentPatternIndex, setCurrentPatternIndex] = useState(0);

  const currentPattern = patterns[currentPatternIndex];
  const sentences = currentPattern?.sentences || [];
  const isAlreadyReviewed = grammarResults.reviewStatus === "reviewed";
  const existingReviews = grammarResults.patternReviews || [];

  // Initialize reviews from existing reviews if already reviewed
  const [allPatternReviews, setAllPatternReviews] = useState<
    Record<
      number,
      Array<{ isCorrect: boolean | null; correctedText: string }>
    >
  >(() => {
    const initialReviews: Record<
      number,
      Array<{ isCorrect: boolean | null; correctedText: string }>
    > = {};
    patterns.forEach((pattern, patternIdx) => {
      const patternSentences = pattern.sentences || [];
      if (isAlreadyReviewed && existingReviews.length > 0) {
        initialReviews[patternIdx] = patternSentences.map((_, sentIdx) => {
          const existing = existingReviews.find(
            (r) =>
              r.patternIndex === patternIdx && r.sentenceIndex === sentIdx
          );
          return {
            isCorrect: existing?.isCorrect ?? null,
            correctedText: existing?.correctedText || "",
          };
        });
      } else {
        initialReviews[patternIdx] = patternSentences.map(() => ({
          isCorrect: null,
          correctedText: "",
        }));
      }
    });
    return initialReviews;
  });

  const reviews = allPatternReviews[currentPatternIndex] || [];
  const setReviews = (
    newReviews:
      | Array<{ isCorrect: boolean | null; correctedText: string }>
      | ((
        prev: Array<{ isCorrect: boolean | null; correctedText: string }>
      ) => Array<{ isCorrect: boolean | null; correctedText: string }>)
  ) => {
    setAllPatternReviews((prev) => ({
      ...prev,
      [currentPatternIndex]:
        typeof newReviews === "function"
          ? newReviews(prev[currentPatternIndex] || [])
          : newReviews,
    }));
  };

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check if all patterns have been reviewed
  const canSubmit = Object.values(allPatternReviews).every((patternReviews) =>
    patternReviews.every((r) => r.isCorrect !== null)
  );

  // Check if current pattern is complete
  const isCurrentPatternComplete = reviews.every((r) => r.isCorrect !== null);

  // Navigation functions
  const goToPreviousPattern = () => {
    if (currentPatternIndex > 0) {
      setCurrentPatternIndex(currentPatternIndex - 1);
    }
  };

  const goToNextPattern = () => {
    if (currentPatternIndex < totalPatterns - 1) {
      setCurrentPatternIndex(currentPatternIndex + 1);
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit) {
      toast.error(
        "Please review all sentences for all patterns before submitting."
      );
      return;
    }

    // Validate that corrections are provided for incorrect sentences
    let hasIncorrectWithoutCorrection = false;
    let incompletePatternIndex = -1;

    Object.entries(allPatternReviews).forEach(([patternIdx, patternReviews]) => {
      const hasIssue = patternReviews.some(
        (r) => r.isCorrect === false && !r.correctedText.trim()
      );
      if (hasIssue && incompletePatternIndex === -1) {
        hasIncorrectWithoutCorrection = true;
        incompletePatternIndex = parseInt(patternIdx);
      }
    });

    if (hasIncorrectWithoutCorrection) {
      toast.error(
        "Please provide corrections for sentences marked as incorrect."
      );
      if (incompletePatternIndex !== -1) {
        setCurrentPatternIndex(incompletePatternIndex);
      }
      return;
    }

    setIsSubmitting(true);
    try {
      // Flatten all reviews
      const grammarReviews: Array<{
        patternIndex: number;
        sentenceIndex: number;
        isCorrect: boolean;
        correctedText?: string;
      }> = [];

      Object.entries(allPatternReviews).forEach(
        ([patternIdx, patternReviews]) => {
          patternReviews.forEach((r, sentIdx) => {
            grammarReviews.push({
              patternIndex: parseInt(patternIdx),
              sentenceIndex: sentIdx,
              isCorrect: r.isCorrect!,
              correctedText:
                r.isCorrect ? undefined : r.correctedText || undefined,
            });
          });
        }
      );

      await onSubmitReview(submission.attemptId, grammarReviews);
      onClose();
    } catch (error) {
      // Error handled by mutation
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Review Grammar Submission
              </h2>
              <p className="text-sm text-gray-500">{submission.drill.title}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
            >
              <XCircle className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Pattern Navigation */}
          {totalPatterns > 1 && (
            <div className="flex items-center justify-between bg-gray-50 rounded-xl p-3">
              <button
                onClick={goToPreviousPattern}
                disabled={currentPatternIndex === 0}
                className="flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>

              <div className="flex items-center gap-2">
                {patterns.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentPatternIndex(idx)}
                    className={`w-8 h-8 rounded-full text-sm font-medium transition ${idx === currentPatternIndex
                        ? "bg-pink-600 text-white"
                        : Object.values(allPatternReviews[idx] || []).every(
                          (r) => r.isCorrect !== null
                        )
                          ? "bg-green-100 text-green-700 hover:bg-green-200"
                          : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                      }`}
                  >
                    {idx + 1}
                  </button>
                ))}
              </div>

              <button
                onClick={goToNextPattern}
                disabled={currentPatternIndex === totalPatterns - 1}
                className="flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Pattern Progress Indicator */}
          {totalPatterns > 1 && (
            <div className="text-center text-sm text-gray-500">
              Pattern {currentPatternIndex + 1} of {totalPatterns}
            </div>
          )}

          {/* Pattern and Example */}
          <div className="bg-gradient-to-r from-primary-50 to-pink-50 rounded-xl p-4 border border-primary-200">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-5 h-5 text-primary-600" />
              <h3 className="text-lg font-bold text-gray-900">
                Pattern: <span className="text-primary-600">{currentPattern?.pattern}</span>
              </h3>
            </div>
            <div className="bg-white rounded-lg p-3 mb-3">
              <div className="flex items-center gap-2 mb-1">
                <BookOpen className="w-4 h-4 text-green-600" />
                <p className="text-xs font-semibold text-green-700">Example (Guide):</p>
              </div>
              <p className="text-gray-900 font-medium">"{currentPattern?.example}"</p>
            </div>
            {currentPattern?.hint && (
              <div className="flex items-start gap-2 text-sm text-amber-700">
                <Lightbulb className="w-4 h-4 mt-0.5" />
                <p>{currentPattern.hint}</p>
              </div>
            )}
          </div>

          {/* Sentences to Review */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">
              Review Student's Sentences
            </h3>

            {sentences.map((sentence, idx) => (
              <div
                key={idx}
                className={`border rounded-xl p-4 transition ${reviews[idx]?.isCorrect === true
                    ? "border-green-300 bg-green-50"
                    : reviews[idx]?.isCorrect === false
                      ? "border-red-300 bg-red-50"
                      : "border-gray-200"
                  }`}
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex-1">
                    <p className="text-xs font-medium text-gray-500 mb-1">
                      Sentence {idx + 1}
                    </p>
                    <p className="text-gray-900 font-medium">{sentence.text}</p>
                  </div>
                </div>

                {/* Review Buttons */}
                <div className="flex items-center gap-3 mb-3">
                  <button
                    onClick={() => {
                      if (isAlreadyReviewed) return;
                      const updated = [...reviews];
                      updated[idx] = { ...updated[idx], isCorrect: true };
                      setReviews(updated);
                    }}
                    disabled={isAlreadyReviewed}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${reviews[idx]?.isCorrect === true
                        ? "bg-green-600 text-white"
                        : isAlreadyReviewed
                          ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                          : "bg-gray-100 text-gray-600 hover:bg-green-100 hover:text-green-700"
                      }`}
                  >
                    <CheckCircle className="w-4 h-4" />
                    Correct
                  </button>
                  <button
                    onClick={() => {
                      if (isAlreadyReviewed) return;
                      const updated = [...reviews];
                      updated[idx] = { ...updated[idx], isCorrect: false };
                      setReviews(updated);
                    }}
                    disabled={isAlreadyReviewed}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${reviews[idx]?.isCorrect === false
                        ? "bg-red-600 text-white"
                        : isAlreadyReviewed
                          ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                          : "bg-gray-100 text-gray-600 hover:bg-red-100 hover:text-red-700"
                      }`}
                  >
                    <XCircle className="w-4 h-4" />
                    Incorrect
                  </button>
                </div>

                {/* Correction Field */}
                {reviews[idx]?.isCorrect === false && (
                  <div className="mt-3">
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      {isAlreadyReviewed
                        ? "Corrected Version:"
                        : "Corrected Version (required):"}
                    </label>
                    {isAlreadyReviewed ? (
                      <div className="bg-green-50 border border-green-200 p-3 rounded-lg">
                        <p className="text-green-900">
                          {reviews[idx]?.correctedText ||
                            "No correction provided"}
                        </p>
                      </div>
                    ) : (
                      <textarea
                        value={reviews[idx]?.correctedText || ""}
                        onChange={(e) => {
                          const updated = [...reviews];
                          updated[idx] = {
                            ...updated[idx],
                            correctedText: e.target.value,
                          };
                          setReviews(updated);
                        }}
                        placeholder="Enter the corrected sentence..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500 resize-none"
                        rows={2}
                      />
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 rounded-b-2xl">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {isAlreadyReviewed ? (
                <span className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="w-4 h-4" />
                  Already reviewed
                </span>
              ) : totalPatterns > 1 ? (
                <>
                  Pattern {currentPatternIndex + 1}/{totalPatterns} •{" "}
                  {reviews.filter((r) => r.isCorrect !== null).length}/
                  {sentences.length} sentences reviewed
                </>
              ) : (
                <>
                  {reviews.filter((r) => r.isCorrect !== null).length} of{" "}
                  {sentences.length} reviewed
                </>
              )}
            </p>
            <div className="flex items-center gap-3">
              {/* Navigation buttons in footer */}
              {totalPatterns > 1 && !isAlreadyReviewed && (
                <div className="flex items-center gap-1 mr-2">
                  <button
                    onClick={goToPreviousPattern}
                    disabled={currentPatternIndex === 0}
                    className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition disabled:opacity-30"
                    title="Previous Pattern"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={goToNextPattern}
                    disabled={currentPatternIndex === totalPatterns - 1}
                    className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition disabled:opacity-30"
                    title="Next Pattern"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              )}
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
              >
                {isAlreadyReviewed ? "Close" : "Cancel"}
              </button>
              {!isAlreadyReviewed && (
                <button
                  onClick={handleSubmit}
                  disabled={!canSubmit || isSubmitting}
                  className="flex items-center gap-2 px-6 py-2 bg-pink-600 text-white font-medium rounded-lg hover:bg-pink-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Submit Review
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Main Page Component
export default function GrammarReviewsPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<
    "pending" | "reviewed" | "all"
  >("pending");
  const [expandedLearners, setExpandedLearners] = useState<Set<string>>(
    new Set()
  );
  const [selectedSubmission, setSelectedSubmission] =
    useState<Submission | null>(null);

  // Fetch submissions using shared hook
  const { data, isLoading, error } = useDrillReviews("grammar", statusFilter, 100);

  // Review mutation
  const reviewMutation = useMutation({
    mutationFn: async ({
      attemptId,
      grammarReviews,
    }: {
      attemptId: string;
      grammarReviews: Array<{
        patternIndex: number;
        sentenceIndex: number;
        isCorrect: boolean;
        correctedText?: string;
      }>;
    }) => {
      const response = await fetch(
        `/api/v1/drills/attempts/${attemptId}/grammar-review`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ grammarReviews }),
        }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to submit review");
      }
      return response.json();
    },
    onSuccess: () => {
      toast.success("Review submitted successfully!");
      queryClient.invalidateQueries({ queryKey: ["grammar-submissions"] });
      setSelectedSubmission(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to submit review");
    },
  });

  const toggleLearner = (learnerId: string) => {
    const updated = new Set(expandedLearners);
    if (updated.has(learnerId)) {
      updated.delete(learnerId);
    } else {
      updated.add(learnerId);
    }
    setExpandedLearners(updated);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Transform to grammar-specific submissions
  const submissions: LearnerSubmissions[] = (data?.submissions || []).map(ls => ({
    learner: ls.learner,
    submissions: ls.submissions.filter((s): s is GrammarSubmission => 'grammarResults' in s) as Submission[],
  })).filter(ls => ls.submissions.length > 0);
  const totalCount = data?.pagination?.total || 0;

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin/drills">
          <button className="p-2 hover:bg-gray-100 rounded-lg transition">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Grammar Drill Reviews
          </h1>
          <p className="text-gray-500 text-sm">
            Review and grade student grammar sentences
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-xl w-fit">
        {(["pending", "reviewed", "all"] as const).map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition ${statusFilter === status
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
              }`}
          >
            {status === "pending" && (
              <span className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Pending
              </span>
            )}
            {status === "reviewed" && (
              <span className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Reviewed
              </span>
            )}
            {status === "all" && "All"}
          </button>
        ))}
      </div>

      {/* Stats */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-gray-400" />
            <span className="text-sm text-gray-600">
              <span className="font-bold text-gray-900">{totalCount}</span>{" "}
              {statusFilter === "all" ? "total" : statusFilter} submissions
            </span>
          </div>
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-gray-400" />
            <span className="text-sm text-gray-600">
              <span className="font-bold text-gray-900">
                {submissions.length}
              </span>{" "}
              learners
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-600">
            Failed to load submissions. Please try again.
          </p>
        </div>
      ) : submissions.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No {statusFilter === "all" ? "" : statusFilter} submissions
          </h3>
          <p className="text-gray-500">
            {statusFilter === "pending"
              ? "All grammar drills have been reviewed!"
              : "No submissions found."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {submissions.map((learnerSubmissions) => (
            <div
              key={learnerSubmissions.learner._id}
              className="bg-white rounded-2xl border border-gray-100 overflow-hidden"
            >
              {/* Learner Header */}
              <button
                onClick={() => toggleLearner(learnerSubmissions.learner._id)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-pink-100 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-pink-600" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold text-gray-900">
                      {learnerSubmissions.learner.name}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {learnerSubmissions.learner.email}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="px-3 py-1 bg-pink-100 text-pink-700 rounded-full text-sm font-medium">
                    {learnerSubmissions.submissions.length} submission
                    {learnerSubmissions.submissions.length !== 1 ? "s" : ""}
                  </span>
                  {expandedLearners.has(learnerSubmissions.learner._id) ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </button>

              {/* Submissions List */}
              {expandedLearners.has(learnerSubmissions.learner._id) && (
                <div className="border-t border-gray-100 divide-y divide-gray-100">
                  {learnerSubmissions.submissions.map((submission) => (
                    <div
                      key={submission.attemptId}
                      className="px-6 py-4 flex items-center justify-between hover:bg-gray-50"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <h4 className="font-medium text-gray-900">
                            {submission.drill.title}
                          </h4>
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${submission.grammarResults.reviewStatus ===
                                "reviewed"
                                ? "bg-green-100 text-green-700"
                                : "bg-yellow-100 text-yellow-700"
                              }`}
                          >
                            {submission.grammarResults.reviewStatus ===
                              "reviewed"
                              ? "Reviewed"
                              : "Pending"}
                          </span>
                          {submission.score !== undefined && submission.score > 0 && (
                            <span className="text-sm text-gray-500">
                              Score: {submission.score}%
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span>
                            {submission.grammarResults.patterns?.length || 0}{" "}
                            patterns
                          </span>
                          <span>•</span>
                          <span>{formatDate(submission.completedAt)}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedSubmission(submission)}
                        className="flex items-center gap-2 px-4 py-2 bg-pink-50 text-pink-600 font-medium rounded-lg hover:bg-pink-100 transition"
                      >
                        <Eye className="w-4 h-4" />
                        {submission.grammarResults.reviewStatus === "reviewed"
                          ? "View"
                          : "Review"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Review Modal */}
      {selectedSubmission && (
        <ReviewModal
          submission={selectedSubmission}
          onClose={() => setSelectedSubmission(null)}
          onSubmitReview={(attemptId, reviews) =>
            reviewMutation.mutate({ attemptId, grammarReviews: reviews })
          }
        />
      )}
    </div>
  );
}


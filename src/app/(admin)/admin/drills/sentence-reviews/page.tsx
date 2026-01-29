"use client";

import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useDrillReviews, type SentenceSubmission } from "@/hooks/useDrillReviews";
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
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

interface Learner {
  _id: string;
  name: string;
  email: string;
}

interface SentenceResult {
  word: string;
  definition: string;
  sentences: Array<{ text: string; index: number }>;
  words?: Array<{
    word: string;
    definition: string;
    sentences: Array<{ text: string; index: number }>;
  }>;
  reviewStatus: "pending" | "reviewed";
  sentenceReviews?: Array<{
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
  sentenceResults: SentenceResult;
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
      sentenceIndex: number;
      isCorrect: boolean;
      correctedText?: string;
    }>
  ) => void;
}) {
  const { sentenceResults } = submission;
  
  // Handle multiple words case
  const allWords = sentenceResults.words && sentenceResults.words.length > 0 
    ? sentenceResults.words 
    : [{ word: sentenceResults.word, definition: sentenceResults.definition, sentences: sentenceResults.sentences }];
  
  const totalWords = allWords.length;
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  
  const currentWord = allWords[currentWordIndex];
  const sentences = currentWord?.sentences || [];
  const isAlreadyReviewed = sentenceResults.reviewStatus === "reviewed";
  const existingReviews = sentenceResults.sentenceReviews || [];

  // Initialize reviews from existing reviews if already reviewed
  // Track reviews per word
  const [allWordReviews, setAllWordReviews] = useState<
    Record<number, Array<{ isCorrect: boolean | null; correctedText: string }>>
  >(() => {
    const initialReviews: Record<number, Array<{ isCorrect: boolean | null; correctedText: string }>> = {};
    allWords.forEach((word, wordIdx) => {
      const wordSentences = word.sentences || [];
    if (isAlreadyReviewed && existingReviews.length > 0) {
        initialReviews[wordIdx] = wordSentences.map((_, idx) => {
          // Calculate global sentence index for backwards compatibility
          const globalIdx = allWords.slice(0, wordIdx).reduce((acc, w) => acc + (w.sentences?.length || 0), 0) + idx;
          const existing = existingReviews.find((r) => r.sentenceIndex === globalIdx || r.sentenceIndex === idx);
        return {
          isCorrect: existing?.isCorrect ?? null,
          correctedText: existing?.correctedText || "",
        };
      });
      } else {
        initialReviews[wordIdx] = wordSentences.map(() => ({ isCorrect: null, correctedText: "" }));
      }
  });
    return initialReviews;
  });

  const reviews = allWordReviews[currentWordIndex] || [];
  const setReviews = (newReviews: Array<{ isCorrect: boolean | null; correctedText: string }> | ((prev: Array<{ isCorrect: boolean | null; correctedText: string }>) => Array<{ isCorrect: boolean | null; correctedText: string }>)) => {
    setAllWordReviews(prev => ({
      ...prev,
      [currentWordIndex]: typeof newReviews === 'function' ? newReviews(prev[currentWordIndex] || []) : newReviews,
    }));
  };

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check if all words have been reviewed
  const canSubmit = Object.values(allWordReviews).every(wordReviews => 
    wordReviews.every((r) => r.isCorrect !== null)
  );
  
  // Check if current word is complete
  const isCurrentWordComplete = reviews.every((r) => r.isCorrect !== null);
  
  // Navigation functions
  const goToPreviousWord = () => {
    if (currentWordIndex > 0) {
      setCurrentWordIndex(currentWordIndex - 1);
    }
  };
  
  const goToNextWord = () => {
    if (currentWordIndex < totalWords - 1) {
      setCurrentWordIndex(currentWordIndex + 1);
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit) {
      toast.error("Please review all sentences for all words before submitting.");
      return;
    }

    // Validate that corrections are provided for incorrect sentences across all words
    let hasIncorrectWithoutCorrection = false;
    let incompleteWordIndex = -1;
    
    Object.entries(allWordReviews).forEach(([wordIdx, wordReviews]) => {
      const hasIssue = wordReviews.some(
      (r) => r.isCorrect === false && !r.correctedText.trim()
    );
      if (hasIssue && incompleteWordIndex === -1) {
        hasIncorrectWithoutCorrection = true;
        incompleteWordIndex = parseInt(wordIdx);
      }
    });
    
    if (hasIncorrectWithoutCorrection) {
      toast.error("Please provide corrections for sentences marked as incorrect.");
      if (incompleteWordIndex !== -1) {
        setCurrentWordIndex(incompleteWordIndex);
      }
      return;
    }

    setIsSubmitting(true);
    try {
      // Flatten all reviews with global sentence indices
      const sentenceReviews: Array<{
        sentenceIndex: number;
        isCorrect: boolean;
        correctedText?: string;
      }> = [];
      
      let globalIdx = 0;
      Object.values(allWordReviews).forEach((wordReviews) => {
        wordReviews.forEach((r) => {
          sentenceReviews.push({
            sentenceIndex: globalIdx,
        isCorrect: r.isCorrect!,
        correctedText: r.isCorrect ? undefined : r.correctedText || undefined,
          });
          globalIdx++;
        });
      });

      await onSubmitReview(submission.attemptId, sentenceReviews);
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
                Review Submission
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
          {/* Word Navigation (only show if multiple words) */}
          {totalWords > 1 && (
            <div className="flex items-center justify-between bg-gray-50 rounded-xl p-3">
              <button
                onClick={goToPreviousWord}
                disabled={currentWordIndex === 0}
                className="flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>
              
              <div className="flex items-center gap-2">
                {allWords.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentWordIndex(idx)}
                    className={`w-8 h-8 rounded-full text-sm font-medium transition ${
                      idx === currentWordIndex
                        ? "bg-blue-600 text-white"
                        : Object.values(allWordReviews[idx] || []).every(r => r.isCorrect !== null)
                        ? "bg-green-100 text-green-700 hover:bg-green-200"
                        : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                    }`}
                  >
                    {idx + 1}
                  </button>
                ))}
              </div>
              
              <button
                onClick={goToNextWord}
                disabled={currentWordIndex === totalWords - 1}
                className="flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
          
          {/* Word Progress Indicator */}
          {totalWords > 1 && (
            <div className="text-center text-sm text-gray-500">
              Word {currentWordIndex + 1} of {totalWords}
            </div>
          )}

          {/* Word and Definition */}
          <div className="bg-blue-50 rounded-xl p-4">
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              Target Word: <span className="text-blue-600">{currentWord?.word || sentenceResults.word}</span>
            </h3>
            <div className="bg-white rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">Student's Definition:</p>
              <p className="text-gray-900">{currentWord?.definition || sentenceResults.definition || "No definition provided"}</p>
            </div>
          </div>

          {/* Sentences to Review */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">Review Sentences</h3>

            {sentences.map((sentence, idx) => (
              <div
                key={idx}
                className={`border rounded-xl p-4 transition ${
                  reviews[idx].isCorrect === true
                    ? "border-green-300 bg-green-50"
                    : reviews[idx].isCorrect === false
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
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${
                      reviews[idx].isCorrect === true
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
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${
                      reviews[idx].isCorrect === false
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

                {/* Correction Field (only if marked incorrect) */}
                {reviews[idx].isCorrect === false && (
                  <div className="mt-3">
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      {isAlreadyReviewed ? "Corrected Version:" : "Corrected Version (required):"}
                    </label>
                    {isAlreadyReviewed ? (
                      <div className="bg-green-50 border border-green-200 p-3 rounded-lg">
                        <p className="text-green-900">
                          {reviews[idx].correctedText || "No correction provided"}
                        </p>
                      </div>
                    ) : (
                      <textarea
                        value={reviews[idx].correctedText}
                        onChange={(e) => {
                          const updated = [...reviews];
                          updated[idx] = {
                            ...updated[idx],
                            correctedText: e.target.value,
                          };
                          setReviews(updated);
                        }}
                        placeholder="Enter the corrected sentence..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
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
              ) : totalWords > 1 ? (
                <>
                  Word {currentWordIndex + 1}/{totalWords} • {reviews.filter((r) => r.isCorrect !== null).length}/{sentences.length} sentences reviewed
                </>
              ) : (
                <>
                  {reviews.filter((r) => r.isCorrect !== null).length} of{" "}
                  {sentences.length} reviewed
                </>
              )}
            </p>
            <div className="flex items-center gap-3">
              {/* Navigation buttons in footer for mobile */}
              {totalWords > 1 && !isAlreadyReviewed && (
                <div className="flex items-center gap-1 mr-2">
                  <button
                    onClick={goToPreviousWord}
                    disabled={currentWordIndex === 0}
                    className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition disabled:opacity-30"
                    title="Previous Word"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={goToNextWord}
                    disabled={currentWordIndex === totalWords - 1}
                    className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition disabled:opacity-30"
                    title="Next Word"
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
                  className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
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
export default function SentenceReviewsPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<"pending" | "reviewed" | "all">("pending");
  const [expandedLearners, setExpandedLearners] = useState<Set<string>>(new Set());
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);

  // Fetch submissions using shared hook
  const {
    data,
    isLoading,
    error,
  } = useDrillReviews("sentence", statusFilter, 100);

  // Review mutation
  const reviewMutation = useMutation({
    mutationFn: async ({
      attemptId,
      sentenceReviews,
    }: {
      attemptId: string;
      sentenceReviews: Array<{
        sentenceIndex: number;
        isCorrect: boolean;
        correctedText?: string;
      }>;
    }) => {
      const response = await fetch(
        `/api/v1/drills/attempts/${attemptId}/review`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ sentenceReviews }),
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
      queryClient.invalidateQueries({ queryKey: ["sentence-submissions"] });
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

  // Transform to sentence-specific submissions
  const submissions: LearnerSubmissions[] = (data?.submissions || []).map(ls => ({
    learner: ls.learner,
    submissions: ls.submissions.filter((s): s is SentenceSubmission => 'sentenceResults' in s) as Submission[],
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
            Sentence Drill Reviews
          </h1>
          <p className="text-gray-500 text-sm">
            Review and grade student sentence submissions
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-xl w-fit">
        {(["pending", "reviewed", "all"] as const).map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition ${
              statusFilter === status
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
              <span className="font-bold text-gray-900">{submissions.length}</span>{" "}
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
          <p className="text-red-600">Failed to load submissions. Please try again.</p>
        </div>
      ) : submissions.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No {statusFilter === "all" ? "" : statusFilter} submissions
          </h3>
          <p className="text-gray-500">
            {statusFilter === "pending"
              ? "All sentence drills have been reviewed!"
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
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-blue-600" />
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
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
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
                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              submission.sentenceResults.reviewStatus === "reviewed"
                                ? "bg-green-100 text-green-700"
                                : "bg-yellow-100 text-yellow-700"
                            }`}
                          >
                            {submission.sentenceResults.reviewStatus === "reviewed"
                              ? "Reviewed"
                              : "Pending"}
                          </span>
                          {submission.score !== undefined && (
                            <span className="text-sm text-gray-500">
                              Score: {submission.score}%
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span>Word: {submission.sentenceResults.word}</span>
                          <span>•</span>
                          <span>{formatDate(submission.completedAt)}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedSubmission(submission)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 font-medium rounded-lg hover:bg-blue-100 transition"
                      >
                        <Eye className="w-4 h-4" />
                        {submission.sentenceResults.reviewStatus === "reviewed"
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
            reviewMutation.mutate({ attemptId, sentenceReviews: reviews })
          }
        />
      )}
    </div>
  );
}


"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  User,
  FileText,
  Eye,
  ChevronDown,
  ChevronUp,
  Send,
  BookOpen,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

interface Learner {
  _id: string;
  name: string;
  email: string;
}

interface SummaryResult {
  summaryProvided: boolean;
  articleTitle?: string;
  articleContent?: string;
  summary?: string;
  wordCount?: number;
  reviewStatus?: "pending" | "reviewed";
  review?: {
    feedback?: string;
    isAcceptable: boolean;
    correctedVersion?: string;
    reviewedAt?: string;
  };
}

interface Submission {
  attemptId: string;
  drill: {
    _id: string;
    title: string;
    type: string;
  };
  summaryResults: SummaryResult;
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
    review: {
      feedback: string;
      isAcceptable: boolean;
      correctedVersion?: string;
    }
  ) => void;
}) {
  const { summaryResults } = submission;
  const [isAcceptable, setIsAcceptable] = useState<boolean | null>(null);
  const [feedback, setFeedback] = useState("");
  const [correctedVersion, setCorrectedVersion] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassage, setShowPassage] = useState(false);

  const isAlreadyReviewed = summaryResults.reviewStatus === "reviewed";

  const handleSubmit = async () => {
    if (isAcceptable === null) {
      toast.error("Please mark the summary as acceptable or needs improvement");
      return;
    }

    if (!feedback.trim()) {
      toast.error("Please provide feedback for the student");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmitReview(submission.attemptId, {
        feedback: feedback.trim(),
        isAcceptable,
        correctedVersion: !isAcceptable ? correctedVersion.trim() : undefined,
      });
      onClose();
    } catch (error) {
      // Error handled by mutation
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Review Summary
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
          {/* Original Passage (collapsible) */}
          <div className="bg-gray-50 rounded-xl border border-gray-200">
            <button
              onClick={() => setShowPassage(!showPassage)}
              className="w-full flex items-center justify-between p-4"
            >
              <span className="flex items-center gap-2 font-medium text-gray-700">
                <BookOpen className="w-4 h-4 text-green-600" />
                Original Passage: {summaryResults.articleTitle || "Passage"}
              </span>
              {showPassage ? (
                <ChevronUp className="w-5 h-5 text-gray-500" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-500" />
              )}
            </button>
            {showPassage && (
              <div className="px-4 pb-4 border-t border-gray-200 pt-4">
                <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">
                  {summaryResults.articleContent || "No passage content"}
                </p>
              </div>
            )}
          </div>

          {/* Student's Summary */}
          <div className="bg-white rounded-xl border-2 border-green-200">
            <div className="p-4 border-b border-green-100 bg-green-50 rounded-t-xl">
              <h3 className="font-semibold text-green-900 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Student's Summary
                <span className="text-sm font-normal text-green-700 ml-2">
                  ({summaryResults.wordCount || 0} words)
                </span>
              </h3>
            </div>
            <div className="p-4">
              <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">
                {summaryResults.summary || "No summary provided"}
              </p>
            </div>
          </div>

          {isAlreadyReviewed && summaryResults.review ? (
            // Show existing review
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Previous Review
              </h4>
              <p className="text-sm text-blue-800 mb-2">
                Status:{" "}
                {summaryResults.review.isAcceptable ? (
                  <span className="text-green-600 font-medium">Acceptable</span>
                ) : (
                  <span className="text-amber-600 font-medium">
                    Needs Improvement
                  </span>
                )}
              </p>
              <p className="text-sm text-blue-700">
                <strong>Feedback:</strong> {summaryResults.review.feedback}
              </p>
              {summaryResults.review.correctedVersion && (
                <div className="mt-2 pt-2 border-t border-blue-200">
                  <p className="text-sm text-blue-700">
                    <strong>Corrected Version:</strong>
                  </p>
                  <p className="text-sm text-blue-600 mt-1">
                    {summaryResults.review.correctedVersion}
                  </p>
                </div>
              )}
            </div>
          ) : (
            // Review Form
            <>
              {/* Acceptable/Needs Improvement Toggle */}
              <div>
                <h4 className="font-medium text-gray-700 mb-3">
                  Is the summary acceptable?
                </h4>
                <div className="flex gap-3">
                  <button
                    onClick={() => setIsAcceptable(true)}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium transition-all border-2 ${
                      isAcceptable === true
                        ? "bg-green-100 border-green-500 text-green-700"
                        : "bg-white border-gray-200 text-gray-600 hover:border-green-300"
                    }`}
                  >
                    <CheckCircle className="w-5 h-5" />
                    Acceptable
                  </button>
                  <button
                    onClick={() => setIsAcceptable(false)}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium transition-all border-2 ${
                      isAcceptable === false
                        ? "bg-amber-100 border-amber-500 text-amber-700"
                        : "bg-white border-gray-200 text-gray-600 hover:border-amber-300"
                    }`}
                  >
                    <XCircle className="w-5 h-5" />
                    Needs Improvement
                  </button>
                </div>
              </div>

              {/* Feedback */}
              <div>
                <label className="block font-medium text-gray-700 mb-2">
                  <MessageSquare className="w-4 h-4 inline mr-2" />
                  Feedback for Student
                </label>
                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all min-h-[100px] resize-none"
                  placeholder="Provide constructive feedback on their summary... What did they do well? What could be improved?"
                />
              </div>

              {/* Corrected Version (if needs improvement) */}
              {isAcceptable === false && (
                <div>
                  <label className="block font-medium text-gray-700 mb-2">
                    <FileText className="w-4 h-4 inline mr-2" />
                    Improved Version (Optional)
                  </label>
                  <textarea
                    value={correctedVersion}
                    onChange={(e) => setCorrectedVersion(e.target.value)}
                    className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all min-h-[100px] resize-none"
                    placeholder="Optionally provide an improved version of the summary to help the student learn..."
                  />
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!isAlreadyReviewed && (
          <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 rounded-b-2xl">
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-3 px-4 rounded-xl font-medium border-2 border-gray-200 text-gray-600 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || isAcceptable === null || !feedback.trim()}
                className="flex-1 py-3 px-4 rounded-xl font-medium bg-green-600 text-white hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SummaryReviewsPage() {
  const queryClient = useQueryClient();
  const [filterStatus, setFilterStatus] = useState<"pending" | "reviewed" | "all">("pending");
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [expandedLearners, setExpandedLearners] = useState<Set<string>>(new Set());

  // Fetch summary submissions
  const { data, isLoading, error } = useQuery({
    queryKey: ["summary-submissions", filterStatus],
    queryFn: async () => {
      const response = await fetch(
        `/api/v1/drills/summary-submissions?status=${filterStatus}`
      );
      if (!response.ok) {
        throw new Error("Failed to fetch submissions");
      }
      return response.json();
    },
  });

  // Submit review mutation
  const submitReviewMutation = useMutation({
    mutationFn: async ({
      attemptId,
      review,
    }: {
      attemptId: string;
      review: {
        feedback: string;
        isAcceptable: boolean;
        correctedVersion?: string;
      };
    }) => {
      const response = await fetch(
        `/api/v1/drills/attempts/${attemptId}/summary-review`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(review),
        }
      );
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to submit review");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["summary-submissions"] });
      toast.success("Review submitted successfully!");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to submit review");
    },
  });

  const toggleLearner = (learnerId: string) => {
    const newExpanded = new Set(expandedLearners);
    if (newExpanded.has(learnerId)) {
      newExpanded.delete(learnerId);
    } else {
      newExpanded.add(learnerId);
    }
    setExpandedLearners(newExpanded);
  };

  const submissions: LearnerSubmissions[] = data?.data?.submissions || [];
  const totalPending = submissions.reduce(
    (acc, ls) =>
      acc +
      ls.submissions.filter((s) => s.summaryResults?.reviewStatus !== "reviewed")
        .length,
    0
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-6 md:px-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Link
              href="/admin/dashboard"
              className="text-gray-500 hover:text-gray-700"
            >
              ← Back
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <FileText className="w-7 h-7 text-green-600" />
            Summary Reviews
            {totalPending > 0 && (
              <span className="px-2.5 py-1 bg-amber-100 text-amber-700 text-sm font-medium rounded-full">
                {totalPending} pending
              </span>
            )}
          </h1>
          <p className="text-gray-500 mt-1">
            Review student summary submissions and provide feedback
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6">
          {(["pending", "reviewed", "all"] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                filterStatus === status
                  ? "bg-green-600 text-white"
                  : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-200"
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-green-600" />
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <XCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
            <p className="text-red-700">Failed to load submissions</p>
          </div>
        ) : submissions.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              No submissions found
            </h3>
            <p className="text-gray-500">
              {filterStatus === "pending"
                ? "No summary submissions are pending review."
                : filterStatus === "reviewed"
                ? "No reviewed submissions found."
                : "No submissions available."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {submissions.map((learnerSubmissions) => (
              <div
                key={learnerSubmissions.learner._id}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden"
              >
                {/* Learner Header */}
                <button
                  onClick={() => toggleLearner(learnerSubmissions.learner._id)}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-green-600" />
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
                  <div className="flex items-center gap-3">
                    <span className="px-2.5 py-1 bg-gray-100 text-gray-600 text-sm font-medium rounded-full">
                      {learnerSubmissions.submissions.length} submission
                      {learnerSubmissions.submissions.length !== 1 ? "s" : ""}
                    </span>
                    {expandedLearners.has(learnerSubmissions.learner._id) ? (
                      <ChevronUp className="w-5 h-5 text-gray-500" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-500" />
                    )}
                  </div>
                </button>

                {/* Submissions List */}
                {expandedLearners.has(learnerSubmissions.learner._id) && (
                  <div className="border-t border-gray-100 divide-y divide-gray-100">
                    {learnerSubmissions.submissions.map((submission) => (
                      <div
                        key={submission.attemptId}
                        className="p-4 hover:bg-gray-50 transition"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium text-gray-900">
                                {submission.drill.title}
                              </h4>
                              <span
                                className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                  submission.summaryResults?.reviewStatus ===
                                  "reviewed"
                                    ? "bg-green-100 text-green-700"
                                    : "bg-amber-100 text-amber-700"
                                }`}
                              >
                                {submission.summaryResults?.reviewStatus ===
                                "reviewed"
                                  ? "Reviewed"
                                  : "Pending"}
                              </span>
                            </div>
                            <p className="text-sm text-gray-500 mb-2">
                              Submitted:{" "}
                              {new Date(submission.completedAt).toLocaleString()}
                              {" • "}
                              {submission.summaryResults?.wordCount || 0} words
                            </p>
                            {/* Preview of summary */}
                            <p className="text-sm text-gray-600 line-clamp-2">
                              {submission.summaryResults?.summary?.substring(
                                0,
                                150
                              )}
                              {(submission.summaryResults?.summary?.length ||
                                0) > 150
                                ? "..."
                                : ""}
                            </p>
                          </div>
                          <button
                            onClick={() => setSelectedSubmission(submission)}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm font-medium"
                          >
                            <Eye className="w-4 h-4" />
                            {submission.summaryResults?.reviewStatus ===
                            "reviewed"
                              ? "View"
                              : "Review"}
                          </button>
                        </div>
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
            onSubmitReview={(attemptId, review) =>
              submitReviewMutation.mutate({ attemptId, review })
            }
          />
        )}
      </div>
    </div>
  );
}


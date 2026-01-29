import { useQuery } from "@tanstack/react-query";

export type ReviewType = "sentence" | "grammar" | "summary";
export type ReviewStatus = "pending" | "reviewed" | "all";

interface Learner {
  _id: string;
  name: string;
  email: string;
}

interface BaseSubmission {
  attemptId: string;
  drill: {
    _id: string;
    title: string;
    type: string;
  };
  completedAt: string;
  score?: number;
  timeSpent: number;
}

interface SentenceSubmission extends BaseSubmission {
  sentenceResults: {
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
  };
}

interface GrammarSubmission extends BaseSubmission {
  grammarResults: {
    patterns?: Array<{
      pattern: string;
      example: string;
      hint?: string;
      sentences: Array<{ text: string; index: number }>;
    }>;
    reviewStatus: "pending" | "reviewed";
    patternReviews?: Array<{
      patternIndex: number;
      sentenceIndex: number;
      isCorrect: boolean;
      correctedText?: string;
      reviewedAt?: string;
    }>;
  };
}

interface SummarySubmission extends BaseSubmission {
  summaryResults: {
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
  };
}

export type Submission = SentenceSubmission | GrammarSubmission | SummarySubmission;

// Type-specific exports for pages that need them
export type { SentenceSubmission, GrammarSubmission, SummarySubmission };

export interface LearnerSubmissions {
  learner: Learner;
  submissions: Submission[];
}

interface ReviewData {
  submissions: LearnerSubmissions[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/**
 * Transform API attempts into learner-grouped submissions
 */
function transformAttemptsToSubmissions(attempts: any[]): LearnerSubmissions[] {
  // Group attempts by learner
  const learnerMap = new Map<string, {
    learner: Learner;
    submissions: Submission[];
  }>();

  attempts.forEach((attempt) => {
    const learnerId = typeof attempt.learnerId === 'object' && attempt.learnerId?._id
      ? attempt.learnerId._id.toString()
      : attempt.learnerId?.toString() || '';

    const learnerName = typeof attempt.learnerId === 'object'
      ? `${attempt.learnerId?.firstName || ''} ${attempt.learnerId?.lastName || ''}`.trim() || attempt.learnerId?.email || 'Unknown'
      : 'Unknown';

    const learnerEmail = typeof attempt.learnerId === 'object'
      ? attempt.learnerId?.email || ''
      : '';

    const drill = typeof attempt.drillId === 'object' && attempt.drillId
      ? {
          _id: attempt.drillId._id?.toString() || '',
          title: attempt.drillId.title || 'Untitled Drill',
          type: attempt.drillId.type || 'unknown',
        }
      : {
          _id: attempt.drillId?.toString() || '',
          title: 'Untitled Drill',
          type: 'unknown',
        };

    const submission: Submission = {
      attemptId: attempt._id?.toString() || '',
      drill,
      completedAt: attempt.completedAt || attempt.createdAt || new Date().toISOString(),
      score: attempt.score,
      timeSpent: attempt.timeSpent || 0,
      ...(attempt.sentenceResults && {
        sentenceResults: attempt.sentenceResults,
      }),
      ...(attempt.grammarResults && {
        grammarResults: attempt.grammarResults,
      }),
      ...(attempt.summaryResults && {
        summaryResults: attempt.summaryResults,
      }),
    };

    if (!learnerMap.has(learnerId)) {
      learnerMap.set(learnerId, {
        learner: {
          _id: learnerId,
          name: learnerName,
          email: learnerEmail,
        },
        submissions: [],
      });
    }

    learnerMap.get(learnerId)!.submissions.push(submission);
  });

  // Convert map to array and sort by learner name
  return Array.from(learnerMap.values())
    .map((item) => ({
      learner: item.learner,
      submissions: item.submissions.sort((a, b) => 
        new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
      ),
    }))
    .sort((a, b) => a.learner.name.localeCompare(b.learner.name));
}

/**
 * Fetch drill review submissions
 */
async function fetchReviewSubmissions(
  type: ReviewType,
  status: ReviewStatus,
  limit: number = 100
): Promise<ReviewData> {
  const endpointMap = {
    sentence: "/api/v1/drills/sentence-submissions",
    grammar: "/api/v1/drills/grammar-submissions",
    summary: "/api/v1/drills/summary-submissions",
  };

  const endpoint = endpointMap[type];
  const url = `${endpoint}?status=${status}&limit=${limit}`;

  const response = await fetch(url, {
    credentials: "include",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Failed to fetch submissions" }));
    throw new Error(error.message || "Failed to fetch submissions");
  }

  const result = await response.json();
  
  // Handle both direct data and wrapped data structures
  const data = result.data || result;
  
  // Transform attempts array to learner-grouped submissions
  const attempts = data.attempts || [];
  const submissions = transformAttemptsToSubmissions(attempts);

  return {
    submissions,
    pagination: data.pagination || {
      total: data.total || attempts.length,
      page: 1,
      limit,
      totalPages: Math.ceil((data.total || attempts.length) / limit),
    },
  };
}

/**
 * React Query hook for fetching drill review submissions
 */
export function useDrillReviews(
  type: ReviewType,
  status: ReviewStatus = "pending",
  limit: number = 100
) {
  return useQuery({
    queryKey: [`${type}-submissions`, status, limit],
    queryFn: () => fetchReviewSubmissions(type, status, limit),
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: true,
  });
}


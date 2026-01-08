"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { Checkbox } from "@/components/ui/Checkbox";
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Loader2,
  BookOpen,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { apiRequest } from "@/lib/api";
import { toast } from "sonner";

interface SentenceReview {
  sentenceIndex: number;
  isCorrect: boolean;
  correctedText: string;
}

interface SentenceAttempt {
  _id: string;
  learnerId: {
    _id: string;
    name: string;
    email: string;
  };
  sentenceResults: {
    word: string;
    definition: string;
    sentences: Array<{
      text: string;
      index: number;
    }>;
    reviewStatus: 'pending' | 'reviewed';
  };
  completedAt: string;
}

export default function SentenceDrillReviewPage() {
  const params = useParams();
  const router = useRouter();
  const drillId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [attempts, setAttempts] = useState<SentenceAttempt[]>([]);
  const [reviews, setReviews] = useState<Record<string, SentenceReview[]>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPendingAttempts();
  }, [drillId]);

  const fetchPendingAttempts = async () => {
    try {
      setLoading(true);
      // Fetch all attempts for this drill that are pending review
      const response = await apiRequest<{
        code: string;
        data: {
          attempts: SentenceAttempt[];
        };
      }>(`/drills/${drillId}/attempts?type=sentence&status=pending`, {
        method: 'GET',
      });

      if (response.code === 'Success' && response.data) {
        const pendingAttempts = response.data.attempts.filter(
          (attempt) => attempt.sentenceResults?.reviewStatus === 'pending'
        );
        setAttempts(pendingAttempts);

        // Initialize reviews
        const initialReviews: Record<string, SentenceReview[]> = {};
        pendingAttempts.forEach((attempt) => {
          initialReviews[attempt._id] = [
            { sentenceIndex: 0, isCorrect: false, correctedText: '' },
            { sentenceIndex: 1, isCorrect: false, correctedText: '' },
          ];
        });
        setReviews(initialReviews);
      }
    } catch (err: any) {
      console.error('Error fetching attempts:', err);
      setError(err.message || 'Failed to load attempts');
      toast.error('Failed to load attempts');
    } finally {
      setLoading(false);
    }
  };

  const updateReview = (attemptId: string, sentenceIndex: number, field: keyof SentenceReview, value: any) => {
    setReviews((prev) => {
      const attemptReviews = [...(prev[attemptId] || [])];
      const reviewIndex = attemptReviews.findIndex((r) => r.sentenceIndex === sentenceIndex);
      
      if (reviewIndex === -1) {
        attemptReviews.push({
          sentenceIndex,
          isCorrect: false,
          correctedText: '',
          [field]: value,
        });
      } else {
        attemptReviews[reviewIndex] = {
          ...attemptReviews[reviewIndex],
          [field]: value,
        };
      }

      return {
        ...prev,
        [attemptId]: attemptReviews,
      };
    });
  };

  const handleSubmitReview = async (attemptId: string) => {
    const attemptReviews = reviews[attemptId];
    if (!attemptReviews || attemptReviews.length !== 2) {
      toast.error('Please review both sentences');
      return;
    }

    // Validate that both sentences are reviewed
    const hasBothReviews = attemptReviews.every((r) => 
      r.sentenceIndex === 0 || r.sentenceIndex === 1
    );
    if (!hasBothReviews) {
      toast.error('Please review both sentences');
      return;
    }

    // Validate corrections for wrong sentences
    const wrongSentences = attemptReviews.filter((r) => !r.isCorrect);
    if (wrongSentences.some((r) => !r.correctedText || r.correctedText.trim().length === 0)) {
      toast.error('Please provide corrections for sentences marked as wrong');
      return;
    }

    setSubmitting(true);
    try {
      const sentenceReviews = attemptReviews.map((review) => ({
        sentenceIndex: review.sentenceIndex,
        isCorrect: review.isCorrect,
        correctedText: review.isCorrect ? undefined : review.correctedText,
      }));

      await apiRequest(`/drills/attempts/${attemptId}/review`, {
        method: 'POST',
        data: { sentenceReviews },
      });

      toast.success('Review submitted successfully');
      // Remove from list
      setAttempts((prev) => prev.filter((a) => a._id !== attemptId));
      const newReviews = { ...reviews };
      delete newReviews[attemptId];
      setReviews(newReviews);
    } catch (err: any) {
      console.error('Error submitting review:', err);
      toast.error(err.message || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <Link href={`/tutor/drills/${drillId}`}>
            <Button variant="outline" size="sm" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Drill
            </Button>
          </Link>
          <Card className="p-8 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">{error}</h2>
          </Card>
        </div>
      </div>
    );
  }

  if (attempts.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <Link href={`/tutor/drills/${drillId}`}>
            <Button variant="outline" size="sm" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Drill
            </Button>
          </Link>
          <Card className="p-8 text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              No Pending Reviews
            </h2>
            <p className="text-gray-500">
              All sentence drill submissions have been reviewed.
            </p>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <Link href={`/tutor/drills/${drillId}`}>
          <Button variant="outline" size="sm" className="mb-6">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Drill
          </Button>
        </Link>

        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          Review Sentence Drills
        </h1>

        <div className="space-y-6">
          {attempts.map((attempt) => {
            const attemptReviews = reviews[attempt._id] || [];
            const sentence1Review = attemptReviews.find((r) => r.sentenceIndex === 0);
            const sentence2Review = attemptReviews.find((r) => r.sentenceIndex === 1);

            return (
              <Card key={attempt._id} className="p-6">
                <div className="mb-4 pb-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {attempt.learnerId?.name || attempt.learnerId?.email}
                      </h3>
                      <p className="text-sm text-gray-500">
                        Submitted: {new Date(attempt.completedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Word and Definition */}
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-2">
                    <BookOpen className="w-5 h-5 text-blue-600" />
                    <h4 className="font-semibold text-gray-900">
                      Word: {attempt.sentenceResults.word}
                    </h4>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Student's Definition:</p>
                    <p className="text-gray-900">{attempt.sentenceResults.definition}</p>
                    <p className="text-xs text-gray-500 mt-2 italic">
                      (Definition is not reviewed or corrected)
                    </p>
                  </div>
                </div>

                {/* Sentence 1 */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-gray-900">Sentence 1</h4>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={sentence1Review?.isCorrect || false}
                          onChange={(e) =>
                            updateReview(attempt._id, 0, 'isCorrect', e.target.checked)
                          }
                        />
                        <span className="text-sm text-gray-700">Correct</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={sentence1Review?.isCorrect === false}
                          onChange={(e) =>
                            updateReview(attempt._id, 0, 'isCorrect', !e.target.checked)
                          }
                        />
                        <span className="text-sm text-gray-700">Wrong</span>
                      </label>
                    </div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg mb-3">
                    <p className="text-sm text-gray-600 mb-1">Student's Sentence:</p>
                    <p className="text-gray-900">{attempt.sentenceResults.sentences[0]?.text}</p>
                  </div>
                  {sentence1Review && !sentence1Review.isCorrect && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Corrected Version:
                      </label>
                      <Textarea
                        className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter the corrected sentence..."
                        value={sentence1Review.correctedText}
                        onChange={(e) =>
                          updateReview(attempt._id, 0, 'correctedText', e.target.value)
                        }
                        rows={2}
                      />
                    </div>
                  )}
                </div>

                {/* Sentence 2 */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-gray-900">Sentence 2</h4>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={sentence2Review?.isCorrect || false}
                          onChange={(e) =>
                            updateReview(attempt._id, 1, 'isCorrect', e.target.checked)
                          }
                        />
                        <span className="text-sm text-gray-700">Correct</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={sentence2Review?.isCorrect === false}
                          onChange={(e) =>
                            updateReview(attempt._id, 1, 'isCorrect', !e.target.checked)
                          }
                        />
                        <span className="text-sm text-gray-700">Wrong</span>
                      </label>
                    </div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg mb-3">
                    <p className="text-sm text-gray-600 mb-1">Student's Sentence:</p>
                    <p className="text-gray-900">{attempt.sentenceResults.sentences[1]?.text}</p>
                  </div>
                  {sentence2Review && !sentence2Review.isCorrect && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Corrected Version:
                      </label>
                      <Textarea
                        className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter the corrected sentence..."
                        value={sentence2Review.correctedText}
                        onChange={(e) =>
                          updateReview(attempt._id, 1, 'correctedText', e.target.value)
                        }
                        rows={2}
                      />
                    </div>
                  )}
                </div>

                {/* Submit Button */}
                <div className="flex justify-end">
                  <Button
                    variant="primary"
                    onClick={() => handleSubmitReview(attempt._id)}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      'Submit Review'
                    )}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}



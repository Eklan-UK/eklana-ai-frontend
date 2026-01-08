"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TTSButton } from "@/components/ui/TTSButton";
import { Loader2, FileText, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { drillAPI } from "@/lib/api";
import { DrillCompletionScreen, DrillLayout } from "./shared";

interface SummaryDrillProps {
  drill: any;
  assignmentId?: string;
}

export default function SummaryDrill({ drill, assignmentId }: SummaryDrillProps) {
  const [summary, setSummary] = useState("");
  const [isCompleted, setIsCompleted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [startTime] = useState(Date.now());
  const [wordCount, setWordCount] = useState(0);

  const articleTitle = drill.article_title || "Article";
  const articleContent = drill.article_content || "";

  const handleSummaryChange = (value: string) => {
    setSummary(value);
    setWordCount(value.trim().split(/\s+/).filter(word => word.length > 0).length);
  };

  const handleSubmit = async () => {
    if (!assignmentId) {
      toast.error("Assignment ID is missing. Cannot submit drill.");
      return;
    }

    if (!summary.trim()) {
      toast.error("Please write a summary before submitting");
      return;
    }

    if (wordCount < 50) {
      toast.error("Please write at least 50 words for your summary");
      return;
    }

    setIsSubmitting(true);
    try {
      const timeSpent = Math.floor((Date.now() - startTime) / 1000);
      // Score based on word count (basic scoring - can be improved with AI)
      const score = Math.min(100, Math.round((wordCount / 100) * 100));

      await drillAPI.complete(drill._id, {
        drillAssignmentId: assignmentId,
        score,
        timeSpent,
        summaryResults: {
          articleTitle,
          articleContent,
          summary,
          wordCount,
        },
        platform: 'web',
      });

      setIsCompleted(true);
      toast.success("Drill completed! Great job!");

      try {
        await fetch('/api/v1/activities/recent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            type: 'drill',
            resourceId: drill._id,
            action: 'completed',
            metadata: { title: drill.title, type: drill.type, score },
          }),
        });
      } catch (error) {
        console.error('Failed to track activity:', error);
      }
    } catch (error: any) {
      toast.error("Failed to submit drill: " + (error.message || "Unknown error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isCompleted) {
    return <DrillCompletionScreen drillType="summary" />;
  }

  return (
    <DrillLayout
      title={drill.title}
      backgroundGradient="bg-gradient-to-br from-green-50 to-emerald-50"
      maxWidth="3xl"
    >
        {/* Instructions */}
        <Card className="mb-6 bg-green-50 border-green-200">
          <div className="flex items-start gap-3">
            <FileText className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-green-900 mb-1">Instructions</p>
              <p className="text-sm text-green-800">
                Read the article below and write a comprehensive summary. Aim for at least 50 words.
              </p>
            </div>
          </div>
        </Card>

        {/* Article */}
        <Card className="mb-6 bg-white/90 backdrop-blur-sm shadow-lg">
          <div className="mb-4 pb-4 border-b border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-green-500" />
                {articleTitle}
              </h2>
              <TTSButton text={articleContent} />
            </div>
          </div>
          
          <div className="prose prose-sm max-w-none">
            <div className="text-gray-700 leading-relaxed whitespace-pre-wrap">
              {articleContent || "No article content provided."}
            </div>
          </div>
        </Card>

        {/* Summary Input */}
        <Card className="mb-6 bg-white/90 backdrop-blur-sm shadow-lg">
          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-green-500" />
              Write Your Summary
            </label>
            <div className="relative">
              <textarea
                className="w-full p-4 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all min-h-[200px] resize-none"
                placeholder="Write your summary here... Include the main points and key ideas from the article."
                value={summary}
                onChange={(e) => handleSummaryChange(e.target.value)}
              />
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-gray-500">
                  {wordCount} {wordCount === 1 ? 'word' : 'words'}
                  {wordCount < 50 && (
                    <span className="text-orange-600 ml-1">
                      (minimum 50 words)
                    </span>
                  )}
                </p>
                <div className={`text-xs font-medium ${
                  wordCount >= 50 ? 'text-green-600' : 'text-gray-400'
                }`}>
                  {wordCount >= 50 ? '✓ Ready to submit' : 'Keep writing...'}
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Submit Button */}
        <Button
          variant="primary"
          size="lg"
          fullWidth
          onClick={handleSubmit}
          disabled={isSubmitting || wordCount < 50}
          className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 disabled:opacity-50"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Submitting...
            </>
          ) : (
            "Submit Summary"
          )}
        </Button>
    </DrillLayout>
  );
}

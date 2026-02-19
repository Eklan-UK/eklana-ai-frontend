"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Mic, BookOpen, Clock, TrendingUp, Loader2, ChevronRight } from "lucide-react";
import { usePronunciationProblems } from "@/hooks/usePronunciations";
import Link from "next/link";

type FilterType = "all" | "word" | "sound" | "sentence";

export default function PronunciationPracticePage() {
  const router = useRouter();
  const [typeFilter, setTypeFilter] = useState<FilterType>("all");

  // Fetch all pronunciation problems
  const { data, isLoading, error } = usePronunciationProblems();
  const problems = data?.problems || [];

  // Filter problems by type
  const filteredProblems = typeFilter === "all"
    ? problems
    : problems.filter((p: any) => p.type === typeFilter);

  const getDifficultyColor = (difficulty: string) => {
    const colors: Record<string, string> = {
      beginner: "bg-green-100 text-green-700",
      intermediate: "bg-yellow-100 text-yellow-700",
      advanced: "bg-red-100 text-red-700",
    };
    return colors[difficulty] || "bg-gray-100 text-gray-700";
  };

  return (
    <div className="min-h-screen bg-white pb-20 md:pb-0">
      {/* Status Bar Space */}
      <div className="h-6"></div>

      <Header title="Pronunciation Practice" />

      <div className="max-w-md mx-auto px-4 py-6 md:max-w-4xl md:px-8">
        {/* Type Filter */}
        <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
          <Button
            variant={typeFilter === "all" ? "primary" : "outline"}
            size="sm"
            onClick={() => setTypeFilter("all")}
            className="whitespace-nowrap"
          >
            All Types
          </Button>
          <Button
            variant={typeFilter === "word" ? "primary" : "outline"}
            size="sm"
            onClick={() => setTypeFilter("word")}
            className="whitespace-nowrap"
          >
            Words
          </Button>
          <Button
            variant={typeFilter === "sound" ? "primary" : "outline"}
            size="sm"
            onClick={() => setTypeFilter("sound")}
            className="whitespace-nowrap"
          >
            Sounds
          </Button>
          <Button
            variant={typeFilter === "sentence" ? "primary" : "outline"}
            size="sm"
            onClick={() => setTypeFilter("sentence")}
            className="whitespace-nowrap"
          >
            Sentences
          </Button>
        </div>

        {/* Introduction */}
        <Card className="mb-6 bg-gradient-to-br from-blue-50 to-primary-50 border-blue-200">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Mic className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Practice Pronunciation</h2>
                <p className="text-sm text-gray-600">Improve your pronunciation with structured practice</p>
              </div>
            </div>
            <p className="text-sm text-gray-700">
              Select a pronunciation problem to practice. Each problem contains multiple words to help you master specific sounds.
            </p>
          </div>
        </Card>

        {/* Problems List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : error ? (
          <Card className="p-8 text-center">
            <p className="text-red-600">Failed to load pronunciation problems</p>
          </Card>
        ) : problems.length === 0 ? (
          <Card className="p-8 text-center">
            <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No problems available</h3>
            <p className="text-gray-500 text-sm">
              Check back later for new pronunciation practice problems.
            </p>
          </Card>
        ) : filteredProblems.length === 0 ? (
          <Card className="p-8 text-center">
            <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No problems found</h3>
            <p className="text-gray-500 text-sm">
              No pronunciation problems match the selected filter.
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredProblems.map((problem: any) => (
              <Link key={problem._id} href={`/account/practice/pronunciation/${problem.slug}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-gray-900 mb-2">
                          {problem.title}
                        </h3>
                        {problem.description && (
                          <p className="text-sm text-gray-600 mb-3">
                            {problem.description}
                          </p>
                        )}
                        <div className="flex items-center gap-3 flex-wrap">
                          {problem.type && (
                            <span className="px-3 py-1 rounded-full text-xs font-medium bg-primary-100 text-primary-700 capitalize">
                              {problem.type}
                            </span>
                          )}
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-medium ${getDifficultyColor(
                              problem.difficulty
                            )}`}
                          >
                            {problem.difficulty}
                          </span>
                          {problem.wordCount > 0 && (
                            <div className="flex items-center gap-1 text-sm text-gray-600">
                              <BookOpen className="w-4 h-4" />
                              <span>{problem.wordCount} word{problem.wordCount !== 1 ? 's' : ''}</span>
                            </div>
                          )}
                          {problem.estimatedTimeMinutes && (
                            <div className="flex items-center gap-1 text-sm text-gray-600">
                              <Clock className="w-4 h-4" />
                              <span>{problem.estimatedTimeMinutes} min</span>
                            </div>
                          )}
                        </div>
                        {problem.phonemes && problem.phonemes.length > 0 && (
                          <div className="mt-3">
                            <p className="text-xs text-gray-500 mb-1">Target phonemes:</p>
                            <div className="flex flex-wrap gap-2">
                              {problem.phonemes.map((phoneme: string, idx: number) => (
                                <span
                                  key={idx}
                                  className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-mono"
                                >
                                  /{phoneme}/
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <ChevronRight className="w-6 h-6 text-gray-400 flex-shrink-0 ml-4" />
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}

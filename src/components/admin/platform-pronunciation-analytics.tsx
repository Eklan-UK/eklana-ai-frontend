"use client";

import { Loader2, Mic, AlertCircle, Volume2 } from "lucide-react";
import { useOverallPronunciationAnalytics } from "@/hooks/usePronunciations";

interface PlatformPronunciationAnalyticsProps {
  days?: number;
  showTitle?: boolean;
}

export function PlatformPronunciationAnalytics({
  days = 30,
  showTitle = true,
}: PlatformPronunciationAnalyticsProps) {
  const {
    data: pronunciationAnalytics,
    isLoading: pronunciationLoading,
    isError: pronunciationError,
  } = useOverallPronunciationAnalytics(days);

  return (
    <section className="bg-white rounded-2xl border border-gray-100 p-6">
      {showTitle ? (
        <div className="flex items-center justify-between mb-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
            <span className="p-2 bg-blue-50 rounded-lg">
              <Mic className="w-4 h-4 text-blue-600" />
            </span>
            Pronunciation Analytics (Last {days} Days)
          </h2>
        </div>
      ) : null}

      {pronunciationLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : pronunciationError ? (
        <div className="text-center py-8 text-red-500">
          Failed to load pronunciation analytics.
        </div>
      ) : !pronunciationAnalytics ? (
        <div className="text-center py-8 text-gray-500">
          No pronunciation data available.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
              <p className="text-xs font-medium text-gray-500 uppercase mb-1">Total Attempts</p>
              <p className="text-2xl font-bold text-gray-900">
                {pronunciationAnalytics.stats?.totalAttempts || 0}
              </p>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
              <p className="text-xs font-medium text-gray-500 uppercase mb-1">Average Score</p>
              <p
                className={`text-2xl font-bold ${
                  (pronunciationAnalytics.stats?.averageScore || 0) >= 70
                    ? "text-green-600"
                    : "text-amber-600"
                }`}
              >
                {pronunciationAnalytics.stats?.averageScore || 0}%
              </p>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
              <p className="text-xs font-medium text-gray-500 uppercase mb-1">Pass Rate</p>
              <p className="text-2xl font-bold text-blue-600">
                {pronunciationAnalytics.stats?.passRate || 0}%
              </p>
            </div>
          </div>

          <div className="bg-red-50/50 rounded-xl border border-red-100 p-4">
            <h3 className="text-sm font-bold text-red-800 mb-3 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Most Difficult Letters
            </h3>
            {pronunciationAnalytics.problemAreas?.topIncorrectLetters?.length > 0 ? (
              <div className="space-y-2">
                {pronunciationAnalytics.problemAreas.topIncorrectLetters.map(
                  (item: { letter: string; count: number; words?: { word: string; count: number }[] }, i: number) => (
                    <div key={i} className="p-3 bg-white border border-red-100 rounded-lg">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="font-mono font-bold text-red-700">{item.letter}</span>
                        <span className="text-xs text-red-600 font-bold ml-auto">×{item.count}</span>
                      </div>
                      {item.words && item.words.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {item.words.map((w, wi) => (
                            <span
                              key={wi}
                              className="px-2 py-0.5 bg-red-50 border border-red-200 rounded text-xs text-gray-800"
                            >
                              {w.word}
                              <span className="text-red-500 ml-1">×{w.count}</span>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-500 italic">No word data yet</p>
                      )}
                    </div>
                  )
                )}
              </div>
            ) : (
              <p className="text-xs text-gray-500 italic">No data available</p>
            )}
          </div>

          <div className="bg-orange-50/50 rounded-xl border border-orange-100 p-4">
            <h3 className="text-sm font-bold text-orange-800 mb-3 flex items-center gap-2">
              <Volume2 className="w-4 h-4" />
              Most Difficult Sounds
            </h3>
            {pronunciationAnalytics.problemAreas?.topIncorrectPhonemes?.length > 0 ? (
              <div className="space-y-2">
                {pronunciationAnalytics.problemAreas.topIncorrectPhonemes.map(
                  (item: { phoneme: string; count: number; words?: { word: string; count: number }[] }, i: number) => (
                    <div key={i} className="p-3 bg-white border border-orange-100 rounded-lg">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Volume2 className="w-3.5 h-3.5 text-orange-500" />
                        <span className="text-sm font-semibold text-orange-700">/{item.phoneme}/</span>
                        <span className="text-xs text-orange-600 font-bold ml-auto">×{item.count}</span>
                      </div>
                      {item.words && item.words.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {item.words.map((w, wi) => (
                            <span
                              key={wi}
                              className="px-2 py-0.5 bg-orange-50 border border-orange-200 rounded text-xs text-gray-800"
                            >
                              {w.word}
                              <span className="text-orange-500 ml-1">×{w.count}</span>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-500 italic">No word data yet</p>
                      )}
                    </div>
                  )
                )}
              </div>
            ) : (
              <p className="text-xs text-gray-500 italic">No data available</p>
            )}
          </div>

          <div className="lg:col-span-1 rounded-xl border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
              <h3 className="text-sm font-bold text-gray-900">Most Difficult Words</h3>
            </div>
            <div className="max-h-[300px] overflow-y-auto">
              {pronunciationAnalytics.difficultWords?.length > 0 ? (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">Word</th>
                      <th className="px-4 py-2 text-right font-medium">Avg Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {pronunciationAnalytics.difficultWords.map(
                      (word: { word: string; avgScore: number }, i: number) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-4 py-2 font-medium text-gray-900">{word.word}</td>
                          <td className="px-4 py-2 text-right">
                            <span
                              className={`font-bold ${
                                word.avgScore < 60 ? "text-red-600" : "text-amber-600"
                              }`}
                            >
                              {word.avgScore}%
                            </span>
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              ) : (
                <div className="p-4 text-center text-xs text-gray-500 italic">No data available</div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

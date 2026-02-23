"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Headphones, BookOpen, Clock, Loader2, ChevronRight } from "lucide-react";
import { drillAPI } from "@/lib/api";
import Link from "next/link";

export default function ListeningPracticePage() {
  const router = useRouter();
  const [drills, setDrills] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchListeningDrills = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch all learner drills to get assignment info
        const response = await drillAPI.getLearnerDrills();
        const allDrills = (response as any).data?.drills || (response as any).drills || [];

        // Filter for listening type drills
        const listeningDrills = allDrills
          .filter((item: any) => {
            const drill = item.drill || item;
            return drill.type === "listening";
          })
          .map((item: any) => ({
            drill: item.drill || item,
            assignmentId: item.assignmentId,
          }));

        setDrills(listeningDrills);
      } catch (err: any) {
        console.error("Failed to fetch listening drills:", err);
        setError(err.message || "Failed to load listening drills");
      } finally {
        setIsLoading(false);
      }
    };

    fetchListeningDrills();
  }, []);

  const getDifficultyColor = (difficulty?: string) => {
    if (!difficulty) return "bg-gray-100 text-gray-700";
    const colors: Record<string, string> = {
      beginner: "bg-green-100 text-green-700",
      intermediate: "bg-yellow-100 text-yellow-700",
      advanced: "bg-red-100 text-red-700",
    };
    return colors[difficulty.toLowerCase()] || "bg-gray-100 text-gray-700";
  };

  const handleDrillClick = (drill: any, assignmentId?: string) => {
    const drillId = drill._id || drill.id;
    if (!drillId) {
      console.error("Drill ID not found");
      return;
    }

    // Navigate to drill detail page with optional assignmentId
    const url = assignmentId
      ? `/account/drills/${drillId}?assignmentId=${assignmentId}`
      : `/account/drills/${drillId}`;
    router.push(url);
  };

  return (
    <div className="min-h-screen bg-white pb-20 md:pb-0">
      {/* Status Bar Space */}
      <div className="h-6"></div>

      <Header showBack title="Listening Practice" />

      <div className="max-w-md md:max-w-2xl mx-auto px-4 md:px-8 py-6">
        {/* Introduction */}
        <Card className="mb-6 bg-gradient-to-br from-primary-50 to-blue-50 border-primary-200">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
                <Headphones className="w-6 h-6 text-primary-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Listening Exercises</h2>
                <p className="text-sm text-gray-600">Improve your listening comprehension</p>
              </div>
            </div>
            <p className="text-sm text-gray-700">
              Select a listening drill to practice. Listen to the content and complete the exercises to improve your listening skills.
            </p>
          </div>
        </Card>

        {/* Drills List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
          </div>
        ) : error ? (
          <Card className="p-8 text-center">
            <p className="text-red-600">{error}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => window.location.reload()}
            >
              Try Again
            </Button>
          </Card>
        ) : drills.length === 0 ? (
          <Card className="p-8 text-center">
            <Headphones className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No listening drills available</h3>
            <p className="text-gray-500 text-sm">
              Check back later for new listening practice drills.
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {drills.map((item, index) => {
              const drill = item.drill;
              const drillId = drill._id || drill.id;
              const assignmentId = item.assignmentId;

              return (
                <Card
                  key={drillId || index}
                  className="hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => handleDrillClick(drill, assignmentId)}
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-gray-900 mb-2">
                          {drill.title}
                        </h3>
                        {drill.context && (
                          <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                            {drill.context}
                          </p>
                        )}
                        {drill.listening_drill_title && drill.listening_drill_title !== drill.title && (
                          <p className="text-sm text-gray-700 mb-3 font-medium">
                            {drill.listening_drill_title}
                          </p>
                        )}
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="px-3 py-1 rounded-full text-xs font-medium bg-primary-100 text-primary-700 capitalize">
                            Listening
                          </span>
                          {drill.difficulty && (
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-medium ${getDifficultyColor(
                                drill.difficulty
                              )}`}
                            >
                              {drill.difficulty}
                            </span>
                          )}
                          {drill.duration_days && (
                            <div className="flex items-center gap-1 text-sm text-gray-600">
                              <Clock className="w-4 h-4" />
                              <span>{drill.duration_days} day{drill.duration_days !== 1 ? 's' : ''}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="w-6 h-6 text-gray-400 flex-shrink-0 ml-4" />
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}

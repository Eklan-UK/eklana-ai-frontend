"use client";

import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  Search,
  BookOpen,
  Users,
  Clock,
  ChevronRight,
  Edit,
  Trash2,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { tutorAPI, drillAPI } from "@/lib/api";

interface DrillsListClientProps {
  initialDrills: any[];
}

export function DrillsListClient({ initialDrills }: DrillsListClientProps) {
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [drills, setDrills] = useState<any[]>(initialDrills);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadDrills();
  }, [filter]);

  const loadDrills = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (filter === "active") {
        params.isActive = true;
      } else if (filter === "inactive") {
        params.isActive = false;
      }
      const response = await tutorAPI.getMyDrills(params);
      setDrills(response.drills || []);
    } catch (error) {
      console.error("Failed to load drills:", error);
      setDrills([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (drillId: string) => {
    if (!confirm("Are you sure you want to delete this drill? This action cannot be undone.")) {
      return;
    }

    setDeletingId(drillId);
    try {
      await drillAPI.delete(drillId);
      await loadDrills(); // Reload drills
    } catch (error: any) {
      alert(error.message || "Failed to delete drill");
    } finally {
      setDeletingId(null);
    }
  };

  const filteredDrills = drills.filter((drill) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        drill.title?.toLowerCase().includes(query) ||
        drill.type?.toLowerCase().includes(query) ||
        drill.difficulty?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "vocabulary":
        return "📚";
      case "roleplay":
        return "💬";
      case "grammar":
        return "📝";
      case "matching":
        return "🔗";
      case "summary":
        return "📄";
      default:
        return "📖";
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "beginner":
        return "bg-green-100 text-green-700";
      case "intermediate":
        return "bg-yellow-100 text-yellow-700";
      case "advanced":
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <>
      {/* Search and Filter */}
      <div className="mb-6 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search drills..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={filter === "all" ? "primary" : "outline"}
            size="sm"
            onClick={() => setFilter("all")}
          >
            All
          </Button>
          <Button
            variant={filter === "active" ? "primary" : "outline"}
            size="sm"
            onClick={() => setFilter("active")}
          >
            Active
          </Button>
          <Button
            variant={filter === "inactive" ? "primary" : "outline"}
            size="sm"
            onClick={() => setFilter("inactive")}
          >
            Inactive
          </Button>
        </div>
      </div>

      {/* Drills List */}
      <div className="space-y-4">
        {loading ? (
          <Card className="p-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-green-600 mx-auto mb-4" />
            <p className="text-gray-600">Loading drills...</p>
          </Card>
        ) : filteredDrills.length === 0 ? (
          <Card className="p-12 text-center">
            <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No drills found
            </h3>
            <p className="text-gray-600 mb-4">
              {searchQuery
                ? "No drills match your search"
                : filter === "all"
                ? "Create your first drill to get started"
                : `No ${filter} drills found`}
            </p>
            {filter === "all" && !searchQuery && (
              <Link href="/tutor/drills/create">
                <Button variant="primary">Create Drill</Button>
              </Link>
            )}
          </Card>
        ) : (
          filteredDrills.map((drill) => {
            const assignedCount = Array.isArray(drill.assigned_to)
              ? drill.assigned_to.length
              : drill.assigned_to
              ? 1
              : 0;
            const startDate = new Date(drill.date);
            const endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + (drill.duration_days || 1) - 1);

            return (
              <Card key={drill._id || drill.id} className="hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl">{getTypeIcon(drill.type)}</span>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {drill.title}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${getDifficultyColor(
                              drill.difficulty
                            )}`}
                          >
                            {drill.difficulty}
                          </span>
                          <span className="text-xs text-gray-500 capitalize">
                            {drill.type}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-sm text-gray-600 mt-3">
                      <div className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        <span>{assignedCount} student{assignedCount !== 1 ? "s" : ""}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        <span>
                          {startDate.toLocaleDateString()} - {endDate.toLocaleDateString()}
                        </span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          drill.is_active
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {drill.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <Link href={`/tutor/drills/${drill._id || drill.id}/edit`}>
                      <button className="p-2 hover:bg-gray-100 rounded-lg transition">
                        <Edit className="w-5 h-5 text-gray-600" />
                      </button>
                    </Link>
                    <button
                      onClick={() => handleDelete(drill._id || drill.id)}
                      disabled={deletingId === (drill._id || drill.id)}
                      className="p-2 hover:bg-red-50 rounded-lg transition disabled:opacity-50"
                    >
                      {deletingId === (drill._id || drill.id) ? (
                        <Loader2 className="w-5 h-5 text-red-600 animate-spin" />
                      ) : (
                        <Trash2 className="w-5 h-5 text-red-600" />
                      )}
                    </button>
                    <Link href={`/tutor/drills/${drill._id || drill.id}`}>
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </Link>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </>
  );
}


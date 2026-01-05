"use client";

import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Search, BookOpen, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useTutorDrills, useDeleteDrill } from "@/hooks/useDrills";
import { TutorDrillCard } from "@/components/drills/TutorDrillCard";

interface DrillsListClientProps {
  initialDrills: any[];
}

export function DrillsListClient({ initialDrills }: DrillsListClientProps) {
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Use React Query instead of useEffect + useState
  const filters = filter === "all" ? {} : { isActive: filter === "active" };
  const { data: drills = initialDrills, isLoading: loading } = useTutorDrills(filters);
  const deleteMutation = useDeleteDrill();

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
          filteredDrills.map((drill) => (
            <TutorDrillCard
              key={drill._id || drill.id}
              drill={drill}
              onDelete={(id) => {
                if (confirm("Are you sure you want to delete this drill? This action cannot be undone.")) {
                  deleteMutation.mutate(id);
                }
              }}
              isDeleting={deleteMutation.isPending}
            />
          ))
        )}
      </div>
    </>
  );
}


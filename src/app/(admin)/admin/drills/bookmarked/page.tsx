"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Edit,
  Eye,
  Loader2,
  Search,
  X,
} from "lucide-react";
import { useBookmarkedDrills } from "@/hooks/useAdmin";
import { AdminDrillBookmarkButton } from "@/components/admin/AdminDrillBookmarkButton";
import {
  LEARNING_JOURNEY_PARTS,
  getPartLabel,
  getTopicsForPart,
  parseLearningJourneyPartId,
  type LearningJourneyPartId,
} from "@/domain/learning-journey/learning-journey.catalog";
import { getDrillTopicTitle } from "@/lib/drill-display-label";
import { getDrillIcon, getDrillTypeLabel } from "@/utils/drill";

interface BookmarkedDrill {
  _id: string;
  title: string;
  type: string;
  context?: string;
  learning_journey_part?: number | null;
  learning_journey_topic?: string | null;
  is_bookmarked?: boolean;
  bookmarked_at?: string | null;
}

const PAGE_SIZE = 50;
const PAGE_PATH = "/admin/drills/bookmarked";

const DRILL_TYPE_OPTIONS = [
  { value: "all", label: "All Types" },
  { value: "vocabulary", label: "Vocabulary" },
  { value: "roleplay", label: "Roleplay" },
  { value: "matching", label: "Matching" },
  { value: "definition", label: "Definition" },
  { value: "summary", label: "Summary" },
  { value: "grammar", label: "Grammar" },
  { value: "sentence_writing", label: "Sentence Writing" },
  { value: "sentence", label: "Sentence" },
  { value: "listening", label: "Listening" },
  { value: "pronunciation", label: "Pronunciation" },
  { value: "fill_blank", label: "Fill in the Blank" },
  { value: "key_phrases", label: "Key Phrases" },
] as const;

type BookmarkedFilters = {
  q: string;
  type: string;
  mission: string;
  topic: string;
  offset: number;
};

function parseFilters(searchParams: URLSearchParams): BookmarkedFilters {
  const offsetRaw = parseInt(searchParams.get("offset") || "0", 10);
  return {
    q: searchParams.get("q") || "",
    type: searchParams.get("type") || "all",
    mission: searchParams.get("mission") || "",
    topic: searchParams.get("topic") || "",
    offset: Number.isFinite(offsetRaw) && offsetRaw > 0 ? offsetRaw : 0,
  };
}

function buildPath(filters: BookmarkedFilters): string {
  const params = new URLSearchParams();
  if (filters.q.trim()) params.set("q", filters.q.trim());
  if (filters.type && filters.type !== "all") params.set("type", filters.type);
  if (filters.mission) params.set("mission", filters.mission);
  if (filters.topic) params.set("topic", filters.topic);
  if (filters.offset > 0) params.set("offset", String(filters.offset));
  const qs = params.toString();
  return qs ? `${PAGE_PATH}?${qs}` : PAGE_PATH;
}

function BookmarkedDrillsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filters = useMemo(() => parseFilters(searchParams), [searchParams]);

  const [searchDraft, setSearchDraft] = useState(filters.q);

  useEffect(() => {
    setSearchDraft(filters.q);
  }, [filters.q]);

  const updateFilters = useCallback(
    (partial: Partial<BookmarkedFilters>) => {
      const next = { ...filters, ...partial };
      if ("mission" in partial && partial.mission !== filters.mission) {
        next.topic = "";
      }
      router.replace(buildPath(next), { scroll: false });
    },
    [filters, router]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchDraft !== filters.q) {
        updateFilters({ q: searchDraft, offset: 0 });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchDraft, filters.q, updateFilters]);

  const missionPart = parseLearningJourneyPartId(filters.mission);
  const topics = missionPart ? getTopicsForPart(missionPart) : [];

  const queryFilters = useMemo(
    () => ({
      limit: PAGE_SIZE,
      offset: filters.offset,
      q: filters.q.trim() || undefined,
      type: filters.type !== "all" ? filters.type : undefined,
      learningJourneyPart: missionPart ?? undefined,
      learningJourneyTopic: filters.topic || undefined,
    }),
    [filters.offset, filters.q, filters.type, filters.topic, missionPart]
  );

  const { data, isLoading: loading } = useBookmarkedDrills(queryFilters);
  const drills = (data?.drills ?? []) as BookmarkedDrill[];
  const total = data?.total ?? 0;

  const filtersActive =
    Boolean(filters.q.trim()) ||
    filters.type !== "all" ||
    Boolean(filters.mission) ||
    Boolean(filters.topic);

  const clearFilters = () => {
    router.replace(PAGE_PATH, { scroll: false });
  };

  const formatMission = (part?: number | null) => {
    const parsed = parseLearningJourneyPartId(part);
    return parsed ? getPartLabel(parsed) : "—";
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <Bookmark className="w-5 h-5 text-amber-500" fill="currentColor" />
            Bookmark Drills
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Admin library of bookmarked drills, filterable by mission, topic, and
            type
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by title..."
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#418b43] focus:border-transparent"
            />
          </div>

          <select
            value={filters.mission}
            onChange={(e) =>
              updateFilters({ mission: e.target.value, offset: 0 })
            }
            className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#418b43] focus:border-transparent"
          >
            <option value="">All missions</option>
            {LEARNING_JOURNEY_PARTS.map((part) => (
              <option key={part.part} value={String(part.part)}>
                {getPartLabel(part.part as LearningJourneyPartId)}
              </option>
            ))}
          </select>

          <select
            value={filters.topic}
            onChange={(e) =>
              updateFilters({ topic: e.target.value, offset: 0 })
            }
            disabled={!missionPart}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#418b43] focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400"
          >
            <option value="">
              {missionPart ? "All topics" : "Select a mission first"}
            </option>
            {topics.map((topic) => (
              <option key={topic.id} value={topic.id}>
                {topic.title}
              </option>
            ))}
          </select>

          <select
            value={filters.type}
            onChange={(e) =>
              updateFilters({ type: e.target.value, offset: 0 })
            }
            className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#418b43] focus:border-transparent"
          >
            {DRILL_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {filtersActive && (
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
              Clear filters
            </button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50/50">
              <tr>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Drill
                </th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Mission
                </th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Topic
                </th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" />
                  </td>
                </tr>
              ) : drills.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-12 text-center text-gray-500"
                  >
                    <Bookmark className="w-8 h-8 mx-auto mb-3 text-gray-300" />
                    <p className="font-medium text-gray-700">
                      {filtersActive
                        ? "No bookmarked drills match these filters"
                        : "No bookmarked drills yet"}
                    </p>
                    <p className="text-sm mt-1">
                      {filtersActive
                        ? "Try clearing filters or adjusting your search."
                        : "Bookmark a drill from Old Drill Builder or a week list to see it here."}
                    </p>
                  </td>
                </tr>
              ) : (
                drills.map((drill) => (
                  <tr
                    key={drill._id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-2xl shrink-0">
                          {getDrillIcon(drill.type)}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {drill.title}
                          </p>
                          {drill.context && (
                            <p className="text-xs text-gray-500 line-clamp-1">
                              {drill.context}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 capitalize">
                        {getDrillTypeLabel(drill.type)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {formatMission(drill.learning_journey_part)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {getDrillTopicTitle(drill) ?? "—"}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <AdminDrillBookmarkButton
                          drillId={drill._id}
                          isBookmarked={drill.is_bookmarked !== false}
                        />
                        <Link
                          href={`/admin/drills/${drill._id}`}
                          className="p-2 text-gray-600 hover:text-[#418b43] hover:bg-emerald-50 rounded-lg transition-colors"
                          title="View drill"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        <Link
                          href={`/admin/drills/create?drillId=${drill._id}`}
                          className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {total > 0 && (
          <div className="mt-6 flex items-center justify-between px-6 pb-6">
            <p className="text-sm text-gray-500">
              Showing {filters.offset + 1}–
              {Math.min(filters.offset + PAGE_SIZE, total)} of {total} drills
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() =>
                  updateFilters({
                    offset: Math.max(0, filters.offset - PAGE_SIZE),
                  })
                }
                disabled={filters.offset === 0 || loading}
                className="p-2 border border-gray-200 rounded-lg text-gray-400 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() =>
                  updateFilters({ offset: filters.offset + PAGE_SIZE })
                }
                disabled={filters.offset + PAGE_SIZE >= total || loading}
                className="p-2 border border-gray-200 rounded-lg text-gray-400 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const BookmarkedDrillsPage: React.FC = () => {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      }
    >
      <BookmarkedDrillsPageContent />
    </Suspense>
  );
};

export default BookmarkedDrillsPage;

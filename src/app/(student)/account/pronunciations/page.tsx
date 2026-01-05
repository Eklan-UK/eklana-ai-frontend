"use client";

import React, { useState, useMemo } from "react";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  Mic,
  Play,
  Volume2,
  CheckCircle,
  Clock,
  Loader2,
  Search,
  Filter,
} from "lucide-react";
import { useLearnerPronunciations } from "@/hooks/usePronunciations";
import Link from "next/link";

interface PronunciationAssignment {
  assignmentId: string;
  pronunciation: {
    _id: string;
    title: string;
    text: string;
    phonetic?: string;
    difficulty: string;
    audioUrl: string;
    description?: string;
  };
  status: string;
  dueDate?: string;
  assignedAt: string;
  attemptsCount: number;
  bestScore?: number;
}

export default function LearnerPronunciationsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [playingId, setPlayingId] = useState<string | null>(null);

  const { data, isLoading: loading } = useLearnerPronunciations({ limit: 100 });
  const assignments = data?.pronunciations || [];

  const filteredAssignments = useMemo(
    () =>
      assignments.filter((assignment: PronunciationAssignment) => {
        const matchesSearch =
          assignment.pronunciation.title
            .toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          assignment.pronunciation.text
            .toLowerCase()
            .includes(searchTerm.toLowerCase());
        const matchesStatus =
          filterStatus === "all" || assignment.status === filterStatus;

        return matchesSearch && matchesStatus;
      }),
    [assignments, searchTerm, filterStatus]
  );

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { color: string; label: string }> = {
      pending: { color: "bg-gray-100 text-gray-700", label: "Pending" },
      "in-progress": { color: "bg-blue-100 text-blue-700", label: "In Progress" },
      completed: { color: "bg-green-100 text-green-700", label: "Completed" },
      overdue: { color: "bg-red-100 text-red-700", label: "Overdue" },
      skipped: { color: "bg-yellow-100 text-yellow-700", label: "Skipped" },
    };
    const badge = badges[status] || badges.pending;
    return (
      <span
        className={`px-2.5 py-1 rounded-full text-xs font-medium ${badge.color}`}
      >
        {badge.label}
      </span>
    );
  };

  const getDifficultyColor = (difficulty: string) => {
    const colors: Record<string, string> = {
      beginner: "bg-green-100 text-green-700",
      intermediate: "bg-yellow-100 text-yellow-700",
      advanced: "bg-red-100 text-red-700",
    };
    return colors[difficulty] || "bg-gray-100 text-gray-700";
  };

  const handlePlayAudio = (audioUrl: string, id: string) => {
    const audio = new Audio(audioUrl);
    setPlayingId(id);
    audio.play();
    audio.onended = () => setPlayingId(null);
    audio.onerror = () => {
      setPlayingId(null);
      console.error("Error playing audio");
    };
  };

  const stats = useMemo(() => {
    const total = assignments.length;
    const completed = assignments.filter(
      (a: PronunciationAssignment) => a.status === "completed"
    ).length;
    const inProgress = assignments.filter(
      (a: PronunciationAssignment) => a.status === "in-progress"
    ).length;
    const pending = assignments.filter(
      (a: PronunciationAssignment) => a.status === "pending"
    ).length;

    return { total, completed, inProgress, pending };
  }, [assignments]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="h-6"></div>
      <Header title="My Pronunciations" />

      <div className="max-w-7xl mx-auto px-4 py-6 md:px-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="p-4">
            <div className="text-sm text-gray-600 mb-1">Total</div>
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-gray-600 mb-1">Completed</div>
            <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-gray-600 mb-1">In Progress</div>
            <div className="text-2xl font-bold text-blue-600">{stats.inProgress}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-gray-600 mb-1">Pending</div>
            <div className="text-2xl font-bold text-gray-600">{stats.pending}</div>
          </Card>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search pronunciations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#418b43] focus:border-transparent"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#418b43] focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="in-progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>
        </div>

        {/* Pronunciations List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : filteredAssignments.length === 0 ? (
          <Card className="p-12 text-center">
            <Mic className="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">No pronunciations assigned yet</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAssignments.map((assignment: PronunciationAssignment) => (
              <Card key={assignment.assignmentId} className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900 mb-1">
                      {assignment.pronunciation.title}
                    </h3>
                    {assignment.pronunciation.phonetic && (
                      <p className="text-sm text-gray-500 mb-2">
                        {assignment.pronunciation.phonetic}
                      </p>
                    )}
                    <span
                      className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${getDifficultyColor(
                        assignment.pronunciation.difficulty
                      )}`}
                    >
                      {assignment.pronunciation.difficulty}
                    </span>
                  </div>
                  {getStatusBadge(assignment.status)}
                </div>

                <p className="text-sm text-gray-700 mb-4">
                  {assignment.pronunciation.text}
                </p>

                {assignment.pronunciation.description && (
                  <p className="text-xs text-gray-500 mb-4">
                    {assignment.pronunciation.description}
                  </p>
                )}

                <div className="flex items-center gap-4 mb-4">
                  <button
                    onClick={() =>
                      handlePlayAudio(
                        assignment.pronunciation.audioUrl,
                        assignment.pronunciation._id
                      )
                    }
                    className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    {playingId === assignment.pronunciation._id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Volume2 className="w-4 h-4" />
                    )}
                    <span className="text-sm font-medium">Play Audio</span>
                  </button>
                </div>

                <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
                  <div className="flex items-center gap-2">
                    <Clock className="w-3 h-3" />
                    {assignment.dueDate
                      ? `Due: ${new Date(assignment.dueDate).toLocaleDateString()}`
                      : "No due date"}
                  </div>
                  {assignment.attemptsCount > 0 && (
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-3 h-3" />
                      {assignment.attemptsCount} attempt
                      {assignment.attemptsCount !== 1 ? "s" : ""}
                      {assignment.bestScore && ` • Best: ${assignment.bestScore}%`}
                    </div>
                  )}
                </div>

                <Link
                  href={`/account/pronunciations/${assignment.pronunciation._id}?assignmentId=${assignment.assignmentId}`}
                >
                  <Button className="w-full" variant="primary">
                    Practice Now
                  </Button>
                </Link>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


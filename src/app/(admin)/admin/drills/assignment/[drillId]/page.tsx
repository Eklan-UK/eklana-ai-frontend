"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  User,
  Check,
  Loader2,
  Search,
  Clock,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useDrillById, useAllLearners, useAssignDrill } from "@/hooks/useAdmin";
import { toast } from "sonner";

interface User {
  _id: string;
  email: string;
  firstName?: string;
  lastName?: string;
}

interface Drill {
  _id: string;
  title: string;
  type: string;
  difficulty: string;
  date: string;
  duration_days: number;
  context?: string;
  assigned_to: string[];
  created_by: string;
  is_active: boolean;
}

export default function DrillAssignmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const drillId = params.drillId as string;

  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(
    new Set()
  );
  const [searchTerm, setSearchTerm] = useState("");

  // Use React Query instead of useEffect + useState
  const { data: drill, isLoading: drillLoading } = useDrillById(drillId);
  const { data: learnersData, isLoading: learnersLoading } = useAllLearners({
    limit: 200,
  });
  const assignMutation = useAssignDrill();

  const users = learnersData?.learners || [];
  const loading = drillLoading || learnersLoading;

  // Pre-select users who are already assigned (assigned_to now contains user IDs)
  useEffect(() => {
    if (drill?.assigned_to && Array.isArray(drill.assigned_to) && users.length > 0) {
      const assignedUserIds = new Set<string>(drill.assigned_to.map((id: string) => id.toString()));
      setSelectedUserIds(assignedUserIds);
    }
  }, [drill?.assigned_to, users]);

  const handleToggleUser = (userId: string) => {
    const newSelected = new Set(selectedUserIds);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedUserIds(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedUserIds.size === filteredUsers.length) {
      setSelectedUserIds(new Set());
    } else {
      setSelectedUserIds(
        new Set(filteredUsers.map((u) => u._id.toString()))
      );
    }
  };

  const handleSubmit = async () => {
    if (selectedUserIds.size === 0) {
      toast.error("Please select at least one user");
      return;
    }

    if (!drill) return;

    // Calculate due date based on drill date and duration
    const dueDate = new Date(
      new Date(drill.date).getTime() +
        drill.duration_days * 24 * 60 * 60 * 1000
    ).toISOString();

    assignMutation.mutate(
      {
        drillId,
        data: {
          userIds: Array.from(selectedUserIds),
          dueDate,
        },
      },
      {
        onSuccess: () => {
          router.push("/admin/drills/assignment");
        },
      }
    );
  };

  const filteredUsers = useMemo(() => users.filter((user: User) => {
    const email = user.email?.toLowerCase() || "";
    const firstName = user.firstName?.toLowerCase() || "";
    const lastName = user.lastName?.toLowerCase() || "";
    const search = searchTerm.toLowerCase();
    return (
      email.includes(search) ||
      firstName.includes(search) ||
      lastName.includes(search)
    );
  }), [users, searchTerm]);

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      vocabulary: "bg-blue-100 text-blue-700",
      roleplay: "bg-purple-100 text-purple-700",
      matching: "bg-green-100 text-green-700",
      definition: "bg-yellow-100 text-yellow-700",
      grammar: "bg-red-100 text-red-700",
      sentence_writing: "bg-indigo-100 text-indigo-700",
      summary: "bg-pink-100 text-pink-700",
    };
    return colors[type] || "bg-gray-100 text-gray-700";
  };

  const getDifficultyColor = (difficulty: string) => {
    const colors: Record<string, string> = {
      beginner: "bg-green-100 text-green-700",
      intermediate: "bg-yellow-100 text-yellow-700",
      advanced: "bg-red-100 text-red-700",
    };
    return colors[difficulty] || "bg-gray-100 text-gray-700";
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-[#418b43]" />
      </div>
    );
  }

  if (!drill) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">Drill not found</p>
          <Link
            href="/admin/drills/assignment"
            className="mt-4 inline-flex items-center gap-2 text-[#418b43] hover:underline"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Assignment List
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <div className="max-w-7xl mx-auto px-4 py-6 md:px-8">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/admin/drills/assignment"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Assignment List
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Assign Drill</h1>
          <p className="text-gray-500 text-sm">
            Select students to assign this drill to
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Side - Drill Details */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-[#418b43] rounded-xl flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Drill Details</h2>
                <p className="text-sm text-gray-500">Review drill information</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                  Title
                </label>
                <p className="text-base font-semibold text-gray-900 mt-1">
                  {drill.title}
                </p>
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                    Type
                  </label>
                  <div className="mt-1">
                    <span
                      className={`inline-block px-3 py-1 text-xs font-bold rounded-full ${getTypeColor(
                        drill.type
                      )}`}
                    >
                      {drill.type.replace("_", " ")}
                    </span>
                  </div>
                </div>
                <div className="flex-1">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                    Difficulty
                  </label>
                  <div className="mt-1">
                    <span
                      className={`inline-block px-3 py-1 text-xs font-bold rounded-full ${getDifficultyColor(
                        drill.difficulty
                      )}`}
                    >
                      {drill.difficulty}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                    Start Date
                  </label>
                  <div className="mt-1 flex items-center gap-2 text-sm text-gray-600">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    {new Date(drill.date).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex-1">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                    Duration
                  </label>
                  <div className="mt-1 flex items-center gap-2 text-sm text-gray-600">
                    <Clock className="w-4 h-4 text-gray-400" />
                    {drill.duration_days} day{drill.duration_days !== 1 ? "s" : ""}
                  </div>
                </div>
              </div>

              {drill.context && (
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                    Context
                  </label>
                  <p className="text-sm text-gray-600 mt-1">{drill.context}</p>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                  Created By
                </label>
                <p className="text-sm text-gray-600 mt-1">{drill.created_by}</p>
              </div>
            </div>
          </div>

          {/* Right Side - Student Selection */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  Select Students
                </h2>
                <p className="text-sm text-gray-500">
                  {selectedUserIds.size} of {filteredUsers.length} selected
                </p>
              </div>
              <button
                onClick={handleSelectAll}
                className="text-sm text-[#418b43] hover:underline font-medium"
              >
                {selectedUserIds.size === filteredUsers.length
                  ? "Deselect All"
                  : "Select All"}
              </button>
            </div>

            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search students..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#418b43] focus:border-transparent"
              />
            </div>

            {/* Students List */}
            <div className="max-h-[500px] overflow-y-auto space-y-2 mb-6">
              {filteredUsers.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <User className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p>No students found</p>
                </div>
              ) : (
                filteredUsers.map((user: User) => {
                  const userId = user._id.toString();
                  const isSelected = selectedUserIds.has(userId);
                  const firstName = user.firstName || "";
                  const lastName = user.lastName || "";
                  const email = user.email || "";
                  const name = `${firstName} ${lastName}`.trim() || email;

                  return (
                    <div
                      key={user._id}
                      onClick={() => handleToggleUser(userId)}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                        isSelected
                          ? "border-[#418b43] bg-green-50"
                          : "border-gray-100 hover:border-gray-200"
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                          isSelected
                            ? "bg-[#418b43] border-[#418b43]"
                            : "border-gray-300"
                        }`}
                      >
                        {isSelected && (
                          <Check className="w-3 h-3 text-white" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-900">
                          {name}
                        </p>
                        <p className="text-xs text-gray-500">{email}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Submit Button */}
            <button
              onClick={handleSubmit}
              disabled={assignMutation.isPending || selectedUserIds.size === 0}
              className="w-full py-3 bg-[#418b43] text-white font-medium rounded-xl hover:bg-[#3a7c3b] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {assignMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Assigning...
                </>
              ) : (
                <>
                  Assign to {selectedUserIds.size} User
                  {selectedUserIds.size !== 1 ? "s" : ""}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


"use client";

import React, { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Check, Loader2, Mic, Users } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { useAllLearners } from "@/hooks/useAdmin";
import { useAssignPronunciation } from "@/hooks/usePronunciations";
import { toast } from "sonner";

export default function PronunciationAssignmentPage() {
  const params = useParams();
  const router = useRouter();
  const pronunciationId = params.pronunciationId as string;

  const [selectedLearnerIds, setSelectedLearnerIds] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const { data: learnersData, isLoading: learnersLoading } = useAllLearners({ limit: 1000 });
  const learners = learnersData?.learners || [];
  const assignMutation = useAssignPronunciation();

  const filteredLearners = useMemo(
    () =>
      learners.filter((learner: any) => {
        const user = learner.userId || {};
        const name = `${user.firstName || ""} ${user.lastName || ""}`.trim();
        const email = user.email || "";
        const searchLower = searchTerm.toLowerCase();
        return (
          name.toLowerCase().includes(searchLower) ||
          email.toLowerCase().includes(searchLower)
        );
      }),
    [learners, searchTerm]
  );

  const handleToggleLearner = (learnerId: string) => {
    setSelectedLearnerIds((prev) =>
      prev.includes(learnerId)
        ? prev.filter((id) => id !== learnerId)
        : [...prev, learnerId]
    );
  };

  const handleSelectAll = () => {
    if (selectedLearnerIds.length === filteredLearners.length) {
      setSelectedLearnerIds([]);
    } else {
      setSelectedLearnerIds(filteredLearners.map((l: any) => l._id));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedLearnerIds.length === 0) {
      toast.error("Please select at least one learner");
      return;
    }

    assignMutation.mutate(
      {
        pronunciationId,
        data: {
          learnerIds: selectedLearnerIds,
          dueDate: dueDate || undefined,
        },
      },
      {
        onSuccess: () => {
          router.push("/admin/pronunciations");
        },
      }
    );
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-center gap-4">
        <Link href="/admin/pronunciations">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Assign Pronunciation</h1>
          <p className="text-gray-500 text-sm">
            Select learners to assign this pronunciation practice
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left: Pronunciation Info */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Mic className="w-5 h-5" />
            Pronunciation Details
          </h2>
          <p className="text-sm text-gray-500">
            Pronunciation ID: {pronunciationId}
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Select learners from the list on the right to assign this pronunciation practice.
          </p>
        </div>

        {/* Right: Learner Selection */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Users className="w-5 h-5" />
              Select Learners ({selectedLearnerIds.length} selected)
            </h2>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleSelectAll}
            >
              {selectedLearnerIds.length === filteredLearners.length
                ? "Deselect All"
                : "Select All"}
            </Button>
          </div>

          {/* Search */}
          <div className="mb-4">
            <input
              type="text"
              placeholder="Search learners..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#418b43] focus:border-transparent"
            />
          </div>

          {/* Due Date */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Due Date (Optional)
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#418b43] focus:border-transparent"
            />
          </div>

          {/* Learners List */}
          <div className="max-h-96 overflow-y-auto space-y-2 mb-4">
            {learnersLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : filteredLearners.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">
                No learners found
              </p>
            ) : (
              filteredLearners.map((learner: any) => {
                const user = learner.userId || {};
                const name = `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Unknown";
                const email = user.email || "";
                const isSelected = selectedLearnerIds.includes(learner._id);

                return (
                  <label
                    key={learner._id}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-green-50 border-green-200"
                        : "bg-gray-50 border-gray-200 hover:bg-gray-100"
                    }`}
                  >
                    <Checkbox
                      checked={isSelected}
                      onChange={() => handleToggleLearner(learner._id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {name}
                      </p>
                      <p className="text-xs text-gray-500 truncate">{email}</p>
                    </div>
                    {isSelected && (
                      <Check className="w-5 h-5 text-green-600" />
                    )}
                  </label>
                );
              })
            )}
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-4 pt-4 border-t border-gray-200">
            <Link href="/admin/pronunciations">
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </Link>
            <Button
              type="submit"
              disabled={assignMutation.isPending || selectedLearnerIds.length === 0}
            >
              {assignMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Assigning...
                </>
              ) : (
                <>
                  Assign to {selectedLearnerIds.length} Learner
                  {selectedLearnerIds.length !== 1 ? "s" : ""}
                </>
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}


"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  Mail,
  Calendar,
  Pencil,
  X,
  Check,
} from "lucide-react";
import { useLearnerById, useLearnerDrills, useUpdateLearnerName } from "@/hooks/useAdmin";
import { LearnerProfileAnalytics } from "@/components/shared/learner-profile-analytics";
import { toast } from "sonner";
import Link from "next/link";

export default function LearnerProfilePage() {
  const params = useParams();
  const router = useRouter();
  const learnerId = params.id as string;

  const [editingName, setEditingName] = useState(false);
  const [editFirst, setEditFirst] = useState("");
  const [editLast, setEditLast] = useState("");

  const {
    data: learner,
    isLoading: learnerLoading,
    error: learnerError,
  } = useLearnerById(learnerId);

  const updateNameMutation = useUpdateLearnerName(learnerId);

  // kept for any consumers that rely on this hook being called
  useLearnerDrills(learnerId, learner?.email);

  const startEditName = () => {
    if (!learner) return;
    setEditFirst(learner.firstName ?? "");
    setEditLast(learner.lastName ?? "");
    setEditingName(true);
  };

  const cancelEditName = () => {
    setEditingName(false);
    setEditFirst("");
    setEditLast("");
  };

  const saveName = async () => {
    const first = editFirst.trim();
    const last = editLast.trim();
    if (!first || !last) {
      toast.error("First and last name are required");
      return;
    }
    updateNameMutation.mutate(
      { firstName: first, lastName: last },
      { onSuccess: () => setEditingName(false) },
    );
  };

  useEffect(() => {
    if (learnerError) {
      toast.error("Failed to load learner");
      router.push("/admin/Learners");
    }
  }, [learnerError, router]);

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  if (learnerLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!learner) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Learner not found</p>
          <Link href="/admin/Learners" className="text-emerald-600 hover:text-emerald-700">
            Back to Learners
          </Link>
        </div>
      </div>
    );
  }

  const name =
    `${learner.firstName || ""} ${learner.lastName || ""}`.trim() || "Unknown";
  const status = learner.isActive === false ? "Inactive" : "Active";

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin/Learners">
          <button className="p-2 hover:bg-gray-100 rounded-lg transition">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-gray-900">{name}</h1>
          <p className="text-gray-500 text-sm">Learner Profile</p>
        </div>
      </div>

      {/* Profile Info */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-gray-900">Profile Information</h2>
          {!editingName && (
            <button
              type="button"
              onClick={startEditName}
              className="flex items-center gap-1.5 text-sm text-emerald-700 hover:text-emerald-800 font-medium"
            >
              <Pencil className="w-3.5 h-3.5" />
              Edit name
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">
              Name
            </label>
            {editingName ? (
              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={editFirst}
                    onChange={(e) => setEditFirst(e.target.value)}
                    placeholder="First name"
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    disabled={updateNameMutation.isPending}
                    autoComplete="given-name"
                    autoFocus
                  />
                  <input
                    type="text"
                    value={editLast}
                    onChange={(e) => setEditLast(e.target.value)}
                    placeholder="Last name"
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    disabled={updateNameMutation.isPending}
                    autoComplete="family-name"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={saveName}
                    disabled={updateNameMutation.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium disabled:opacity-50"
                  >
                    {updateNameMutation.isPending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={cancelEditName}
                    disabled={updateNameMutation.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-medium disabled:opacity-50"
                  >
                    <X className="w-3.5 h-3.5" />
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-base font-semibold text-gray-900">{name}</p>
            )}
          </div>
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase mb-2 flex items-center gap-2">
              <Mail className="w-3 h-3" /> Email
            </label>
            <p className="text-base text-gray-900">{learner.email}</p>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase mb-2 flex items-center gap-2">
              <Calendar className="w-3 h-3" /> Signup Date
            </label>
            <p className="text-base text-gray-900">{formatDate(learner.createdAt)}</p>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">
              Status
            </label>
            <span
              className={`inline-flex px-3 py-1 rounded-full text-xs font-bold uppercase ${
                status === "Active"
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-gray-100 text-gray-700"
              }`}
            >
              {status}
            </span>
          </div>
        </div>
      </div>

      {/* All analytics sections */}
      <LearnerProfileAnalytics learnerId={learnerId} learnerName={name} />
    </div>
  );
}

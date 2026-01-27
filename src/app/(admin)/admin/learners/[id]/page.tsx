"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  Mail,
  Calendar,
  BookOpen,
  TrendingUp,
  CheckCircle,
  XCircle,
  Mic,
  BarChart3,
  AlertCircle,
} from "lucide-react";
import { useLearnerById, useLearnerDrills } from "@/hooks/useAdmin";
import { useLearnerPronunciationAnalytics } from "@/hooks/usePronunciations";
import { PronunciationAnalyticsComponent } from "@/components/admin/pronunciation-analytics";
import { DrillSubmissionsComponent } from "@/components/admin/drill-submissions";
import { ChallengingWordsComponent } from "@/components/admin/challenging-words";
import { LearnerProgressSummary } from "@/components/admin/learner-progress-summary";
import { toast } from "sonner";
import Link from "next/link";
import { useEffect } from "react";

export default function LearnerProfilePage() {
  const params = useParams();
  const router = useRouter();
  const learnerId = params.id as string;

  // React Query hooks for learner data
  const {
    data: learner,
    isLoading: learnerLoading,
    error: learnerError,
  } = useLearnerById(learnerId);

  // Fetch drills assigned to this learner
  const { data: drills = [], isLoading: drillsLoading } = useLearnerDrills(
    learnerId,
    learner?.email,
  );

  // Get pronunciation analytics
  const { data: pronunciationAnalytics, isLoading: analyticsLoading } =
    useLearnerPronunciationAnalytics(learnerId);

  const loading = learnerLoading;

  // Handle error
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

  if (loading) {
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
          <Link
            href="/admin/Learners"
            className="text-emerald-600 hover:text-emerald-700"
          >
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
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{name}</h1>
          <p className="text-gray-500 text-sm">Learner Profile</p>
        </div>
      </div>

      {/* Profile Info */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-6">
          Profile Information
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">
              Name
            </label>
            <p className="text-base font-semibold text-gray-900">{name}</p>
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
            <p className="text-base text-gray-900">
              {formatDate(learner.createdAt)}
            </p>
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

      {/* Overall Progress Summary */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
          <BarChart3 className="w-5 h-5" /> Overall Progress
        </h2>
        <LearnerProgressSummary learnerId={learnerId} learnerName={name} />
      </div>

      {/* Drill Submissions & Analytics */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
          <BookOpen className="w-5 h-5" /> Assigned Drills & Submissions
        </h2>
        <DrillSubmissionsComponent learnerId={learnerId} learnerName={name} />
      </div>

      {/* Pronunciation Analytics */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
          <Mic className="w-5 h-5" /> Pronunciation Analytics
        </h2>
        <PronunciationAnalyticsComponent
          learnerId={learnerId}
          learnerName={name}
        />
      </div>

      {/* Challenging Words */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-orange-500" /> Words with Challenges
        </h2>
        <ChallengingWordsComponent learnerId={learnerId} learnerName={name} />
      </div>
    </div>
  );
}

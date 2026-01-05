"use client";

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Mail, Calendar, BookOpen, TrendingUp, CheckCircle, XCircle, Mic, BarChart3 } from 'lucide-react';
import { adminService } from '@/services/admin.service';
import { drillAPI } from '@/lib/api';
import { useLearnerPronunciationAnalytics } from '@/hooks/usePronunciations';
import { toast } from 'sonner';
import Link from 'next/link';

export default function LearnerProfilePage() {
  const params = useParams();
  const router = useRouter();
  const learnerId = params.id as string;

  const [learner, setLearner] = useState<any>(null);
  const [learnerProfile, setLearnerProfile] = useState<any>(null);
  const [drills, setDrills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [drillsLoading, setDrillsLoading] = useState(true);

  // Get pronunciation analytics
  const { data: pronunciationAnalytics, isLoading: analyticsLoading } = useLearnerPronunciationAnalytics(learnerId);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const learnerResponse = await adminService.getLearnerById(learnerId);
        setLearner(learnerResponse.user);
        setLearnerProfile(learnerResponse.learner || learnerResponse.user);

        // Fetch drills assigned to this learner
        setDrillsLoading(true);
        try {
          const drillsResponse = await drillAPI.getAll({
            studentEmail: learnerResponse.user.email,
            limit: 100,
          });
          setDrills(drillsResponse.drills || []);
        } catch (error) {
          console.error('Failed to load drills:', error);
        } finally {
          setDrillsLoading(false);
        }
      } catch (error: any) {
        toast.error('Failed to load learner: ' + error.message);
        router.push('/admin/Learners');
      } finally {
        setLoading(false);
      }
    };

    if (learnerId) {
      fetchData();
    }
  }, [learnerId, router]);

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
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
          <Link href="/admin/Learners" className="text-emerald-600 hover:text-emerald-700">
            Back to Learners
          </Link>
        </div>
      </div>
    );
  }

  const name = `${learner.firstName || ""} ${learner.lastName || ""}`.trim() || "Unknown";
  const status = learner.isActive === false ? 'Inactive' : 'Active';

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
        <h2 className="text-lg font-bold text-gray-900 mb-6">Profile Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">Name</label>
            <p className="text-base font-semibold text-gray-900">{name}</p>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase mb-2 block flex items-center gap-2">
              <Mail className="w-3 h-3" /> Email
            </label>
            <p className="text-base text-gray-900">{learner.email}</p>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase mb-2 block flex items-center gap-2">
              <Calendar className="w-3 h-3" /> Signup Date
            </label>
            <p className="text-base text-gray-900">{formatDate(learner.createdAt)}</p>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">Status</label>
            <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold uppercase ${
              status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-700'
            }`}>
              {status}
            </span>
          </div>
        </div>
      </div>

      {/* Drills Section */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <BookOpen className="w-5 h-5" /> Assigned Drills
          </h2>
          <span className="text-sm text-gray-500">{drills.length} total</span>
        </div>

        {drillsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : drills.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No drills assigned yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {drills.map((drill) => (
              <div key={drill._id} className="border border-gray-100 rounded-xl p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-2">{drill.title}</h3>
                    <div className="flex flex-wrap gap-2 text-sm text-gray-500">
                      <span className="capitalize">{drill.type}</span>
                      <span>•</span>
                      <span className="capitalize">{drill.difficulty}</span>
                      {drill.date && (
                        <>
                          <span>•</span>
                          <span>{formatDate(drill.date)}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {drill.is_active ? (
                      <span className="flex items-center gap-1 text-xs text-emerald-600">
                        <CheckCircle className="w-4 h-4" /> Active
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <XCircle className="w-4 h-4" /> Inactive
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pronunciation Analytics */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
          <Mic className="w-5 h-5" /> Pronunciation Analytics
        </h2>

        {analyticsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : !pronunciationAnalytics ? (
          <div className="text-center py-12 text-gray-500">
            <p>No pronunciation data available</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Overall Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-xs text-gray-600 mb-1">Total Assignments</p>
                <p className="text-2xl font-bold text-gray-900">
                  {pronunciationAnalytics.overall?.totalAssignments || 0}
                </p>
              </div>
              <div className="p-4 bg-green-50 rounded-lg">
                <p className="text-xs text-gray-600 mb-1">Completed</p>
                <p className="text-2xl font-bold text-green-600">
                  {pronunciationAnalytics.overall?.completedAssignments || 0}
                </p>
              </div>
              <div className="p-4 bg-yellow-50 rounded-lg">
                <p className="text-xs text-gray-600 mb-1">Average Score</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {pronunciationAnalytics.overall?.averageScore?.toFixed(1) || 0}%
                </p>
              </div>
              <div className="p-4 bg-purple-50 rounded-lg">
                <p className="text-xs text-gray-600 mb-1">Pass Rate</p>
                <p className="text-2xl font-bold text-purple-600">
                  {pronunciationAnalytics.overall?.passRate?.toFixed(1) || 0}%
                </p>
              </div>
            </div>

            {/* Problem Areas */}
            {pronunciationAnalytics.problemAreas && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-bold text-gray-700 mb-3">Top Incorrect Letters</h3>
                  <div className="flex flex-wrap gap-2">
                    {pronunciationAnalytics.problemAreas.topIncorrectLetters?.length > 0 ? (
                      pronunciationAnalytics.problemAreas.topIncorrectLetters.map((item: any, idx: number) => (
                        <span
                          key={idx}
                          className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium"
                        >
                          {item.letter} ({item.count})
                        </span>
                      ))
                    ) : (
                      <p className="text-sm text-gray-500">None identified</p>
                    )}
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-700 mb-3">Top Incorrect Phonemes</h3>
                  <div className="flex flex-wrap gap-2">
                    {pronunciationAnalytics.problemAreas.topIncorrectPhonemes?.length > 0 ? (
                      pronunciationAnalytics.problemAreas.topIncorrectPhonemes.map((item: any, idx: number) => (
                        <span
                          key={idx}
                          className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm font-medium"
                        >
                          {item.phoneme} ({item.count})
                        </span>
                      ))
                    ) : (
                      <p className="text-sm text-gray-500">None identified</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Word Stats */}
            {pronunciationAnalytics.wordStats && pronunciationAnalytics.wordStats.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-gray-700 mb-3">Word-Level Progress</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {pronunciationAnalytics.wordStats.map((word: any, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{word.title}</p>
                        <p className="text-xs text-gray-500">{word.text}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-xs text-gray-500">Attempts</p>
                          <p className="text-sm font-bold text-gray-900">{word.attempts || 0}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-500">Best Score</p>
                          <p
                            className={`text-sm font-bold ${
                              word.bestScore >= 70 ? "text-green-600" : "text-red-600"
                            }`}
                          >
                            {word.bestScore?.toFixed(0) || 0}%
                          </p>
                        </div>
                        <div>
                          {word.status === "completed" ? (
                            <CheckCircle className="w-5 h-5 text-green-600" />
                          ) : (
                            <XCircle className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}



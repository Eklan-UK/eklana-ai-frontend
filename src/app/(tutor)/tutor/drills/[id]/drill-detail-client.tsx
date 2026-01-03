"use client";

import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  ArrowLeft,
  Edit,
  Trash2,
  Users,
  Clock,
  BookOpen,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { drillAPI } from "@/lib/api";
import { toast } from "sonner";

interface DrillDetailClientProps {
  drill: any;
  drillId: string;
}

export function DrillDetailClient({ drill, drillId }: DrillDetailClientProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this drill? This action cannot be undone.")) {
      return;
    }

    setDeleting(true);
    try {
      await drillAPI.delete(drillId);
      toast.success("Drill deleted successfully");
      router.push("/tutor/drills");
    } catch (error: any) {
      toast.error(error.message || "Failed to delete drill");
    } finally {
      setDeleting(false);
    }
  };

  const getTypeIcon = (type: string) => {
    const icons: Record<string, string> = {
      vocabulary: "📚",
      roleplay: "💬",
      grammar: "📝",
      matching: "🔗",
      summary: "📄",
      definition: "📖",
      sentence_writing: "✍️",
    };
    return icons[type] || "📖";
  };

  const getDifficultyColor = (difficulty: string) => {
    const colors: Record<string, string> = {
      beginner: "bg-green-100 text-green-700",
      intermediate: "bg-yellow-100 text-yellow-700",
      advanced: "bg-red-100 text-red-700",
    };
    return colors[difficulty] || "bg-gray-100 text-gray-700";
  };

  const assignedCount = Array.isArray(drill.assigned_to)
    ? drill.assigned_to.length
    : drill.assigned_to
    ? 1
    : 0;

  const startDate = drill.date ? new Date(drill.date) : null;
  const endDate = startDate
    ? new Date(new Date(startDate).setDate(startDate.getDate() + (drill.duration_days || 1) - 1))
    : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="h-6"></div>

      <div className="max-w-4xl mx-auto px-4 py-6 md:px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Link href="/tutor/drills">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <Link href={`/tutor/drills/${drillId}/edit`}>
              <Button variant="outline" size="sm">
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDelete}
              disabled={deleting}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              {deleting ? (
                <>
                  <span className="animate-spin mr-2">⏳</span>
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Drill Info */}
        <Card className="mb-6">
          <div className="flex items-start gap-4 mb-6">
            <span className="text-4xl">{getTypeIcon(drill.type)}</span>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{drill.title}</h1>
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getDifficultyColor(drill.difficulty)}`}>
                  {drill.difficulty}
                </span>
                <span className="text-sm text-gray-500 capitalize">{drill.type}</span>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  drill.is_active
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-700"
                }`}>
                  {drill.is_active ? "Active" : "Inactive"}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6 border-t border-gray-200">
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Assigned To</p>
                <p className="text-lg font-semibold text-gray-900">
                  {assignedCount} student{assignedCount !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
            {startDate && endDate && (
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Duration</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {startDate.toLocaleDateString()} - {endDate.toLocaleDateString()}
                  </p>
                </div>
              </div>
            )}
            <div className="flex items-center gap-3">
              <BookOpen className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Created</p>
                <p className="text-lg font-semibold text-gray-900">
                  {drill.created_date
                    ? new Date(drill.created_date).toLocaleDateString()
                    : "N/A"}
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Drill Content */}
        {drill.context && (
          <Card className="mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Context</h2>
            <p className="text-gray-700 whitespace-pre-wrap">{drill.context}</p>
          </Card>
        )}

        {/* Type-specific content */}
        {drill.type === "vocabulary" && drill.target_sentences && (
          <Card className="mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Target Sentences</h2>
            <ul className="space-y-2">
              {drill.target_sentences.map((sentence: string, idx: number) => (
                <li key={idx} className="text-gray-700">• {sentence}</li>
              ))}
            </ul>
          </Card>
        )}

        {drill.type === "roleplay" && drill.roleplay_scenes && (
          <Card className="mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Roleplay Scenes</h2>
            <div className="space-y-4">
              {drill.roleplay_scenes.map((scene: any, idx: number) => (
                <div key={idx} className="border border-gray-200 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-2">{scene.title || `Scene ${idx + 1}`}</h3>
                  <p className="text-gray-700">{scene.description}</p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Assigned Students */}
        {assignedCount > 0 && (
          <Card>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Assigned Students</h2>
            <div className="space-y-2">
              {Array.isArray(drill.assigned_to) ? (
                drill.assigned_to.map((email: string, idx: number) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-900">{email}</span>
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  </div>
                ))
              ) : (
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-900">{drill.assigned_to}</span>
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
              )}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}


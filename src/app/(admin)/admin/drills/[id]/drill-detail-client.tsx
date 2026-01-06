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
  Link as LinkIcon,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { drillAPI } from "@/lib/api";
import { toast } from "sonner";
import { useDrillAssignments } from "@/hooks/useAdmin";

interface DrillDetailClientProps {
  drill: any;
  drillId: string;
}

export function DrillDetailClient({ drill, drillId }: DrillDetailClientProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const { data: assignmentsData } = useDrillAssignments(drillId);
  const assignments = assignmentsData?.assignments || [];

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this drill? This action cannot be undone.")) {
      return;
    }

    setDeleting(true);
    try {
      await drillAPI.delete(drillId);
      toast.success("Drill deleted successfully");
      router.push("/admin/drill");
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
      grammar: "✏️",
      matching: "🔗",
      summary: "📝",
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

  const completedCount = assignments.filter((a: any) => a.status === 'completed').length;
  const inProgressCount = assignments.filter((a: any) => a.status === 'in-progress').length;
  const pendingCount = assignments.filter((a: any) => a.status === 'pending').length;

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
          <Link href="/admin/drill">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <Link href={`/admin/drills/create?drillId=${drillId}`}>
              <Button variant="outline" size="sm">
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </Button>
            </Link>
            <Link href={`/admin/drills/assignment?drillId=${drillId}`}>
              <Button variant="outline" size="sm">
                <Users className="w-4 h-4 mr-2" />
                Assign
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
              <div className="flex items-center gap-3 flex-wrap">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getDifficultyColor(drill.difficulty)}`}>
                  {drill.difficulty}
                </span>
                <span className="text-sm text-gray-500 capitalize">{drill.type.replace('_', ' ')}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-6 border-t border-gray-200">
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Assigned To</p>
                <p className="text-lg font-semibold text-gray-900">
                  {assignedCount} student{assignedCount !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <div>
                <p className="text-sm text-gray-500">Completed</p>
                <p className="text-lg font-semibold text-gray-900">
                  {completedCount}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-yellow-500" />
              <div>
                <p className="text-sm text-gray-500">In Progress</p>
                <p className="text-lg font-semibold text-gray-900">
                  {inProgressCount}
                </p>
              </div>
            </div>
            {startDate && endDate && (
              <div className="flex items-center gap-3">
                <BookOpen className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Duration</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {startDate.toLocaleDateString()} - {endDate.toLocaleDateString()}
                  </p>
                </div>
              </div>
            )}
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
        {drill.type === "vocabulary" && drill.target_sentences && drill.target_sentences.length > 0 && (
          <Card className="mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Target Sentences ({drill.target_sentences.length})</h2>
            <div className="space-y-3">
              {drill.target_sentences.map((sentence: any, idx: number) => (
                <div key={idx} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  {sentence.word && (
                    <div className="mb-2">
                      <span className="font-semibold text-gray-900">{sentence.word}</span>
                      {sentence.wordTranslation && (
                        <span className="text-gray-500 ml-2">({sentence.wordTranslation})</span>
                      )}
                    </div>
                  )}
                  <p className="text-gray-700">{sentence.text}</p>
                  {sentence.translation && (
                    <p className="text-sm text-gray-500 mt-1 italic">{sentence.translation}</p>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        {drill.type === "roleplay" && drill.roleplay_scenes && drill.roleplay_scenes.length > 0 && (
          <Card className="mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Roleplay Scenes ({drill.roleplay_scenes.length})</h2>
            <div className="space-y-4">
              {drill.roleplay_scenes.map((scene: any, idx: number) => (
                <div key={idx} className="border border-gray-200 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-2">{scene.scene_name || `Scene ${idx + 1}`}</h3>
                  {scene.context && (
                    <p className="text-gray-600 mb-3 text-sm">{scene.context}</p>
                  )}
                  {scene.dialogue && scene.dialogue.length > 0 && (
                    <div className="space-y-2">
                      {scene.dialogue.map((turn: any, turnIdx: number) => (
                        <div key={turnIdx} className={`p-2 rounded ${
                          turn.speaker === 'student' ? 'bg-blue-50' : 'bg-purple-50'
                        }`}>
                          <span className="font-semibold text-xs text-gray-500">
                            {turn.speaker === 'student' ? (drill.student_character_name || 'Student') : 
                             drill.ai_character_names?.[parseInt(turn.speaker.split('_')[1]) || 0] || turn.speaker}:
                          </span>
                          <p className="text-gray-900">{turn.text}</p>
                          {turn.translation && (
                            <p className="text-xs text-gray-500 mt-1 italic">{turn.translation}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        {drill.type === "matching" && drill.matching_pairs && drill.matching_pairs.length > 0 && (
          <Card className="mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Matching Pairs ({drill.matching_pairs.length})</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {drill.matching_pairs.map((pair: any, idx: number) => (
                <div key={idx} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">{pair.left}</p>
                      {pair.leftTranslation && (
                        <p className="text-sm text-gray-500">{pair.leftTranslation}</p>
                      )}
                    </div>
                    <LinkIcon className="w-5 h-5 text-gray-400 mx-2" />
                    <div className="flex-1 text-right">
                      <p className="font-semibold text-gray-900">{pair.right}</p>
                      {pair.rightTranslation && (
                        <p className="text-sm text-gray-500">{pair.rightTranslation}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {drill.type === "definition" && drill.definition_items && drill.definition_items.length > 0 && (
          <Card className="mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Definition Items ({drill.definition_items.length})</h2>
            <div className="space-y-2">
              {drill.definition_items.map((item: any, idx: number) => (
                <div key={idx} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="font-semibold text-gray-900">{item.word}</p>
                  {item.hint && (
                    <p className="text-sm text-gray-500 mt-1">{item.hint}</p>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        {drill.type === "grammar" && drill.grammar_items && drill.grammar_items.length > 0 && (
          <Card className="mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Grammar Patterns ({drill.grammar_items.length})</h2>
            <div className="space-y-3">
              {drill.grammar_items.map((item: any, idx: number) => (
                <div key={idx} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="font-semibold text-gray-900 mb-1">{item.pattern}</p>
                  {item.example && (
                    <p className="text-gray-700 text-sm mb-1">Example: {item.example}</p>
                  )}
                  {item.hint && (
                    <p className="text-xs text-gray-500 italic">{item.hint}</p>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        {drill.type === "sentence_writing" && drill.sentence_writing_items && drill.sentence_writing_items.length > 0 && (
          <Card className="mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Sentence Writing Items ({drill.sentence_writing_items.length})</h2>
            <div className="space-y-2">
              {drill.sentence_writing_items.map((item: any, idx: number) => (
                <div key={idx} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="font-semibold text-gray-900">{item.word}</p>
                  {item.hint && (
                    <p className="text-sm text-gray-500 mt-1">{item.hint}</p>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        {drill.type === "summary" && (
          <Card className="mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Article</h2>
            {drill.article_title && (
              <h3 className="text-lg font-semibold text-gray-900 mb-3">{drill.article_title}</h3>
            )}
            {drill.article_content && (
              <div className="prose max-w-none">
                <p className="text-gray-700 whitespace-pre-wrap">{drill.article_content}</p>
              </div>
            )}
          </Card>
        )}

        {/* Assigned Students List */}
        {assignments.length > 0 && (
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Assigned Students</h2>
              <Link href={`/admin/drills/assignment?drillId=${drillId}`}>
                <Button variant="outline" size="sm">
                  <Users className="w-4 h-4 mr-2" />
                  Manage Assignments
                </Button>
              </Link>
            </div>
            <div className="space-y-2">
              {assignments.map((assignment: any) => {
                const user = assignment.userId || assignment.user;
                const userName = user 
                  ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email
                  : 'Unknown User';
                const userEmail = user?.email || 'N/A';
                
                return (
                  <Link 
                    key={assignment._id} 
                    href={`/admin/learners/${user?._id || assignment.learnerId}/drills`}
                    className="block"
                  >
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{userName}</p>
                        <p className="text-sm text-gray-500">{userEmail}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          assignment.status === 'completed' 
                            ? 'bg-green-100 text-green-700'
                            : assignment.status === 'in-progress'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {assignment.status}
                        </span>
                        {assignment.status === 'completed' && assignment.score !== undefined && (
                          <span className="text-sm font-semibold text-gray-900">
                            {assignment.score}%
                          </span>
                        )}
                        {assignment.completedAt && (
                          <span className="text-xs text-gray-500">
                            {new Date(assignment.completedAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}


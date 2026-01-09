"use client";

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  Loader2, 
  BookOpen, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  TrendingUp,
  MessageSquare,
  FileText,
  PenTool,
  Headphones,
  ScrollText,
  Link2,
} from 'lucide-react';
import { useLearnerById } from '@/hooks/useAdmin';
import { useQuery } from '@tanstack/react-query';
import { drillAPI } from '@/lib/api';
import { toast } from 'sonner';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useEffect } from 'react';

// Hook for student drill assignments
function useStudentDrillAssignments(studentId: string) {
  return useQuery({
    queryKey: ['students', studentId, 'assignments'],
    queryFn: async () => {
      const response = await fetch(`/api/v1/drills/learner/${studentId}/assignments`, {
          credentials: 'include',
        });
        
      if (response.ok) {
        const data = await response.json();
        return data.data?.assignments || data.assignments || [];
      }
      
          // Fallback: fetch from learner drills endpoint
          const drillsResponse = await drillAPI.getLearnerDrills();
          if (drillsResponse.data?.drills) {
        return drillsResponse.data.drills
              .filter((item: any) => {
                const userId = item.drill?.created_by || item.userId;
                return userId === studentId || item.userId?._id === studentId;
              })
              .map((item: any) => ({
                ...item,
                drill: item.drill || item,
                assignmentId: item.assignmentId || item._id,
              }));
      }
      return [];
    },
    enabled: !!studentId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
          }

export default function StudentDrillsPage() {
  const params = useParams();
  const router = useRouter();
  const studentId = params.id as string;

  // Use React Query hooks
  const { data: student, isLoading: studentLoading, error: studentError } = useLearnerById(studentId);
  const { data: assignments = [], isLoading: assignmentsLoading } = useStudentDrillAssignments(studentId);

  const loading = studentLoading || assignmentsLoading;

  // Handle error
  useEffect(() => {
    if (studentError) {
      toast.error('Failed to load student');
    }
  }, [studentError]);

  const formatDate = (dateString: string | Date): string => {
    try {
      const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return typeof dateString === 'string' ? dateString : dateString.toISOString();
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-700';
      case 'in-progress':
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-700';
      case 'pending':
        return 'bg-blue-100 text-blue-700';
      case 'overdue':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getTypeIcon = (type: string) => {
    const icons: Record<string, React.ReactNode> = {
      vocabulary: <BookOpen className="w-5 h-5 text-blue-500" />,
      roleplay: <MessageSquare className="w-5 h-5 text-purple-500" />,
      grammar: <FileText className="w-5 h-5 text-pink-500" />,
      matching: <Link2 className="w-5 h-5 text-green-500" />,
      summary: <ScrollText className="w-5 h-5 text-orange-500" />,
      sentence_writing: <PenTool className="w-5 h-5 text-indigo-500" />,
      listening: <Headphones className="w-5 h-5 text-cyan-500" />,
    };
    return icons[type] || <BookOpen className="w-5 h-5 text-gray-500" />;
  };

  const totalAssigned = assignments.length;
  const completed = assignments.filter((a: any) => 
    a.status === 'completed' || a.assignmentStatus === 'completed'
  ).length;
  const inProgress = assignments.filter((a: any) => 
    a.status === 'in-progress' || a.status === 'in_progress' || a.assignmentStatus === 'in-progress'
  ).length;
  const pending = assignments.filter((a: any) => 
    a.status === 'pending' || a.assignmentStatus === 'pending'
  ).length;
  const overdue = assignments.filter((a: any) => {
    const dueDate = a.dueDate ? new Date(a.dueDate) : null;
    const isOverdue = dueDate && dueDate < new Date() && 
      a.status !== 'completed' && a.assignmentStatus !== 'completed';
    return isOverdue || a.status === 'overdue';
  }).length;

  const averageScore = assignments
    .filter((a: any) => a.score !== undefined && a.score !== null)
    .reduce((acc: number, a: any) => acc + (a.score || 0), 0) / 
    (assignments.filter((a: any) => a.score !== undefined && a.score !== null).length || 1);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const studentName = student 
    ? `${student.firstName || ""} ${student.lastName || ""}`.trim() || student.email || "Unknown"
    : "Unknown";

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <div className="h-6"></div>
      
      <div className="max-w-6xl mx-auto px-4 py-6 md:px-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link href={`/admin/learners/${studentId}`}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Student
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{studentName}'s Drills</h1>
            <p className="text-gray-500 text-sm">View all assigned and completed drills</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">Total Assigned</p>
                <p className="text-2xl font-bold text-gray-900">{totalAssigned}</p>
              </div>
              <BookOpen className="w-8 h-8 text-gray-400" />
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">Completed</p>
                <p className="text-2xl font-bold text-green-600">{completed}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">In Progress</p>
                <p className="text-2xl font-bold text-yellow-600">{inProgress}</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-500" />
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">Average Score</p>
                <p className="text-2xl font-bold text-blue-600">
                  {averageScore > 0 ? `${averageScore.toFixed(1)}%` : 'N/A'}
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-blue-500" />
            </div>
          </Card>
        </div>

        {/* Drills List */}
        <Card>
          <div className="p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">All Drills</h2>
            
            {assignments.length === 0 ? (
              <div className="text-center py-12">
                <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No drills assigned yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {assignments.map((assignment: any) => {
                  const drill = assignment.drill || assignment;
                  const status = assignment.status || assignment.assignmentStatus || 'pending';
                  const dueDate = assignment.dueDate ? new Date(assignment.dueDate) : null;
                  const isOverdue = dueDate && dueDate < new Date() && status !== 'completed';
                  
                  return (
                    <Link
                      key={assignment.assignmentId || assignment._id}
                      href={`/admin/drills/${drill._id}`}
                      className="block"
                    >
                      <div className="border border-gray-200 rounded-xl p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                                {getTypeIcon(drill.type)}
                              </div>
                              <h3 className="font-semibold text-gray-900">{drill.title}</h3>
                            </div>
                            <div className="flex flex-wrap gap-3 text-sm text-gray-500 ml-11">
                              <span className="capitalize">{drill.type?.replace('_', ' ')}</span>
                              <span>•</span>
                              <span className="capitalize">{drill.difficulty}</span>
                              {dueDate && (
                                <>
                                  <span>•</span>
                                  <span>Due: {formatDate(dueDate)}</span>
                                </>
                              )}
                              {assignment.completedAt && (
                                <>
                                  <span>•</span>
                                  <span>Completed: {formatDate(assignment.completedAt)}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {assignment.score !== undefined && assignment.score !== null && (
                              <div className="text-right">
                                <p className="text-xs text-gray-500">Score</p>
                                <p className={`text-lg font-bold ${
                                  assignment.score >= 70 ? 'text-green-600' : 
                                  assignment.score >= 50 ? 'text-yellow-600' : 'text-red-600'
                                }`}>
                                  {assignment.score}%
                                </p>
                              </div>
                            )}
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
                              {isOverdue ? 'Overdue' : status}
                            </span>
                            {status === 'completed' ? (
                              <CheckCircle className="w-5 h-5 text-green-600" />
                            ) : isOverdue ? (
                              <AlertCircle className="w-5 h-5 text-red-600" />
                            ) : (
                              <Clock className="w-5 h-5 text-yellow-600" />
                            )}
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}


"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import VocabularyDrill from "./VocabularyDrill";
import RoleplayDrill from "./RoleplayDrill";
import MatchingDrill from "./MatchingDrill";
import DefinitionDrill from "./DefinitionDrill";
import SummaryDrill from "./SummaryDrill";
import GrammarDrill from "./GrammarDrill";
import SentenceWritingDrill from "./SentenceWritingDrill";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ArrowLeft, Calendar, Target, Clock } from "lucide-react";
import Link from "next/link";
import { drillAPI } from "@/lib/api";
import { formatDate } from "@/utils/drill";

interface DrillPracticeInterfaceProps {
  drill: any;
}

export default function DrillPracticeInterface({ drill }: DrillPracticeInterfaceProps) {
  const router = useRouter();
  const [isStarted, setIsStarted] = useState(false);
  const [assignmentId, setAssignmentId] = useState<string | null>(null);
  const [assignment, setAssignment] = useState<any>(null);

  // Fetch assignment ID and track recent activity
  useEffect(() => {
    const fetchAssignment = async () => {
      try {
        // Get learner drills to find the assignment
        const response = await drillAPI.getLearnerDrills();
        if (response.data?.drills) {
          const foundAssignment = response.data.drills.find(
            (item: any) => item.drill?._id === drill._id
          );
          if (foundAssignment?.assignmentId) {
            setAssignmentId(foundAssignment.assignmentId);
            setAssignment(foundAssignment);
          }
        }

        // Track recent activity (viewed)
        try {
          await fetch('/api/v1/activities/recent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              type: 'drill',
              resourceId: drill._id,
              action: 'viewed',
              metadata: {
                title: drill.title,
                type: drill.type,
                difficulty: drill.difficulty,
              },
            }),
          });
        } catch (error) {
          // Silently fail
          console.error('Failed to track activity:', error);
        }
      } catch (error) {
        console.error('Failed to fetch assignment:', error);
      }
    };

    fetchAssignment();
  }, [drill._id, drill.title, drill.type, drill.difficulty]);

  // Check if drill is active - drills are always available once assigned
  // drill.date is now the completion/due date, not start date
  const now = new Date();
  const completionDate = new Date(drill.date);
  completionDate.setHours(23, 59, 59, 999);
  // Drills are active immediately upon assignment
  const isActive = true; // Always allow access to drills once assigned
  const isCompleted = assignment?.completedAt || assignment?.status === "completed" || assignment?.assignmentStatus === "completed";
  const isOverdue = now > completionDate && !isCompleted;

  if (!isStarted) {
    return (
      <div className="min-h-screen bg-white pb-20 md:pb-0">
        <div className="h-6"></div>
        <Header title={drill.title} />
        
        <div className="max-w-md mx-auto px-4 py-6 md:max-w-4xl md:px-8">
          <Card className="mb-6">
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">
                  {getDrillIcon(drill.type)}
                </span>
                <h2 className="text-xl font-bold text-gray-900">{drill.title}</h2>
              </div>
              
              {drill.context && (
                <p className="text-gray-600 mb-4">{drill.context}</p>
              )}
              
              <div className="flex flex-wrap gap-4 text-sm text-gray-500 mb-4">
                <div className="flex items-center gap-1">
                  <Target className="w-4 h-4" />
                  <span className="capitalize">{drill.difficulty}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  <span>
                    {isOverdue 
                      ? `Overdue - Due ${formatDate(drill.date)}`
                      : `Due ${formatDate(drill.date)}`
                    }
                  </span>
                </div>
                {assignment?.dueDate && (
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    <span>Due {formatDate(assignment.dueDate)}</span>
                  </div>
                )}
              </div>
              
              {/* Show overdue warning if applicable */}
              {isOverdue && !isCompleted && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                  <p className="text-sm text-red-800">
                    This drill is overdue. Please complete it as soon as possible.
                  </p>
                </div>
              )}
            </div>
            
            <div className="flex gap-3">
              <Link href="/account/drills">
                <Button variant="secondary" size="md">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
              </Link>
              <Button 
                variant="primary" 
                size="md" 
                fullWidth
                onClick={() => setIsStarted(true)}
              >
                Start Drill
              </Button>
            </div>
          </Card>
        </div>
        
        <BottomNav />
      </div>
    );
  }

  // Render the appropriate drill interface based on type
  const renderDrill = () => {
    const commonProps = { drill, assignmentId: assignmentId || undefined };
    
    switch (drill.type) {
      case 'vocabulary':
        return <VocabularyDrill {...commonProps} />;
      case 'roleplay':
        return <RoleplayDrill {...commonProps} />;
      case 'matching':
        return <MatchingDrill {...commonProps} />;
      case 'definition':
        return <DefinitionDrill {...commonProps} />;
      case 'summary':
        return <SummaryDrill {...commonProps} />;
      case 'grammar':
        return <GrammarDrill {...commonProps} />;
      case 'sentence_writing':
        return <SentenceWritingDrill {...commonProps} />;
      default:
        return (
          <div className="min-h-screen bg-white pb-20 md:pb-0">
            <div className="h-6"></div>
            <Header title="Unknown Drill Type" />
            <div className="max-w-md mx-auto px-4 py-6">
              <Card>
                <p className="text-gray-600">This drill type is not yet supported.</p>
              </Card>
            </div>
            <BottomNav />
          </div>
        );
    }
  };

  return renderDrill();
}

function getDrillIcon(type: string): string {
  const icons: Record<string, string> = {
    vocabulary: "📚",
    roleplay: "💬",
    matching: "🔗",
    definition: "📖",
    summary: "📝",
    grammar: "✏️",
    sentence_writing: "✍️",
  };
  return icons[type] || "📚";
}


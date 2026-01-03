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

interface DrillPracticeInterfaceProps {
  drill: any;
}

export default function DrillPracticeInterface({ drill }: DrillPracticeInterfaceProps) {
  const router = useRouter();
  const [isStarted, setIsStarted] = useState(false);
  const [assignmentId, setAssignmentId] = useState<string | null>(null);

  // Fetch assignment ID and track recent activity
  useEffect(() => {
    const fetchAssignment = async () => {
      try {
        // Get learner drills to find the assignment
        const response = await drillAPI.getLearnerDrills();
        if (response.data?.drills) {
          const assignment = response.data.drills.find(
            (item: any) => item.drill?._id === drill._id
          );
          if (assignment?.assignmentId) {
            setAssignmentId(assignment.assignmentId);
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

  // Check if drill is active
  const now = new Date();
  const startDate = new Date(drill.date);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + (drill.duration_days || 1) - 1);
  endDate.setHours(23, 59, 59, 999);
  const isActive = now >= startDate && now <= endDate && drill.is_active;
  const isUpcoming = startDate > now;

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
                    {isUpcoming 
                      ? `Starts ${formatDate(drill.date)}`
                      : `Due ${formatDate(endDate.toISOString())}`
                    }
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  <span>{drill.duration_days || 1} day{drill.duration_days !== 1 ? 's' : ''}</span>
                </div>
              </div>
              
              {!isActive && !isUpcoming && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                  <p className="text-sm text-yellow-800">
                    This drill is no longer active.
                  </p>
                </div>
              )}
              
              {isUpcoming && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                  <p className="text-sm text-blue-800">
                    This drill will be available starting {formatDate(drill.date)}.
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
              {isActive && (
                <Button 
                  variant="primary" 
                  size="md" 
                  fullWidth
                  onClick={() => setIsStarted(true)}
                >
                  Start Drill
                </Button>
              )}
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

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", { 
    month: "short", 
    day: "numeric", 
    year: "numeric" 
  });
}


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
import SentenceDrill from "./SentenceDrill";
import ListeningDrill from "./ListeningDrill";
import { Card } from "@/components/ui/Card";
import { drillAPI } from "@/lib/api";
import { trackActivity } from "@/utils/activity-cache";

interface DrillPracticeInterfaceProps {
  drill: any;
  assignmentId?: string;
}

export default function DrillPracticeInterface({
  drill,
  assignmentId: propAssignmentId,
}: DrillPracticeInterfaceProps) {
  const router = useRouter();
  const [assignmentId, setAssignmentId] = useState<string | null>(
    propAssignmentId || null
  );
  const [assignment, setAssignment] = useState<any>(null);

  // Fetch assignment ID and track recent activity
  useEffect(() => {
    const fetchAssignment = async () => {
      try {
        // If assignmentId is provided as prop, use it
        if (propAssignmentId) {
          setAssignmentId(propAssignmentId);
          // Optionally fetch assignment details if needed
          return;
        }

        // Otherwise, get learner drills to find the assignment
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
      } catch (error) {
        console.error("Failed to fetch assignment:", error);
      }
    };

    fetchAssignment();

    // Track activity locally (no API call)
    trackActivity("drill", drill._id, "viewed", {
      title: drill.title,
      type: drill.type,
      difficulty: drill.difficulty,
    });
  }, [drill._id, drill.title, drill.type, drill.difficulty, propAssignmentId]);

  // Render the appropriate drill interface based on type
  const renderDrill = () => {
    const commonProps = { drill, assignmentId: assignmentId || undefined };

    switch (drill.type) {
      case "vocabulary":
        return <VocabularyDrill {...commonProps} />;
      case "roleplay":
        return <RoleplayDrill {...commonProps} />;
      case "matching":
        return <MatchingDrill {...commonProps} />;
      case "definition":
        return <DefinitionDrill {...commonProps} />;
      case "summary":
        return <SummaryDrill {...commonProps} />;
      case "grammar":
        return <GrammarDrill {...commonProps} />;
      case "sentence_writing":
      case "sentence":
        return <SentenceDrill {...commonProps} />;
      case "listening":
        return <ListeningDrill {...commonProps} />;
      default:
        return (
          <div className="min-h-screen bg-white pb-20 md:pb-0">
            <div className="h-6"></div>
            <Header title="Unknown Drill Type" />
            <div className="max-w-md mx-auto px-4 py-6">
              <Card>
                <p className="text-gray-600">
                  This drill type is not yet supported.
                </p>
              </Card>
            </div>
            <BottomNav />
          </div>
        );
    }
  };

  return renderDrill();
}

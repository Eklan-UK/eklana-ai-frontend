"use client";

import { useState, useEffect, useRef } from "react";
import { Header } from "@/components/layout/Header";
import { Loader2 } from "lucide-react";
import VocabularyDrill from "./VocabularyDrill";
import PronunciationDrill from "./PronunciationDrill";
import RoleplayDrill from "./RoleplayDrill";
import MatchingDrill from "./MatchingDrill";
import DefinitionDrill from "./DefinitionDrill";
import SummaryDrill from "./SummaryDrill";
import GrammarDrill from "./GrammarDrill";
import SentenceDrill from "./SentenceDrill";
import ListeningDrill from "./ListeningDrill";
import FillBlankDrill from "./FillBlankDrill";
import KeyPhrasesDrill from "./KeyPhrasesDrill";
import { Card } from "@/components/ui/Card";
import { drillAPI } from "@/lib/api";
import { trackActivity } from "@/utils/activity-cache";
import { resolveDrillPracticeType } from "@/utils/drill";
import type { WeeklyChallengeMeta } from "@/lib/challenges/challengeDrillAdapter";

export type { WeeklyChallengeMeta };

interface DrillPracticeInterfaceProps {
  drill: any;
  assignmentId?: string;
  weeklyChallengeMeta?: WeeklyChallengeMeta;
}

export default function DrillPracticeInterface({
  drill,
  assignmentId: propAssignmentId,
  weeklyChallengeMeta,
}: DrillPracticeInterfaceProps) {
  const [assignmentId, setAssignmentId] = useState<string | null>(
    propAssignmentId || null
  );
  const [assignment, setAssignment] = useState<any>(null);
  const [assignmentFetchDone, setAssignmentFetchDone] = useState(
    Boolean(propAssignmentId || weeklyChallengeMeta)
  );
  const drillSessionKeyRef = useRef(`${drill._id}-session`);

  // Fetch assignment ID and track recent activity
  useEffect(() => {
    const fetchAssignment = async () => {
      try {
        if (weeklyChallengeMeta) {
          return;
        }

        // If assignmentId is provided as prop, use it
        if (propAssignmentId) {
          setAssignmentId(propAssignmentId);
          return;
        }

        // Otherwise, look up this drill's assignment directly (avoids default limit trap)
        const response = await drillAPI.getLearnerDrills({
          drillId: drill._id?.toString?.() ?? String(drill._id),
          limit: 1,
        });
        if (response.data?.drills) {
          const foundAssignment = response.data.drills.find(
            (item: any) => item.drill?._id === drill._id || item.drill?._id?.toString() === drill._id?.toString()
          );
          if (foundAssignment?.assignmentId) {
            // Verify the assignment matches the drill
            if (foundAssignment.drill?._id?.toString() === drill._id?.toString()) {
              setAssignmentId(foundAssignment.assignmentId);
              setAssignment(foundAssignment);
            } else {
              console.warn('Assignment drill ID mismatch', {
                assignmentDrillId: foundAssignment.drill?._id,
                currentDrillId: drill._id,
              });
            }
          }
        }
      } catch (error) {
        console.error("Failed to fetch assignment:", error);
      } finally {
        if (!weeklyChallengeMeta) {
          setAssignmentFetchDone(true);
        }
      }
    };

    if (propAssignmentId || weeklyChallengeMeta) {
      setAssignmentFetchDone(true);
    } else {
      void fetchAssignment();
    }

    // Track activity locally (no API call)
    trackActivity("drill", drill._id, "viewed", {
      title: drill.title,
      type: drill.type,
      difficulty: drill.difficulty,
    });
  }, [drill._id, drill.title, drill.type, drill.difficulty, propAssignmentId, weeklyChallengeMeta]);

  if (!assignmentFetchDone && !weeklyChallengeMeta) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Render the appropriate drill interface based on type
  const renderDrill = () => {
    const drillType = resolveDrillPracticeType(drill);
    const drillForUi =
      drillType && drillType !== drill?.type ? { ...drill, type: drillType } : drill;
    const drillSessionKey = drillSessionKeyRef.current;
    const commonProps = {
      drill: drillForUi,
      assignmentId: assignmentId || undefined,
      weeklyChallengeMeta,
    };

    switch (drillType) {
      case "vocabulary":
        return <VocabularyDrill key={drillSessionKey} {...commonProps} />;
      case "pronunciation":
        return <PronunciationDrill key={drillSessionKey} {...commonProps} />;
      case "roleplay":
        return <RoleplayDrill key={drillSessionKey} {...commonProps} />;
      case "matching":
        return <MatchingDrill key={drillSessionKey} {...commonProps} />;
      case "definition":
        return <DefinitionDrill key={drillSessionKey} {...commonProps} />;
      case "summary":
        return <SummaryDrill key={drillSessionKey} {...commonProps} />;
      case "grammar":
        return <GrammarDrill key={drillSessionKey} {...commonProps} />;
      case "sentence_writing":
      case "sentence":
        return <SentenceDrill key={drillSessionKey} {...commonProps} />;
      case "listening":
        return <ListeningDrill key={drillSessionKey} {...commonProps} />;
      case "fill_blank":
        return <FillBlankDrill key={drillSessionKey} {...commonProps} />;
      case "key_phrases":
        return <KeyPhrasesDrill key={drillSessionKey} {...commonProps} />;
      default:
        return (
          <div className="min-h-screen bg-background pb-6">
            <div className="h-6"></div>
            <Header title="Unknown Drill Type" showBack={true} />
            <div className="max-w-md mx-auto px-4 py-6">
              <Card>
                <p className="text-muted-foreground">
                  This drill type is not yet supported.
                </p>
              </Card>
            </div>
          </div>
        );
    }
  };

  return renderDrill();
}

"use client";

import {
  LEARNING_JOURNEY_PARTS,
  getPartLabel,
  getTopicsForPart,
  type LearningJourneyPartId,
} from "@/domain/learning-journey/learning-journey.catalog";

export interface LearningJourneyPartTopicFieldsProps {
  journeyPart: LearningJourneyPartId | "";
  journeyTopic: string;
  onPartChange: (part: LearningJourneyPartId | "") => void;
  onTopicChange: (topic: string) => void;
  required?: boolean;
  className?: string;
  enrolledParts?: LearningJourneyPartId[];
  onOpenEnrollment?: (studentId?: string) => void;
  selectedStudentIds?: string[];
}

export function LearningJourneyPartTopicFields({
  journeyPart,
  journeyTopic,
  onPartChange,
  onTopicChange,
  required = false,
  className = "",
  enrolledParts,
  onOpenEnrollment,
  selectedStudentIds = [],
}: LearningJourneyPartTopicFieldsProps) {
  const topics = journeyPart ? getTopicsForPart(journeyPart) : [];
  const hasEnrollmentFilter = enrolledParts != null;
  const noSharedEnrollments =
    hasEnrollmentFilter && enrolledParts.length === 0 && selectedStudentIds.length > 0;
  const showEnrollmentGate =
    hasEnrollmentFilter &&
    (noSharedEnrollments ||
      (journeyPart !== "" && !enrolledParts.includes(journeyPart)));

  return (
    <div className={`grid grid-cols-1 gap-4 ${className}`}>
      {noSharedEnrollments && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          No shared enrolled missions — enroll students first.{" "}
          {onOpenEnrollment && (
            <button
              type="button"
              onClick={() => onOpenEnrollment(selectedStudentIds[0])}
              className="font-medium underline hover:no-underline"
            >
              Open enrollment
            </button>
          )}
        </div>
      )}

      <div>
        <label className="block text-xs font-bold text-gray-600 mb-1.5">
          Learning journey mission
          {required ? <span className="text-red-500">*</span> : null}
        </label>
        <div className="relative">
          <select
            value={journeyPart === "" ? "" : String(journeyPart)}
            onChange={(e) => {
              const value = e.target.value;
              onPartChange(
                value === "" ? "" : (parseInt(value, 10) as LearningJourneyPartId),
              );
              onTopicChange("");
            }}
            disabled={noSharedEnrollments}
            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl appearance-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:bg-gray-50 disabled:text-gray-400"
          >
            <option value="">Select mission…</option>
            {LEARNING_JOURNEY_PARTS.map((part) => {
              const isEnrolled =
                !hasEnrollmentFilter || enrolledParts.includes(part.part);
              return (
                <option
                  key={part.part}
                  value={part.part}
                  disabled={hasEnrollmentFilter && !isEnrolled}
                >
                  {getPartLabel(part.part)}
                  {hasEnrollmentFilter && !isEnrolled ? " (not enrolled)" : ""}
                </option>
              );
            })}
          </select>
        </div>
        {hasEnrollmentFilter &&
          enrolledParts.length > 0 &&
          enrolledParts.length < LEARNING_JOURNEY_PARTS.length &&
          onOpenEnrollment && (
            <p className="text-xs text-gray-500 mt-1">
              Only enrolled missions are selectable.{" "}
              <button
                type="button"
                onClick={() => onOpenEnrollment(selectedStudentIds[0])}
                className="text-emerald-700 font-medium hover:underline"
              >
                Enroll this student in a mission first
              </button>
            </p>
          )}
      </div>

      <div>
        <label className="block text-xs font-bold text-gray-600 mb-1.5">
          Learning journey topic
          {required ? <span className="text-red-500">*</span> : null}
        </label>
        <div className="relative">
          <select
            value={journeyTopic}
            onChange={(e) => onTopicChange(e.target.value)}
            disabled={!journeyPart || noSharedEnrollments || showEnrollmentGate}
            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl appearance-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:bg-gray-50 disabled:text-gray-400"
          >
            <option value="">
              {journeyPart ? "Select topic…" : "Select a mission first"}
            </option>
            {topics.map((topic) => (
              <option key={topic.id} value={topic.id}>
                {topic.title}
              </option>
            ))}
          </select>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Topic is separate from the drill title — it groups drills in the learner journey.
        </p>
      </div>
    </div>
  );
}

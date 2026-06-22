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
}

export function LearningJourneyPartTopicFields({
  journeyPart,
  journeyTopic,
  onPartChange,
  onTopicChange,
  required = false,
  className = "",
}: LearningJourneyPartTopicFieldsProps) {
  const topics = journeyPart ? getTopicsForPart(journeyPart) : [];

  return (
    <div className={`grid grid-cols-1 gap-4 ${className}`}>
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
            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl appearance-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          >
            <option value="">Select mission…</option>
            {LEARNING_JOURNEY_PARTS.map((part) => (
              <option key={part.part} value={part.part}>
                {getPartLabel(part.part)}
              </option>
            ))}
          </select>
        </div>
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
            disabled={!journeyPart}
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

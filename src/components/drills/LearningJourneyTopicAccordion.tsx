"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import {
  formatTopicProgressLabel,
  topicIconSrc,
  type LearningJourneyTopic,
} from "@/domain/learning-journey/learning-journey.catalog";

export type LearningJourneyTopicAccordionProps = {
  topic: LearningJourneyTopic;
  completed: number;
  total: number;
  children: ReactNode;
};

export function LearningJourneyTopicAccordion({
  topic,
  completed,
  total,
  children,
}: LearningJourneyTopicAccordionProps) {
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();
  const progressLabel = formatTopicProgressLabel(completed, total);

  return (
    <section className="w-full">
      <div className="flex items-start">
        <div className="flex w-[60px] shrink-0 flex-col items-center pr-3">
          <button
            type="button"
            className="flex size-12 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: topic.iconBg }}
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-controls={panelId}
            aria-label={`${expanded ? "Collapse" : "Expand"} ${topic.title}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={topicIconSrc(topic.iconKey)}
              alt=""
              width={24}
              height={24}
              className="size-6"
            />
          </button>
          {expanded ? (
            <div className="mt-1.5 min-h-5 w-px flex-1 bg-gradient-to-b from-gray-200 to-gray-100" />
          ) : null}
        </div>

        <div className="min-w-0 flex-1">
          <button
            type="button"
            className="flex w-full items-center gap-2 pb-3 pt-2 text-left"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-controls={panelId}
          >
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-extrabold leading-[19px] text-[#111827]">
                {topic.title}
              </span>
              <span className="mt-0.5 block text-[11px] font-semibold leading-[16.5px] text-[#99a1af]">
                {progressLabel}
              </span>
            </span>
            {expanded ? (
              <ChevronDown
                className="size-[15px] shrink-0 text-[#99a1af]"
                aria-hidden
              />
            ) : (
              <ChevronRight
                className="size-[15px] shrink-0 text-[#99a1af]"
                aria-hidden
              />
            )}
          </button>

          {expanded ? (
            <div id={panelId} className="flex flex-col gap-2.5 pb-4">
              {total === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No drills assigned for this topic yet.
                </p>
              ) : (
                children
              )}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

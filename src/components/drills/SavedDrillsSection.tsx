"use client";

import { useEffect, useState } from "react";
import { Bookmark, ChevronDown, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSavedDrills } from "@/hooks/useDrills";
import { useBookmarks } from "@/hooks/useBookmarks";
import { BookmarksTabPanel } from "@/components/bookmarks/BookmarksTabPanel";

export interface SavedDrillsSectionProps {
  /** Keep `saved-drills` for deep-link back-compat; `#bookmarks` also expands. */
  id?: string;
  title?: string;
  /** Expand on mount (e.g. My Plan with #saved-drills) */
  defaultExpanded?: boolean;
  showTopicLabel?: boolean;
  /** Optional section heading above the Bookmarks card (Figma: "Your Progress") */
  sectionHeading?: string;
}

export function SavedDrillsSection({
  id = "saved-drills",
  title,
  defaultExpanded = false,
  showTopicLabel = false,
  sectionHeading,
}: SavedDrillsSectionProps) {
  const t = useTranslations("account");
  const [expanded, setExpanded] = useState(defaultExpanded);
  const { data: bookmarkedDrills = [], isLoading: drillsLoading } =
    useSavedDrills();
  const { data: savedWords = [], isLoading: wordsLoading } =
    useBookmarks("word");
  const { data: savedExpressions = [], isLoading: expressionsLoading } =
    useBookmarks("sentence");

  const resolvedTitle = title ?? t("bookmarks");
  const isLoading = drillsLoading || wordsLoading || expressionsLoading;
  const totalCount =
    bookmarkedDrills.length + savedWords.length + savedExpressions.length;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    if (hash === `#${id}` || hash === "#bookmarks") {
      setExpanded(true);
    }
  }, [id]);

  const toggle = () => setExpanded((open) => !open);

  const savedCountLabel =
    totalCount === 1 ? "1 saved" : `${totalCount} saved`;

  return (
    <section
      id={id}
      aria-labelledby={sectionHeading ? `${id}-heading` : undefined}
    >
      {sectionHeading ? (
        <h2
          id={`${id}-heading`}
          className="text-lg font-bold font-nunito text-foreground mb-3"
        >
          {sectionHeading}
        </h2>
      ) : null}

      <button
        type="button"
        onClick={toggle}
        aria-expanded={expanded}
        aria-controls={`${id}-panel`}
        className="w-full flex items-start gap-3 rounded-2xl bg-card border border-[rgba(224,224,224,0.5)] dark:border-border p-[17px] shadow-[0px_4px_10px_rgba(0,0,0,0.05)] hover:shadow-md transition-shadow text-left"
      >
        <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0 mt-0.5">
          <Bookmark className="w-5 h-5 text-foreground" aria-hidden />
        </div>
        <div className="flex-1 min-w-0 space-y-1.5">
          <h3 className="text-base font-bold font-nunito text-foreground">
            {resolvedTitle}
          </h3>
          <p className="text-xs font-satoshi text-muted-foreground">
            {t("bookmarksSubtitle")}
          </p>
          {!isLoading && totalCount > 0 ? (
            <span className="inline-flex shrink-0 px-2 py-0.5 rounded-lg bg-[#f3f4f6] dark:bg-muted text-[11px] font-medium text-muted-foreground">
              {savedCountLabel}
            </span>
          ) : null}
        </div>
        {expanded ? (
          <ChevronDown
            className="w-5 h-5 text-muted-foreground shrink-0 mt-1"
            aria-hidden
          />
        ) : (
          <ChevronRight
            className="w-5 h-5 text-muted-foreground shrink-0 mt-1"
            aria-hidden
          />
        )}
      </button>

      {expanded ? (
        <div id={`${id}-panel`} className="mt-3">
          <BookmarksTabPanel showTopicLabel={showTopicLabel} />
        </div>
      ) : null}
    </section>
  );
}

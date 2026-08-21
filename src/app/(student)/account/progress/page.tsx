"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { SkillLevelRow } from "@/components/account/SkillLevelRow";
import { useLearnerTimeStudied } from "@/hooks/useLearnerTimeStudied";
import { useUserStreak } from "@/hooks/useUserStreak";
import { useBookmarks } from "@/hooks/useBookmarks";
import { useProgressScorecard } from "@/hooks/useProgressScorecard";
import { useBadges } from "@/hooks/useBadges";
import {
  averageSkillScore,
  formatTimePracticed,
  getOverallSkillBadge,
  overallSkillBadgeLabel,
  type OverallSkillBadge,
} from "@/domain/progress/skill-bands";

function weekdayLetter(isoDate: string) {
  const d = new Date(isoDate + "T00:00:00.000Z");
  if (Number.isNaN(d.getTime())) return "";
  return ["S", "M", "T", "W", "T", "F", "S"][d.getUTCDay()] ?? "";
}

const OVERALL_BADGE_STYLE: Record<
  OverallSkillBadge,
  { wrap: string; emoji: string }
> = {
  learner: { wrap: "bg-[#fff7ed] text-[#f97316]", emoji: "🌱" },
  skilled: { wrap: "bg-[#eff6ff] text-[#3b82f6]", emoji: "⚔️" },
  advanced: { wrap: "bg-[#ecffed] text-[#3b883e]", emoji: "🏆" },
  mastery: { wrap: "bg-[#ecfdf5] text-[#059669]", emoji: "👑" },
};

export default function MyProgressPage() {
  const t = useTranslations("profile");
  const router = useRouter();
  const { data: timeSeconds, isLoading: timeLoading } = useLearnerTimeStudied();
  const { data: streak, isLoading: streakLoading } = useUserStreak();
  const { data: bookmarks, isLoading: bookmarksLoading } = useBookmarks();
  const { data: scorecard, isLoading: scoreLoading } = useProgressScorecard();
  const { data: badgesData, isLoading: badgesLoading } = useBadges();

  const savedCount = bookmarksLoading ? "…" : String(bookmarks?.length ?? 0);
  const streakValue = streakLoading ? "…" : String(streak?.currentStreak ?? 0);
  const timeValue = timeLoading
    ? "…"
    : formatTimePracticed(timeSeconds ?? 0);

  const pronunciation = scorecard?.pronunciation ?? 0;
  const accuracy = scorecard?.accuracy ?? 0;
  const fluency = scorecard?.fluency ?? 0;
  const confidence = scorecard?.confidence ?? 0;

  const overallAvg = averageSkillScore({
    pronunciation,
    accuracy,
    fluency,
    confidence,
  });
  const overallBadgeId = getOverallSkillBadge(overallAvg);
  const overallBadge = overallSkillBadgeLabel(overallBadgeId);
  const overallStyle = OVERALL_BADGE_STYLE[overallBadgeId];

  const recentBadges = (badgesData?.badges ?? [])
    .filter((b) => b.unlocked && b.unlockedAt)
    .sort(
      (a, b) =>
        new Date(b.unlockedAt!).getTime() - new Date(a.unlockedAt!).getTime(),
    )
    .slice(0, 3);

  const hasStreak = Boolean(streak && !streakLoading && streak.currentStreak > 0);

  return (
    <div className="min-h-screen bg-background pb-10">
      <div className="h-6" />

      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-md items-center gap-3 px-4 py-3 md:max-w-2xl md:px-8">
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Go back"
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-card shadow-[0px_1px_2px_rgba(0,0,0,0.09)] dark:border dark:border-border"
          >
            <span className="relative block size-[18px] overflow-hidden">
              <Image
                src="/icons/profile/back.svg"
                alt=""
                width={18}
                height={18}
                className="size-full"
                unoptimized
              />
            </span>
          </button>
          <h1 className="font-nunito text-xl font-extrabold leading-[30px] tracking-[-0.3px] text-[#101828] dark:text-foreground">
            {t("progressTitle")}
          </h1>
        </div>
      </div>

      <div className="mx-auto max-w-md space-y-4 px-4 py-2 md:max-w-2xl md:px-8">
        <div className="grid grid-cols-3 gap-3">
          {[
            {
              href: "/account/bookmarks",
              iconSrc: "/icons/profile/progress-bookmark.svg",
              value: savedCount,
              label: t("saved"),
            },
            {
              href: "/account/streak",
              iconSrc: "/icons/profile/progress-fire.svg",
              value: streakValue,
              label: t("dayStreak"),
            },
            {
              href: undefined as string | undefined,
              iconSrc: "/icons/profile/progress-clock.svg",
              value: timeValue,
              label: t("timePracticed"),
            },
          ].map((stat) => {
            const inner = (
              <div className="flex h-[101px] flex-col items-center justify-center rounded-2xl bg-card px-2 py-4 shadow-[0px_1px_3px_rgba(0,0,0,0.06)] dark:border dark:border-border">
                <span className="relative block size-6 overflow-hidden">
                  <Image
                    src={stat.iconSrc}
                    alt=""
                    width={24}
                    height={24}
                    className="size-full"
                    unoptimized
                  />
                </span>
                <p className="mt-1 font-nunito text-lg font-extrabold leading-[18px] text-[#101828] dark:text-foreground">
                  {stat.value}
                </p>
                <p className="mt-0.5 text-center font-nunito text-[10px] font-semibold leading-[15px] text-[#99a1af]">
                  {stat.label}
                </p>
              </div>
            );
            return stat.href ? (
              <Link
                key={stat.label}
                href={stat.href}
                className="no-underline hover:no-underline"
              >
                {inner}
              </Link>
            ) : (
              <div key={stat.label}>{inner}</div>
            );
          })}
        </div>

        <section className="rounded-[18px] bg-card p-4 shadow-[0px_1px_3px_rgba(0,0,0,0.06)] dark:border dark:border-border">
          <div className="flex items-center justify-between">
            <h2 className="font-nunito text-sm font-extrabold leading-[21px] text-[#101828] dark:text-foreground">
              {t("streakCardTitle")}
            </h2>
            <Link
              href="/account/streak"
              className="inline-flex items-center gap-1 no-underline hover:no-underline"
            >
              <span className="relative block size-[13px] overflow-hidden">
                <Image
                  src="/icons/profile/view-streak.svg"
                  alt=""
                  width={13}
                  height={13}
                  className="size-full"
                  unoptimized
                />
              </span>
              <span className="font-nunito text-xs font-bold leading-[18px] text-[#3b883e]">
                {t("viewStreak")}
              </span>
              <span className="relative block size-3 overflow-hidden">
                <Image
                  src="/icons/profile/chevron.svg"
                  alt=""
                  width={12}
                  height={12}
                  className="size-full"
                  unoptimized
                />
              </span>
            </Link>
          </div>

          <div className="mt-1 flex items-center justify-between">
            <p className="font-nunito text-[13px] font-bold leading-[19.5px] text-[#4a5565] dark:text-muted-foreground">
              {streakLoading
                ? "…"
                : hasStreak
                  ? t("dayStreakCount", { count: streak!.currentStreak })
                  : t("buildStreak")}
            </p>
            {hasStreak ? (
              <p className="font-nunito text-xs font-bold leading-[18px] text-[#99a1af]">
                {t("bestStreak", { count: streak!.longestStreak })}
              </p>
            ) : null}
          </div>

          {streak && streak.weeklyActivity.length > 0 ? (
            <div className="mt-3 flex items-center justify-center gap-2">
              {streak.weeklyActivity.map((day) => (
                <div
                  key={day.date}
                  title={day.date}
                  className={`flex size-10 shrink-0 items-center justify-center rounded-full font-nunito text-[13px] font-extrabold leading-[19.5px] ${
                    day.completed
                      ? "bg-[#3b883e] text-white"
                      : "bg-[#f3f4f6] text-[#99a1af] dark:bg-muted dark:text-muted-foreground"
                  }`}
                >
                  {weekdayLetter(day.date)}
                </div>
              ))}
            </div>
          ) : null}

          <div className="mt-4 rounded-xl bg-[#fffbeb] px-4 py-3 dark:bg-amber-500/10">
            <div className="flex items-center gap-1.5">
              <span aria-hidden className="text-[15px] leading-[22.5px]">
                🔥
              </span>
              <p className="font-nunito text-[12.5px] font-extrabold leading-[18.75px] text-[#973c00] dark:text-amber-200">
                {hasStreak ? t("keepGoing") : t("startStreak")}
              </p>
            </div>
            <p className="mt-1 font-nunito text-xs font-semibold leading-[19.5px] text-[#bb4d00] dark:text-amber-100/90">
              {t("streakHint")}
            </p>
          </div>

          <Link
            href="/account/practice"
            className="mt-3 flex h-11 w-full items-center justify-center rounded-xl bg-[#3b883e] font-nunito text-[13.5px] font-extrabold leading-[20.25px] text-white no-underline hover:opacity-90 hover:no-underline active:scale-[0.99]"
          >
            {t("continuePractice")}
          </Link>
        </section>

        <section className="rounded-[18px] bg-card p-4 shadow-[0px_1px_3px_rgba(0,0,0,0.06)] dark:border dark:border-border">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-nunito text-[13.5px] font-extrabold leading-[20.25px] text-[#101828] dark:text-foreground">
                {t("skillLevels")}
              </h2>
              {!scoreLoading ? (
                <p className="font-nunito text-[11px] font-bold leading-[16.5px] text-[#99a1af]">
                  {t("skillAvgSubtitle", { avg: Math.round(overallAvg) })}
                </p>
              ) : null}
            </div>
            {!scoreLoading ? (
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 ${overallStyle.wrap}`}
              >
                <span className="text-[13px] leading-[19.5px]" aria-hidden>
                  {overallStyle.emoji}
                </span>
                <span className="font-nunito text-[11px] font-extrabold leading-[16.5px]">
                  {overallBadge}
                </span>
              </span>
            ) : null}
          </div>

          {scoreLoading ? (
            <p className="py-4 text-sm text-muted-foreground">…</p>
          ) : (
            <div className="mt-4 space-y-3">
              <SkillLevelRow
                emoji="💪"
                title={t("confidence")}
                score={confidence}
              />
              <SkillLevelRow
                emoji="🔍"
                title={t("clarity")}
                score={pronunciation}
              />
              <SkillLevelRow
                emoji="🎯"
                title={t("accuracy")}
                score={accuracy}
              />
              <SkillLevelRow emoji="💬" title={t("fluency")} score={fluency} />
            </div>
          )}
        </section>

        <section className="rounded-[18px] bg-card p-4 shadow-[0px_1px_3px_rgba(0,0,0,0.06)] dark:border dark:border-border">
          <h2 className="font-nunito text-[13.5px] font-extrabold leading-[20.25px] text-[#101828] dark:text-foreground">
            {t("recentAchievements")}
          </h2>

          {badgesLoading ? (
            <p className="py-2 text-sm text-muted-foreground">…</p>
          ) : recentBadges.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">
              {t("noBadgesYet")}
            </p>
          ) : (
            <ul className="mt-3">
              {recentBadges.map((badge, i) => (
                <li
                  key={badge.badgeId}
                  className={`flex items-center gap-3 py-2.5 ${
                    i < recentBadges.length - 1
                      ? "border-b border-[#f9fafb] dark:border-border"
                      : ""
                  }`}
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#fffbeb] text-xl dark:bg-amber-500/15">
                    {badge.icon || "🏅"}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-nunito text-[13px] font-extrabold leading-[19.5px] text-[#101828] dark:text-foreground">
                      {badge.badgeName}
                    </p>
                    <p className="truncate font-nunito text-[11px] font-semibold leading-[16.5px] text-[#99a1af]">
                      {badge.afterOutcome}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

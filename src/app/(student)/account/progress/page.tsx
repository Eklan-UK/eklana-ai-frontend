"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  Bookmark,
  Flame,
  Clock,
  Calendar,
  ChevronRight,
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { ProfileStatTriple } from "@/components/account/ProfileStatTriple";
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
  getSkillBand,
  overallSkillBadgeLabel,
} from "@/domain/progress/skill-bands";

function weekdayLetter(isoDate: string) {
  const d = new Date(isoDate + "T00:00:00.000Z");
  if (Number.isNaN(d.getTime())) return "";
  return ["S", "M", "T", "W", "T", "F", "S"][d.getUTCDay()] ?? "";
}

function nextHint(
  score: number,
  ptsToNext: (points: number, next: string) => string,
  masteryReached: string
): string {
  const band = getSkillBand(score);
  if (!band.nextLabel || band.pointsToNext <= 0) return masteryReached;
  return ptsToNext(band.pointsToNext, band.nextLabel);
}

export default function MyProgressPage() {
  const t = useTranslations("profile");
  const { data: timeSeconds, isLoading: timeLoading } = useLearnerTimeStudied();
  const { data: streak, isLoading: streakLoading } = useUserStreak();
  const { data: bookmarks, isLoading: bookmarksLoading } = useBookmarks();
  const { data: scorecard, isLoading: scoreLoading } = useProgressScorecard();
  const { data: badgesData, isLoading: badgesLoading } = useBadges();

  const savedCount = bookmarksLoading
    ? "…"
    : String(bookmarks?.length ?? 0);
  const streakValue = streakLoading
    ? "…"
    : String(streak?.currentStreak ?? 0);
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
  const overallBadge = overallSkillBadgeLabel(getOverallSkillBadge(overallAvg));

  const recentBadges = (badgesData?.badges ?? [])
    .filter((b) => b.unlocked && b.unlockedAt)
    .sort(
      (a, b) =>
        new Date(b.unlockedAt!).getTime() - new Date(a.unlockedAt!).getTime()
    )
    .slice(0, 3);

  return (
    <div className="min-h-screen bg-background pb-10">
      <div className="h-6" />
      <Header showBack title={t("progressTitle")} />

      <div className="max-w-md mx-auto px-4 py-6 md:max-w-2xl md:px-8 space-y-4">
        <Card className="py-3">
          <ProfileStatTriple
            items={[
              {
                icon: Bookmark,
                value: savedCount,
                label: t("saved"),
                href: "/account/bookmarks",
              },
              {
                icon: Flame,
                value: streakValue,
                label: t("dayStreak"),
                href: "/account/streak",
              },
              {
                icon: Clock,
                value: timeValue,
                label: t("timePracticed"),
              },
            ]}
          />
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-foreground">
              {t("streakCardTitle")}
            </h3>
            <Link
              href="/account/streak"
              className="text-primary flex items-center gap-1 text-sm"
            >
              <Calendar className="w-4 h-4" />
              <span>{t("viewStreak")}</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="flex items-center justify-between mb-3">
            <h4 className="text-base font-semibold text-foreground">
              {streakLoading
                ? "…"
                : streak && streak.currentStreak > 0
                  ? t("dayStreakCount", { count: streak.currentStreak })
                  : t("buildStreak")}
            </h4>
            {streak && !streakLoading && streak.currentStreak > 0 ? (
              <span className="text-sm text-muted-foreground">
                {t("bestStreak", { count: streak.longestStreak })}
              </span>
            ) : null}
          </div>

          {streak && streak.weeklyActivity.length > 0 ? (
            <div className="flex items-center justify-center gap-1 sm:gap-2 mb-4">
              {streak.weeklyActivity.map((day) => (
                <div
                  key={day.date}
                  className={`flex h-8 w-8 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-full font-black text-[10px] sm:text-xs ${
                    day.completed
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                  title={day.date}
                >
                  {weekdayLetter(day.date)}
                </div>
              ))}
            </div>
          ) : null}

          <div className="bg-yellow-500/10 border border-border rounded-lg p-4">
            <p className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
              <Flame className="w-4 h-4 text-yellow-600" />
              {streak && streak.currentStreak > 0
                ? t("keepGoing")
                : t("startStreak")}
            </p>
            <p className="text-xs md:text-sm text-muted-foreground">
              {t("streakHint")}
            </p>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-bold text-foreground">
              {t("skillLevels")}
            </h3>
            {!scoreLoading ? (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary">
                {t("overallBadge", { badge: overallBadge })}
              </span>
            ) : null}
          </div>

          {scoreLoading ? (
            <p className="text-sm text-muted-foreground py-4">…</p>
          ) : (
            <div className="divide-y divide-border">
              <SkillLevelRow
                emoji="🗣️"
                title={t("clarity")}
                score={pronunciation}
                nextHint={nextHint(
                  pronunciation,
                  (points, next) => t("ptsToNext", { points, next }),
                  t("masteryReached")
                )}
              />
              <SkillLevelRow
                emoji="🎯"
                title={t("accuracy")}
                score={accuracy}
                nextHint={nextHint(
                  accuracy,
                  (points, next) => t("ptsToNext", { points, next }),
                  t("masteryReached")
                )}
              />
              <SkillLevelRow
                emoji="💨"
                title={t("fluency")}
                score={fluency}
                nextHint={nextHint(
                  fluency,
                  (points, next) => t("ptsToNext", { points, next }),
                  t("masteryReached")
                )}
              />
              <SkillLevelRow
                emoji="💪"
                title={t("confidence")}
                score={confidence}
                nextHint={nextHint(
                  confidence,
                  (points, next) => t("ptsToNext", { points, next }),
                  t("masteryReached")
                )}
              />
            </div>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold text-foreground">
              {t("recentAchievements")}
            </h3>
            <Link
              href="/account/badges"
              className="text-sm text-primary font-medium"
            >
              {t("seeAllBadges")}
            </Link>
          </div>

          {badgesLoading ? (
            <p className="text-sm text-muted-foreground py-2">…</p>
          ) : recentBadges.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">
              {t("noBadgesYet")}
            </p>
          ) : (
            <ul className="space-y-3">
              {recentBadges.map((badge) => (
                <li key={badge.badgeId} className="flex items-center gap-3">
                  <span className="flex size-11 items-center justify-center rounded-full bg-gradient-to-br from-yellow-400 to-orange-400 text-xl shrink-0">
                    {badge.icon}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {badge.badgeName}
                    </p>
                    {badge.unlockedAt ? (
                      <p className="text-xs text-muted-foreground">
                        {new Date(badge.unlockedAt).toLocaleDateString()}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Link
          href="/account/practice"
          className="inline-flex w-full items-center justify-center rounded-xl font-semibold transition-all duration-200 active:scale-95 bg-primary text-primary-foreground hover:opacity-90 px-8 py-4 text-lg"
        >
          {t("continuePractice")}
        </Link>
      </div>
    </div>
  );
}

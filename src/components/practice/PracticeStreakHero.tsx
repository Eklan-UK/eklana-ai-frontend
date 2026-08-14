"use client";

import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";

const WEEKDAY_KEYS = [
  "weekdayMon",
  "weekdayTue",
  "weekdayWed",
  "weekdayThu",
  "weekdayFri",
  "weekdaySat",
  "weekdaySun",
] as const;

function utcDateString(d: Date): string {
  return d.toISOString().split("T")[0]!;
}

/** Mon–Sun calendar week in UTC (matching streak service). */
function getUtcCalendarWeek(): Array<{ date: string; weekdayKey: (typeof WEEKDAY_KEYS)[number] }> {
  const now = new Date();
  const todayUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  // JS: Sun=0 … Sat=6 → Mon=0 … Sun=6
  const day = todayUtc.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(todayUtc);
  monday.setUTCDate(todayUtc.getUTCDate() + mondayOffset);

  return WEEKDAY_KEYS.map((weekdayKey, i) => {
    const d = new Date(monday);
    d.setUTCDate(monday.getUTCDate() + i);
    return { date: utcDateString(d), weekdayKey };
  });
}

export interface PracticeStreakHeroProps {
  firstName?: string | null;
  currentStreak?: number;
  todayCompleted?: boolean;
  weeklyActivity?: Array<{ date: string; completed: boolean }>;
  isLoading?: boolean;
}

export function PracticeStreakHero({
  firstName,
  currentStreak = 0,
  todayCompleted = false,
  weeklyActivity = [],
  isLoading = false,
}: PracticeStreakHeroProps) {
  const t = useTranslations("account.practiceHub");
  const displayName = firstName?.trim() || t("guestName");
  const week = getUtcCalendarWeek();
  const todayStr = utcDateString(new Date());
  const completedByDate = new Map(
    weeklyActivity.map((d) => [d.date, d.completed]),
  );

  const goalInner = (
    <>
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-black/8">
        <span className="relative block size-4 overflow-hidden">
          <Image
            src="/icons/practice-hub/goal.svg"
            alt=""
            width={16}
            height={16}
            className="size-full"
            unoptimized
          />
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-[0.25px] text-[#2a602c] font-nunito leading-[15px]">
          {t("todayGoal")}
        </p>
        <p className="text-[13px] font-extrabold text-[#171717] font-nunito leading-[16.25px]">
          {todayCompleted ? t("todayGoalCompleted") : t("todayGoalAction")}
        </p>
      </div>
      <span className="relative block size-4 shrink-0 overflow-hidden">
        <Image
          src="/icons/practice-hub/chevron-right-dark.svg"
          alt=""
          width={16}
          height={16}
          className="size-full"
          unoptimized
        />
      </span>
    </>
  );

  return (
    <section className="w-full rounded-[32px] bg-[#2a602c] p-6 shadow-[0px_20px_25px_-5px_rgba(0,0,0,0.1),0px_8px_10px_-6px_rgba(0,0,0,0.1)] flex flex-col items-center gap-1">
      <div className="flex w-full items-center justify-center gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-[22px] font-extrabold text-white font-nunito leading-[27.5px]">
            {t("greeting", { name: displayName })}{" "}
            <span className="text-[20px] leading-[25px]" aria-hidden>
              👋
            </span>
          </h2>
          <p className="mt-1.5 text-[12.5px] font-normal text-white font-nunito leading-[20px]">
            {t("heroBlurb")}
          </p>
        </div>
        <div className="flex w-[82px] shrink-0 flex-col items-center rounded-[14px] bg-white/8 px-3 py-2.5">
          <span className="relative flex size-[14px] shrink-0 items-center justify-center">
            <Image
              src="/icons/practice-hub/flame.svg"
              alt=""
              width={11}
              height={13}
              className="h-[12.5px] w-[10.8px]"
              unoptimized
            />
          </span>
          <div className="flex h-6 shrink-0 flex-col items-center pt-0.5">
            <p className="text-[22px] font-extrabold leading-[22px] text-white font-nunito tabular-nums">
              {isLoading ? "—" : currentStreak}
            </p>
          </div>
          <p className="text-[9px] font-bold tracking-[0.225px] text-[#ffdc2f] font-nunito leading-[13.5px] uppercase">
            {t("dayStreak")}
          </p>
        </div>
      </div>

      <div className="flex h-[67px] w-full max-w-[321px] items-center justify-center gap-0 pt-4 px-1">
        {week.map(({ date, weekdayKey }) => {
          const completed = completedByDate.get(date) === true;
          const isToday = date === todayStr;
          const isFuture = date > todayStr;

          return (
            <div
              key={date}
              className="flex w-8 flex-col items-center gap-1.5"
              title={date}
            >
              <div
                className={`flex size-8 items-center justify-center rounded-full ${
                  completed && isToday
                    ? "bg-[#78c47b] shadow-[0px_0px_5px_rgba(120,196,123,0.55)]"
                    : completed
                      ? "bg-[rgba(52,211,153,0.28)]"
                      : "bg-white/[0.07]"
                }`}
              >
                {completed ? (
                  <span className="relative block h-[9px] w-[11px] overflow-hidden">
                    <Image
                      src="/icons/practice-hub/check.svg"
                      alt=""
                      width={11}
                      height={9}
                      className="size-full"
                      unoptimized
                    />
                  </span>
                ) : (
                  <span className="size-1.5 rounded-full bg-white/20" />
                )}
              </div>
              <span
                className={`text-[8.5px] font-bold font-nunito leading-[12.75px] ${
                  completed || isToday
                    ? "text-white/65"
                    : isFuture
                      ? "text-white/20"
                      : "text-white/20"
                }`}
              >
                {t(weekdayKey)}
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex w-full flex-col items-center pb-3 pt-4">
        {todayCompleted ? (
          <Link
            href="/account/streak"
            className="flex h-[60px] w-full max-w-[321px] items-center gap-3 rounded-[14px] bg-[#fbd100] px-4 py-3.5 transition-opacity hover:opacity-95 active:scale-[0.99]"
          >
            {goalInner}
          </Link>
        ) : (
          <a
            href="#practice-modes"
            className="flex h-[60px] w-full max-w-[321px] items-center gap-3 rounded-[14px] bg-[#fbd100] px-4 py-3.5 transition-opacity hover:opacity-95 active:scale-[0.99]"
            onClick={(e) => {
              e.preventDefault();
              document
                .getElementById("practice-modes")
                ?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          >
            {goalInner}
          </a>
        )}
      </div>
    </section>
  );
}

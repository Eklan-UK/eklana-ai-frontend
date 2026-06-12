"use client";

import Link from "next/link";
import { ChevronRight, Clock3, Loader2, Trophy } from "lucide-react";
import { useTranslations } from "next-intl";
import type { WeeklyChallengeListResponse } from "@/domain/challenges/weekly-challenge.service";
import { encodeWeekStartDate } from "@/lib/challenges/weekly-challenge-url";

export function WeeklyChallengeWeekCard({
	challenge,
}: {
	challenge: WeeklyChallengeListResponse;
}) {
	const t = useTranslations("account.weeklyChallenge");
	const drillSequence = challenge.drillSequence ?? [];
	const completedCount = drillSequence.filter((d) => d.completed).length;
	const totalDrills = drillSequence.length;
	const isCompleted = completedCount > 0 && completedCount === totalDrills;
	const isOngoing = completedCount > 0 && completedCount < totalDrills;
	const weekNumber = challenge.weekNumber ?? 0;
	const href = `/account/practice/weekly-challenge/${encodeWeekStartDate(challenge.weekStartDate)}`;
	const weekDateLabel = challenge.generatedAt
		? `Generated ${new Date(challenge.generatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
		: null;

	return (
		<Link
			href={href}
			className="flex items-center gap-3 rounded-2xl bg-card border border-border p-3 shadow-sm hover:shadow-md transition-shadow"
		>
			<div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-200 to-green-300 flex items-center justify-center text-2xl shrink-0 shadow-inner">
				<Trophy className="w-7 h-7 text-emerald-800" aria-hidden />
			</div>
			<div className="flex-1 min-w-0">
				<div className="flex items-center gap-2 mb-0.5 flex-wrap">
					<h3 className="font-semibold text-foreground text-sm">
						{weekNumber > 0
							? t("weekLabel", { number: weekNumber })
							: t("summaryFallback")}
					</h3>
					{challenge.status === "generating" ? (
						<span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
							<Loader2 className="w-3 h-3 animate-spin" />
							{t("statusGenerating")}
						</span>
					) : null}
					{challenge.status === "failed" ? (
						<span className="text-xs font-medium text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
							{t("statusFailed")}
						</span>
					) : null}
					{challenge.status === "ready" && isCompleted ? (
						<span className="text-xs font-medium text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
							{t("statusCompleted")}
						</span>
					) : null}
					{challenge.status === "ready" && isOngoing ? (
						<span className="text-xs font-medium text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
							{t("statusOngoing")}
						</span>
					) : null}
					{challenge.status === "ready" && !isOngoing && !isCompleted ? (
						<span className="text-xs font-medium text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
							{t("statusReady")}
						</span>
					) : null}
				</div>
				{weekDateLabel ? (
					<p className="text-xs text-muted-foreground/70 mb-0.5">{weekDateLabel}</p>
				) : null}
				<p className="text-xs text-muted-foreground line-clamp-2">
					{challenge.summaryMessage?.startsWith("This week focus on:")
						? "Personalized to address your weakest areas"
						: (challenge.summaryMessage || t("summaryFallback"))}
				</p>
				<div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
					<span>{t("drillCount", { count: drillSequence.length })}</span>
					{challenge.totalEstimatedMinutes > 0 ? (
						<span className="inline-flex items-center gap-1">
							<Clock3 className="w-3.5 h-3.5 shrink-0" />
							{t("estimatedMinutes", { minutes: challenge.totalEstimatedMinutes })}
						</span>
					) : null}
					{drillSequence.length > 0 ? (
						<span>
							{t("progress", {
								completed: completedCount,
								total: drillSequence.length,
							})}
						</span>
					) : null}
				</div>
			</div>
			<ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" aria-hidden />
		</Link>
	);
}

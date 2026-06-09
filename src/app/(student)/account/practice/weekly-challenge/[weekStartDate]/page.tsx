"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, Trophy } from "lucide-react";
import { BottomNav } from "@/components/layout/BottomNav";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { useUserCurrent } from "@/hooks/useUserCurrent";
import { useWeeklyChallenge } from "@/hooks/useWeeklyChallenge";
import { WeeklyChallengeDrillRow } from "@/components/weekly-challenge/WeeklyChallengeDrillRow";
import { decodeWeekStartDate } from "@/lib/challenges/weekly-challenge-url";

export default function WeeklyChallengeWeekPage() {
	const router = useRouter();
	const params = useParams();
	const encodedWeek = String(params.weekStartDate ?? "");
	const weekStartDate = decodeWeekStartDate(encodedWeek);
	const t = useTranslations("account.weeklyChallenge");
	const { data: me, isLoading: meLoading } = useUserCurrent();
	const { data: challenge, isLoading } = useWeeklyChallenge(weekStartDate);

	useEffect(() => {
		if (!meLoading && me?.user != null && me.user.isSubscribed !== true) {
			router.replace("/account/settings/subscriptions");
		}
	}, [meLoading, me, router]);

	if (meLoading || isLoading) {
		return (
			<div className="min-h-screen bg-background pb-24">
				<Header title={t("pageTitle")} showBack backHref="/account/practice/weekly-challenge" />
				<div className="flex items-center justify-center py-16">
					<Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
				</div>
				<BottomNav />
			</div>
		);
	}

	const drillSequence = challenge?.drillSequence ?? [];
	const isGenerating = challenge?.status === "generating";
	const isReady = challenge?.status === "ready";
	const hasDrills = drillSequence.length > 0;
	const weekTitle =
		challenge?.weekNumber && challenge.weekNumber > 0
			? t("weekLabel", { number: challenge.weekNumber })
			: t("pageTitle");

	return (
		<div className="min-h-screen bg-background pb-24">
			<Header
				title={weekTitle}
				showBack
				backHref="/account/practice/weekly-challenge"
			/>
			<div className="max-w-md mx-auto px-4 py-4 md:max-w-2xl">
				{isGenerating ? (
					<Card className="p-6 text-center">
						<Loader2 className="w-8 h-8 animate-spin text-emerald-600 mx-auto mb-3" />
						<p className="font-semibold text-foreground">{t("generating")}</p>
						<p className="text-sm text-muted-foreground mt-1">{t("generatingHint")}</p>
					</Card>
				) : null}

				{challenge?.status === "failed" ? (
					<Card className="p-6 text-center border-amber-200 bg-amber-50">
						<p className="text-sm text-amber-950">{t("failed")}</p>
					</Card>
				) : null}

				{isReady && hasDrills ? (
					<>
						<div className="bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-3xl p-5 shadow-lg mb-6 text-white">
							<div className="inline-flex items-center gap-1.5 bg-emerald-800/50 rounded-full px-3 py-1 mb-3">
								<Trophy className="w-3 h-3 text-emerald-200" />
								<span className="text-emerald-200 text-xs font-semibold uppercase tracking-wide">
									{t("badge")}
								</span>
							</div>
							<h2 className="text-xl font-bold font-nunito mb-2">
								{challenge.summaryMessage?.startsWith("This week focus on:")
									? "Tackle your weaknesses from last week"
									: (challenge.summaryMessage || t("summaryFallback"))}
							</h2>
							<p className="text-white/80 text-sm">
								{t("estimatedMinutes", { minutes: challenge.totalEstimatedMinutes })}
								{" · "}
								{t("drillCount", { count: drillSequence.length })}
							</p>
						</div>
						<div className="space-y-3">
							{drillSequence.map((item) => (
								<WeeklyChallengeDrillRow
									key={item.index}
									item={item}
									weekStartDate={weekStartDate}
									completedLabel={t("completed")}
								/>
							))}
						</div>
					</>
				) : null}

				{isReady && !hasDrills ? (
					<Card className="p-6 text-center">
						<Trophy className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
						<h2 className="font-bold text-foreground mb-2">{t("emptyTitle")}</h2>
						<p className="text-sm text-muted-foreground">
							{challenge?.isSunday ? t("emptySunday") : t("emptyDescription")}
						</p>
					</Card>
				) : null}

				{!challenge || challenge.status === "unavailable" ? (
					<Card className="p-6 text-center">
						<Trophy className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
						<h2 className="font-bold text-foreground mb-2">{t("emptyTitle")}</h2>
						<p className="text-sm text-muted-foreground">{t("emptyDescription")}</p>
					</Card>
				) : null}
			</div>
			<BottomNav />
		</div>
	);
}

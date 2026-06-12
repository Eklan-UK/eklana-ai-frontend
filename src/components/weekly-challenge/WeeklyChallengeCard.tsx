"use client";

import { Trophy, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { WeeklyChallengeListResponse } from "@/domain/challenges/weekly-challenge.service";

export function WeeklyChallengeCard({
	challenge,
}: {
	challenge: WeeklyChallengeListResponse;
}) {
	const router = useRouter();
	const t = useTranslations("account.weeklyChallenge");

	if (challenge.status === "generating") {
		return (
			<div className="mb-6">
				<div className="bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-3xl p-5 shadow-lg">
					<div className="inline-flex items-center gap-1.5 bg-emerald-800/50 rounded-full px-3 py-1 mb-3">
						<Trophy className="w-3 h-3 text-emerald-200" />
						<span className="text-emerald-200 text-xs font-semibold uppercase tracking-wide">
							{t("badge")}
						</span>
					</div>
					<div className="flex items-center gap-2 text-white mb-2">
						<Loader2 className="w-5 h-5 animate-spin" />
						<h3 className="text-lg font-bold font-nunito">{t("generating")}</h3>
					</div>
					<p className="text-white/80 text-sm">{t("generatingHint")}</p>
				</div>
			</div>
		);
	}

	if (challenge.status === "failed") {
		return (
			<div className="mb-6">
				<div className="bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-3xl p-5 shadow-lg">
					<div className="inline-flex items-center gap-1.5 bg-emerald-800/50 rounded-full px-3 py-1 mb-3">
						<Trophy className="w-3 h-3 text-emerald-200" />
						<span className="text-emerald-200 text-xs font-semibold uppercase tracking-wide">
							{t("badge")}
						</span>
					</div>
					<p className="text-white/90 text-sm">{t("failed")}</p>
				</div>
			</div>
		);
	}

	const drillSequence = challenge.drillSequence ?? [];
	const drillCount = drillSequence.length;
	const completedCount = drillSequence.filter((d) => d.completed).length;
	const hasProgress = completedCount > 0 && completedCount < drillCount;

	return (
		<div className="mb-6">
			<div className="bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-3xl p-5 shadow-lg">
				<div className="inline-flex items-center gap-1.5 bg-emerald-800/50 rounded-full px-3 py-1 mb-3">
					<Trophy className="w-3 h-3 text-emerald-200" />
					<span className="text-emerald-200 text-xs font-semibold uppercase tracking-wide">
						{t("badge")}
					</span>
				</div>
				<h3 className="text-white text-xl font-bold font-nunito mb-2">
					{challenge.summaryMessage?.startsWith("This week focus on:")
						? "Personalized to address your weakest areas"
						: (challenge.summaryMessage || t("summaryFallback"))}
				</h3>
				<div className="flex items-center gap-4 mb-4">
					<span className="text-white/80 text-sm">
						{t("drillCount", { count: drillCount })}
					</span>
					<span className="text-white/80 text-sm">
						{t("estimatedMinutes", { minutes: challenge.totalEstimatedMinutes })}
					</span>
				</div>
				<button
					type="button"
					onClick={() => router.push("/account/practice/weekly-challenge")}
					className="w-full bg-yellow-400 hover:bg-yellow-300 text-emerald-900 font-semibold text-base py-3.5 rounded-2xl transition-colors"
				>
					{hasProgress ? t("resume") : t("start")}
				</button>
			</div>
		</div>
	);
}

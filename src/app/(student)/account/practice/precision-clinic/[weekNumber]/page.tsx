"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, Target } from "lucide-react";
import { BottomNav } from "@/components/layout/BottomNav";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { LearnerPrecisionClinicDrillRow } from "@/components/precision-clinic";
import { useUserCurrent } from "@/hooks/useUserCurrent";
import { useLearnerPrecisionClinicWeek } from "@/hooks/useLearnerPrecisionClinic";

export default function PrecisionClinicWeekDetailPage() {
	const router = useRouter();
	const params = useParams();
	const learnerWeekId = String(params.weekNumber ?? "");
	const t = useTranslations("account.precisionClinic");
	const { data: me, isLoading: meLoading } = useUserCurrent();
	const {
		data: week,
		isLoading,
		isError,
	} = useLearnerPrecisionClinicWeek(learnerWeekId);

	useEffect(() => {
		if (!meLoading && me?.user != null && me.user.isSubscribed !== true) {
			router.replace("/account/settings/subscriptions");
		}
	}, [meLoading, me, router]);

	useEffect(() => {
		if (meLoading || isLoading || !learnerWeekId) return;
		if (isError || week === null) {
			router.replace("/account/practice/precision-clinic");
		}
	}, [meLoading, isLoading, isError, week, learnerWeekId, router]);

	if (meLoading || isLoading || !week) {
		return (
			<div className="min-h-screen bg-background pb-24">
				<Header
					title={t("pageTitle")}
					showBack
					backHref="/account/practice/precision-clinic"
				/>
				<div className="flex items-center justify-center py-16">
					<Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
				</div>
				<BottomNav />
			</div>
		);
	}

	const drills = [...(week.drills ?? [])].sort(
		(a, b) => a.sortOrder - b.sortOrder || a.index - b.index,
	);
	const completedCount = week.completedItemIndexes?.length ?? drills.filter((d) => d.completed).length;
	const totalItems = week.totalItems ?? drills.length;
	const weekTitle =
		week.title || t("weekLabel", { number: week.personalWeekNumber });

	return (
		<div className="min-h-screen bg-background pb-24">
			<Header
				title={weekTitle}
				showBack
				backHref="/account/practice/precision-clinic"
			/>
			<div className="max-w-md mx-auto px-4 py-4 md:max-w-2xl">
				{drills.length > 0 ? (
					<>
						<div className="bg-gradient-to-br from-teal-600 to-cyan-700 rounded-3xl p-5 shadow-lg mb-6 text-white">
							<div className="inline-flex items-center gap-1.5 bg-teal-800/50 rounded-full px-3 py-1 mb-3">
								<Target className="w-3 h-3 text-teal-200" />
								<span className="text-teal-200 text-xs font-semibold uppercase tracking-wide">
									{t("badge")}
								</span>
							</div>
							<h2 className="text-xl font-bold font-nunito mb-2">{weekTitle}</h2>
							<p className="text-white/80 text-sm">
								{t("progress", {
									completed: completedCount,
									total: totalItems,
								})}
								{" · "}
								{t("drillCount", { count: totalItems })}
							</p>
						</div>
						<div className="space-y-3">
							{drills.map((item) => (
								<LearnerPrecisionClinicDrillRow
									key={item.assignmentId || item.itemId || item.index}
									item={item}
									completedLabel={t("completed")}
									inProgressLabel={t("statusInProgress")}
									overdueLabel={t("statusOverdue")}
								/>
							))}
						</div>
					</>
				) : (
					<Card className="p-6 text-center">
						<Target className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
						<h2 className="font-bold text-foreground mb-2">{t("emptyTitle")}</h2>
						<p className="text-sm text-muted-foreground">{t("emptyDescription")}</p>
					</Card>
				)}
			</div>
			<BottomNav />
		</div>
	);
}

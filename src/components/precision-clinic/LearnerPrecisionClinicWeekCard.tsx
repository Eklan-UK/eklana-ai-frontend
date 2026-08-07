"use client";

import Link from "next/link";
import { ChevronRight, Target } from "lucide-react";
import { useTranslations } from "next-intl";
import type { PrecisionClinicLearnerWeekListItem } from "@/domain/precision-clinic/types";

export function LearnerPrecisionClinicWeekCard({
	week,
}: {
	week: PrecisionClinicLearnerWeekListItem;
}) {
	const t = useTranslations("account.precisionClinic");
	const completedCount = week.completedItems ?? 0;
	const totalItems = week.totalItems ?? 0;
	const isCompleted = totalItems > 0 && completedCount === totalItems;
	const isOngoing = completedCount > 0 && completedCount < totalItems;
	const href = `/account/practice/precision-clinic/${week.learnerWeekId}`;
	const assignedLabel = week.assignedAt
		? t("assignedOn", {
				date: new Date(week.assignedAt).toLocaleDateString("en-US", {
					month: "short",
					day: "numeric",
					year: "numeric",
				}),
			})
		: null;

	return (
		<Link
			href={href}
			className="flex items-center gap-3 rounded-2xl bg-card border border-border p-3 shadow-sm hover:shadow-md transition-shadow"
		>
			<div className="w-14 h-14 rounded-xl bg-gradient-to-br from-teal-200 to-cyan-300 flex items-center justify-center text-2xl shrink-0 shadow-inner">
				<Target className="w-7 h-7 text-teal-800" aria-hidden />
			</div>
			<div className="flex-1 min-w-0">
				<div className="flex items-center gap-2 mb-0.5 flex-wrap">
					<h3 className="font-semibold text-foreground text-sm">
						{week.title || t("weekLabel", { number: week.personalWeekNumber })}
					</h3>
					{isCompleted ? (
						<span className="text-xs font-medium text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
							{t("statusCompleted")}
						</span>
					) : null}
					{isOngoing ? (
						<span className="text-xs font-medium text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
							{t("statusOngoing")}
						</span>
					) : null}
					{!isOngoing && !isCompleted ? (
						<span className="text-xs font-medium text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
							{t("statusReady")}
						</span>
					) : null}
				</div>
				{assignedLabel ? (
					<p className="text-xs text-muted-foreground/70 mb-0.5">{assignedLabel}</p>
				) : null}
				<div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
					<span>{t("drillCount", { count: totalItems })}</span>
					{totalItems > 0 ? (
						<span>
							{t("progress", {
								completed: completedCount,
								total: totalItems,
							})}
						</span>
					) : null}
				</div>
			</div>
			<ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" aria-hidden />
		</Link>
	);
}

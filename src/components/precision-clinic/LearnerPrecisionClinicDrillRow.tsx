"use client";

import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { getDrillIcon, getDrillTypeInfo, getDrillTypeLabel } from "@/utils/drill";
import type { PrecisionClinicLearnerWeekDrillListItem } from "@/domain/precision-clinic/types";

const CATEGORY_TEXT: Record<string, string> = {
	green: "text-violet-600",
	blue: "text-sky-600",
	primary: "text-indigo-600",
	orange: "text-amber-700",
	indigo: "text-amber-600",
	pink: "text-pink-600",
	teal: "text-teal-700",
	violet: "text-violet-600",
	amber: "text-amber-700",
	emerald: "text-emerald-700",
	gray: "text-muted-foreground",
};

const THUMB_GRADIENT: Record<string, string> = {
	green: "from-emerald-200 to-teal-300",
	blue: "from-sky-200 to-blue-300",
	primary: "from-violet-200 to-purple-300",
	orange: "from-orange-200 to-amber-300",
	indigo: "from-amber-200 to-yellow-200",
	pink: "from-pink-200 to-rose-300",
	teal: "from-cyan-200 to-teal-300",
	violet: "from-violet-200 to-purple-300",
	amber: "from-amber-200 to-yellow-200",
	emerald: "from-emerald-200 to-green-300",
	gray: "from-muted to-muted dark:from-slate-600 dark:to-slate-700",
};

export function LearnerPrecisionClinicDrillRow({
	item,
	completedLabel,
	inProgressLabel,
	overdueLabel,
}: {
	item: PrecisionClinicLearnerWeekDrillListItem;
	completedLabel: string;
	inProgressLabel: string;
	overdueLabel?: string;
}) {
	const typeInfo = getDrillTypeInfo(item.type);
	const catClass = CATEGORY_TEXT[typeInfo.color] ?? CATEGORY_TEXT.gray!;
	const thumbGrad = THUMB_GRADIENT[typeInfo.color] ?? THUMB_GRADIENT.gray!;
	const isCompleted = item.completed || item.status === "completed";
	const isInProgress = !isCompleted && item.status === "in-progress";
	const isOverdue = !isCompleted && item.status === "overdue";

	const href =
		isCompleted && item.assignmentId
			? `/account/drills/${item.drillId}/completed?assignmentId=${item.assignmentId}`
			: item.assignmentId
				? `/account/drills/${item.drillId}?assignmentId=${item.assignmentId}`
				: `/account/drills/${item.drillId}`;

	return (
		<Link
			href={href}
			className="flex items-center gap-3 rounded-2xl bg-card border border-border p-3 shadow-sm hover:shadow-md transition-shadow"
		>
			<div
				className={`w-14 h-14 rounded-xl bg-gradient-to-br ${thumbGrad} flex items-center justify-center text-2xl shrink-0 shadow-inner`}
			>
				{getDrillIcon(item.type)}
			</div>
			<div className="flex-1 min-w-0">
				<h3 className="font-semibold text-foreground text-sm leading-snug line-clamp-2">
					{item.title}
				</h3>
				<p className={`text-xs mt-0.5 font-medium ${catClass}`}>
					• {getDrillTypeLabel(item.type)}
					{isInProgress ? (
						<span className="ml-1.5 text-sky-600">· {inProgressLabel}</span>
					) : null}
					{isOverdue && overdueLabel ? (
						<span className="ml-1.5 text-amber-700">· {overdueLabel}</span>
					) : null}
				</p>
			</div>
			{isCompleted ? (
				<div className="flex items-center gap-1 text-emerald-600 shrink-0">
					<CheckCircle2 className="w-5 h-5" aria-hidden />
					<span className="text-xs font-medium sr-only sm:not-sr-only">
						{completedLabel}
					</span>
				</div>
			) : null}
		</Link>
	);
}

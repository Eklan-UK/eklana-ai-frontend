"use client";

import Link from "next/link";
import { CheckCircle2, ChevronRight, Clock3 } from "lucide-react";
import {
	getDrillIcon,
	getDrillTypeInfo,
	getDrillTypeLabel,
} from "@/utils/drill";
import type { WeeklyChallengeListItem } from "@/domain/challenges/weekly-challenge.service";
import { encodeWeekStartDate } from "@/lib/challenges/weekly-challenge-url";

const DRILL_TYPE_TITLE: Record<string, string> = {
	pronunciation: "Pronunciation",
	vocabulary: "Vocabulary",
	roleplay: "Role-play",
	key_phrases: "Key Phrases",
};

const DRILL_TYPE_BADGE: Record<string, string> = {
	pronunciation: "Pronunciation",
	vocabulary: "Fill-in-the-Blank",
	roleplay: "Role-play",
	key_phrases: "Key Phrases",
};

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

export function WeeklyChallengeDrillRow({
	item,
	weekStartDate,
	completedLabel,
}: {
	item: WeeklyChallengeListItem;
	weekStartDate: string;
	completedLabel: string;
}) {
	const typeInfo = getDrillTypeInfo(item.drillType);
	const catClass = CATEGORY_TEXT[typeInfo.color] ?? CATEGORY_TEXT.gray!;
	const thumbGrad = THUMB_GRADIENT[typeInfo.color] ?? THUMB_GRADIENT.gray!;

	return (
		<Link
			href={`/account/practice/weekly-challenge/${encodeWeekStartDate(weekStartDate)}/${item.index}`}
			className="flex items-center gap-3 rounded-2xl bg-card border border-border p-3 shadow-sm hover:shadow-md transition-shadow"
		>
			<div
				className={`w-14 h-14 rounded-xl bg-gradient-to-br ${thumbGrad} flex items-center justify-center text-2xl shrink-0 shadow-inner`}
			>
				{getDrillIcon(item.drillType)}
			</div>
			<div className="flex-1 min-w-0">
				<h3 className="font-semibold text-foreground text-sm leading-snug line-clamp-2">
					{DRILL_TYPE_TITLE[item.drillType] ?? item.label}
				</h3>
				<p className={`text-xs mt-0.5 font-medium ${catClass}`}>
					• {DRILL_TYPE_BADGE[item.drillType] ?? getDrillTypeLabel(item.drillType)}
				</p>
				{item.instructions ? (
					<p className="text-xs text-muted-foreground mt-1 line-clamp-2">
						{item.instructions}
					</p>
				) : null}
				<div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
					<Clock3 className="w-3.5 h-3.5 shrink-0" />
					{item.estimatedMinutes} min
				</div>
			</div>
			{item.completed ? (
				<div className="flex items-center gap-1 text-emerald-600 shrink-0">
					<CheckCircle2 className="w-5 h-5" aria-hidden />
					<span className="text-xs font-medium sr-only sm:not-sr-only">
						{completedLabel}
					</span>
				</div>
			) : (
				<ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" aria-hidden />
			)}
		</Link>
	);
}

"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import DrillPracticeInterface from "@/components/drills/DrillPracticeInterface";
import { useUserCurrent } from "@/hooks/useUserCurrent";
import { useWeeklyChallengeItem } from "@/hooks/useWeeklyChallenge";
import { toDrillShape } from "@/lib/challenges/challengeDrillAdapter";
import type { ChallengeDrillItem } from "@/domain/challenges/types";

export default function WeeklyChallengePracticePage() {
	const router = useRouter();
	const params = useParams();
	const index = parseInt(String(params.index), 10);
	const { data: me, isLoading: meLoading } = useUserCurrent();
	const { data: itemData, isLoading, error } = useWeeklyChallengeItem(index, {
		enabled: !Number.isNaN(index) && index >= 0,
	});

	useEffect(() => {
		if (!meLoading && me?.user != null && me.user.isSubscribed !== true) {
			router.replace("/account/settings/subscriptions");
		}
	}, [meLoading, me, router]);

	useEffect(() => {
		if (!isLoading && (Number.isNaN(index) || index < 0 || error || !itemData)) {
			if (!isLoading && !meLoading) {
				router.replace("/account/weekly-challenge");
			}
		}
	}, [isLoading, meLoading, index, error, itemData, router]);

	if (meLoading || isLoading || !itemData) {
		return (
			<div className="min-h-screen bg-background flex items-center justify-center">
				<Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	const drill = toDrillShape(
		itemData.item as unknown as ChallengeDrillItem,
		itemData.challengeId,
		itemData.index,
	);

	return (
		<DrillPracticeInterface
			drill={drill}
			weeklyChallengeMeta={{
				challengeId: itemData.challengeId,
				itemIndex: itemData.index,
			}}
		/>
	);
}

"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useWeeklyChallenge } from "@/hooks/useWeeklyChallenge";
import { encodeWeekStartDate } from "@/lib/challenges/weekly-challenge-url";

export default function LegacyWeeklyChallengeDrillRedirect() {
	const router = useRouter();
	const params = useParams();
	const index = String(params.index ?? "");
	const { data: challenge, isLoading } = useWeeklyChallenge();

	useEffect(() => {
		if (isLoading) return;

		if (challenge?.weekStartDate) {
			router.replace(
				`/account/practice/weekly-challenge/${encodeWeekStartDate(challenge.weekStartDate)}/${index}`,
			);
			return;
		}

		router.replace("/account/practice/weekly-challenge");
	}, [challenge, index, isLoading, router]);

	return (
		<div className="min-h-screen bg-background flex items-center justify-center">
			<Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
		</div>
	);
}

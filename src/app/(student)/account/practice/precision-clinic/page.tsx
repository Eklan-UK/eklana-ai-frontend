"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, Target } from "lucide-react";
import { BottomNav } from "@/components/layout/BottomNav";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { LearnerPrecisionClinicWeekCard } from "@/components/precision-clinic";
import { useUserCurrent } from "@/hooks/useUserCurrent";
import { useLearnerPrecisionClinicHistory } from "@/hooks/useLearnerPrecisionClinic";

export default function PrecisionClinicHistoryPage() {
	const router = useRouter();
	const t = useTranslations("account.precisionClinic");
	const { data: me, isLoading: meLoading } = useUserCurrent();
	const { data: weeks = [], isLoading } = useLearnerPrecisionClinicHistory();

	useEffect(() => {
		if (!meLoading && me?.user != null && me.user.isSubscribed !== true) {
			router.replace("/account/settings/subscriptions");
		}
	}, [meLoading, me, router]);

	if (meLoading || isLoading) {
		return (
			<div className="min-h-screen bg-background pb-24">
				<Header title={t("pageTitle")} showBack backHref="/account/practice" />
				<div className="flex items-center justify-center py-16">
					<Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
				</div>
				<BottomNav />
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-background pb-24">
			<Header title={t("pageTitle")} showBack backHref="/account/practice" />
			<div className="max-w-md mx-auto px-4 py-4 md:max-w-2xl">
				{weeks.length > 0 ? (
					<div className="space-y-3">
						{weeks.map((week) => (
							<LearnerPrecisionClinicWeekCard
								key={week.learnerWeekId}
								week={week}
							/>
						))}
					</div>
				) : (
					<Card className="p-6 text-center">
						<Target className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
						<h2 className="font-bold text-foreground mb-2">{t("historyEmptyTitle")}</h2>
						<p className="text-sm text-muted-foreground">{t("historyEmptyDescription")}</p>
					</Card>
				)}
			</div>
			<BottomNav />
		</div>
	);
}

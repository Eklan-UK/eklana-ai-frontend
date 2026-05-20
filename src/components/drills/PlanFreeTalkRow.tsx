"use client";

import Link from "next/link";
import { ChevronRight, Clock3, Lock, MessageSquare, AlertCircle } from "lucide-react";
import { freeTalkScenarioTypeLabel } from "@/lib/learner-assigned-plan";
import { DRILL_ESTIMATED_DURATION_LABEL } from "@/utils/drill";
import {
  formatFreeTalkDueLabel,
  isFreeTalkScenarioDueSoon,
} from "@/lib/free-talk-scenario-completion";
import { ProLockHoverWrap } from "@/components/subscription/ProLockHoverWrap";
import { ProLockedCtaSwap } from "@/components/subscription/ProLockedCtaSwap";

export interface PlanFreeTalkRowProps {
  scenarioId: string;
  title: string;
  scenarioType: string;
  completionDate?: string | Date | null;
  completedAt?: string | Date | null;
  locked?: boolean;
}

export function PlanFreeTalkRow({
  scenarioId,
  title,
  scenarioType,
  completionDate,
  completedAt,
  locked = false,
}: PlanFreeTalkRowProps) {
  const href = `/account/practice/free-talk/session?scenarioId=${encodeURIComponent(scenarioId)}`;
  const typeLabel = freeTalkScenarioTypeLabel(scenarioType);
  const completed = completedAt != null;
  const showDue =
    completionDate != null && isFreeTalkScenarioDueSoon(completionDate, completed);

  const row = (
    <div
      className={`flex items-center gap-3 rounded-2xl bg-card border border-border p-3 shadow-sm transition-shadow ${
        locked ? "cursor-default" : "hover:shadow-md"
      }`}
    >
      <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-200 to-teal-300 flex items-center justify-center shrink-0 shadow-inner">
        <MessageSquare className="w-7 h-7 text-emerald-800" aria-hidden />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-foreground text-sm leading-snug line-clamp-2">
          {title}
        </h3>
        <p className="text-xs mt-0.5 font-medium text-emerald-700 dark:text-emerald-400">
          • {typeLabel}
        </p>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs mt-1">
          <span className="flex items-center gap-1 text-muted-foreground">
            <Clock3 className="w-3.5 h-3.5 shrink-0" />
            {DRILL_ESTIMATED_DURATION_LABEL}
          </span>
          {showDue && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 font-medium text-amber-900 dark:text-amber-200">
              <AlertCircle className="w-3 h-3 shrink-0" />
              Due {formatFreeTalkDueLabel(completionDate!)}
            </span>
          )}
        </div>
      </div>
      {locked ? (
        <ProLockHoverWrap className="shrink-0">
          <ProLockedCtaSwap density="compact">
            <span className="inline-flex items-center gap-1 rounded-lg bg-muted px-2 py-1 text-xs font-medium text-muted-foreground pointer-events-none">
              <Lock className="w-3 h-3" />
              Pro
            </span>
          </ProLockedCtaSwap>
        </ProLockHoverWrap>
      ) : (
        <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" aria-hidden />
      )}
    </div>
  );

  if (locked) {
    return (
      <Link href="/account/settings/subscriptions" className="block">
        {row}
      </Link>
    );
  }

  return (
    <Link href={href} className="block">
      {row}
    </Link>
  );
}

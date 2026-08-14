"use client";

import Image from "next/image";
import Link from "next/link";
import { Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { ProLockHoverWrap } from "@/components/subscription/ProLockHoverWrap";
import { ProLockedCtaSwap } from "@/components/subscription/ProLockedCtaSwap";

type ModeId = "freeTalk" | "precisionClinic" | "weeklyChallenge" | "simulation";

const MODES: Array<{
  id: ModeId;
  href: string;
  iconBg: string;
  iconSrc: string;
}> = [
  {
    id: "freeTalk",
    href: "/account/practice/simulation",
    iconBg: "bg-[#eff6ff]",
    iconSrc: "/icons/practice-hub/free-talk.svg",
  },
  {
    id: "precisionClinic",
    href: "/account/practice/precision-clinic",
    iconBg: "bg-[#e8f5f0]",
    iconSrc: "/icons/practice-hub/target.svg",
  },
  {
    id: "weeklyChallenge",
    href: "/account/practice/weekly-challenge",
    iconBg: "bg-[#fff4ed]",
    iconSrc: "/icons/practice-hub/trophy.svg",
  },
  {
    id: "simulation",
    href: "/account/practice/simulation",
    iconBg: "bg-[#fce8f3]",
    // TODO(design): placeholder icon reused from Free Talk — needs a real
    // Simulation Room icon asset from design before ship.
    iconSrc: "/icons/practice-hub/free-talk.svg",
  },
];

function ModeRow({
  href,
  iconBg,
  iconSrc,
  title,
  subtitle,
  locked,
  isLast,
}: {
  href: string;
  iconBg: string;
  iconSrc: string;
  title: string;
  subtitle: string;
  locked: boolean;
  isLast: boolean;
}) {
  const inner = (
    <div
      className={`flex items-center gap-3.5 px-4 py-3.5 ${
        !isLast ? "border-b border-[#f9fafb] dark:border-border" : ""
      } ${
        locked
          ? "opacity-60 cursor-not-allowed"
          : "hover:bg-muted/40 active:scale-[0.99] cursor-pointer transition-colors"
      }`}
    >
      <div
        className={`flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-[14px] ${iconBg}`}
      >
        <span className="relative block size-5 overflow-hidden">
          <Image
            src={iconSrc}
            alt=""
            width={20}
            height={20}
            className="size-full"
            unoptimized
          />
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-extrabold font-nunito text-[#101828] dark:text-foreground leading-[17.5px]">
            {title}
          </p>
          {locked && (
            <span className="inline-block rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold leading-none text-orange-800">
              Pro
            </span>
          )}
        </div>
        <p className="mt-0.5 text-[11.5px] font-semibold font-nunito leading-[15.8px] text-[#99a1af] dark:text-muted-foreground">
          {subtitle}
        </p>
      </div>
      {locked ? (
        <ProLockedCtaSwap density="compact">
          <span
            className="flex size-[34px] shrink-0 items-center justify-center rounded-xl border border-border bg-muted text-muted-foreground pointer-events-none"
            aria-hidden
          >
            <Lock className="size-4" />
          </span>
        </ProLockedCtaSwap>
      ) : (
        <span className="relative block size-[17px] shrink-0 overflow-hidden">
          <Image
            src="/icons/practice-hub/chevron-right.svg"
            alt=""
            width={17}
            height={17}
            className="size-full"
            unoptimized
          />
        </span>
      )}
    </div>
  );

  if (locked) {
    return (
      <ProLockHoverWrap className="block w-full">
        <div aria-disabled="true">{inner}</div>
      </ProLockHoverWrap>
    );
  }

  return <Link href={href}>{inner}</Link>;
}

export interface PracticeModesListProps {
  locked?: boolean;
  heading?: ReactNode;
}

export function PracticeModesList({
  locked = false,
  heading,
}: PracticeModesListProps) {
  const t = useTranslations("account.practiceHub");

  return (
    <section id="practice-modes" className="scroll-mt-24">
      {heading ?? (
        <h2 className="text-[15px] font-extrabold font-nunito text-[#101828] dark:text-foreground leading-[22.5px] mb-2.5">
          {t("practiceModes")}
        </h2>
      )}
      <div className="overflow-hidden rounded-[18px] bg-card shadow-[0px_1px_6px_0px_rgba(0,0,0,0.06)] dark:border dark:border-border">
        {MODES.map((mode, i) => (
          <ModeRow
            key={mode.id}
            href={mode.href}
            iconBg={mode.iconBg}
            iconSrc={mode.iconSrc}
            title={t(`${mode.id}Title`)}
            subtitle={t(`${mode.id}Subtitle`)}
            locked={locked}
            isLast={i === MODES.length - 1}
          />
        ))}
      </div>
    </section>
  );
}

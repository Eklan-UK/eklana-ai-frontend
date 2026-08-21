"use client";

import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

export type ProfileMenuIconTone =
  | "primary"
  | "blue"
  | "yellow"
  | "danger"
  | "muted";

const TONE_CLASS: Record<ProfileMenuIconTone, string> = {
  primary: "bg-primary/10 text-primary",
  blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  yellow: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400",
  danger: "bg-red-500/10 text-accent-red",
  muted: "bg-muted text-muted-foreground",
};

export interface ProfileMenuRowProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  href?: string;
  onClick?: () => void;
  trailing?: ReactNode;
  danger?: boolean;
  iconTone?: ProfileMenuIconTone;
  last?: boolean;
}

export function ProfileMenuRow({
  icon: Icon,
  title,
  subtitle,
  href,
  onClick,
  trailing,
  danger = false,
  iconTone,
  last = false,
}: ProfileMenuRowProps) {
  const tone = iconTone ?? (danger ? "danger" : "primary");
  const content = (
    <div
      className={`flex items-center gap-3 py-3.5 ${
        last ? "" : "border-b border-border"
      }`}
    >
      <div
        className={`flex size-10 shrink-0 items-center justify-center rounded-[10px] ${TONE_CLASS[tone]}`}
      >
        <Icon className="size-5" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p
          className={`text-base font-semibold truncate ${
            danger ? "text-accent-red" : "text-foreground"
          }`}
        >
          {title}
        </p>
        {subtitle ? (
          <p className="text-sm text-muted-foreground truncate">{subtitle}</p>
        ) : null}
      </div>
      {trailing ? <div className="shrink-0">{trailing}</div> : null}
      {href || onClick ? (
        <ChevronRight
          className="size-5 shrink-0 text-muted-foreground"
          aria-hidden
        />
      ) : null}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block no-underline hover:no-underline">
        {content}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="block w-full text-left">
        {content}
      </button>
    );
  }

  return content;
}

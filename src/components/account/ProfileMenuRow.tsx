"use client";

import type { LucideIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import {
  createContext,
  useContext,
  type ReactNode,
} from "react";

export type ProfileMenuIconTone =
  | "primary"
  | "teal"
  | "blue"
  | "yellow"
  | "danger"
  | "muted"
  | "slate";

const TONE_CLASS: Record<ProfileMenuIconTone, string> = {
  primary: "bg-[#ecffed] text-primary dark:bg-primary/20",
  teal: "bg-[#e8f5f0] text-[#146c5b] dark:bg-[rgba(20,108,91,0.22)]",
  blue: "bg-[#eff6ff] text-blue-600 dark:bg-blue-500/20 dark:text-blue-400",
  yellow: "bg-[#fef9c3] text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400",
  danger: "bg-[#fef2f2] text-[#fb2c36] dark:bg-red-500/15",
  muted: "bg-muted text-muted-foreground",
  slate: "bg-[#f1f5f9] text-slate-600 dark:bg-slate-500/20 dark:text-slate-300",
};

export const ProfileMenuCardContext = createContext(false);

export interface ProfileMenuRowProps {
  icon?: LucideIcon;
  iconSrc?: string;
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
  iconSrc,
  title,
  subtitle,
  href,
  onClick,
  trailing,
  danger = false,
  iconTone,
  last = false,
}: ProfileMenuRowProps) {
  const inCard = useContext(ProfileMenuCardContext);
  const tone = iconTone ?? (danger ? "danger" : "primary");
  const content = (
    <div
      className={`flex items-center gap-3.5 py-3.5 ${
        inCard ? "px-4" : ""
      } ${last ? "" : "border-b border-[#f9fafb] dark:border-border"}`}
    >
      <div
        className={`flex size-11 shrink-0 items-center justify-center rounded-[13px] ${TONE_CLASS[tone]}`}
      >
        {iconSrc ? (
          <span className="relative block size-[19px] overflow-hidden">
            <Image
              src={iconSrc}
              alt=""
              width={19}
              height={19}
              className="size-full"
              unoptimized
            />
          </span>
        ) : Icon ? (
          <Icon className="size-[19px]" aria-hidden />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <p
          className={`truncate font-nunito text-sm font-extrabold leading-[17.5px] ${
            danger ? "text-[#fb2c36]" : "text-[#101828] dark:text-foreground"
          }`}
        >
          {title}
        </p>
        {subtitle ? (
          <p className="mt-0.5 truncate font-nunito text-[11.5px] font-semibold leading-[17.25px] text-[#99a1af]">
            {subtitle}
          </p>
        ) : null}
      </div>
      {trailing ? <div className="shrink-0">{trailing}</div> : null}
      {href || onClick ? (
        <span className="relative block size-4 shrink-0 overflow-hidden">
          <Image
            src="/icons/profile/chevron.svg"
            alt=""
            width={16}
            height={16}
            className="size-full"
            unoptimized
          />
        </span>
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

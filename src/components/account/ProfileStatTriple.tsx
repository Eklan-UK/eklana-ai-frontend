"use client";

import type { LucideIcon } from "lucide-react";
import Link from "next/link";

export interface ProfileStatItem {
  icon: LucideIcon;
  value: string;
  label: string;
  href?: string;
}

export function ProfileStatTriple({
  items,
  variant = "onLight",
}: {
  items: [ProfileStatItem, ProfileStatItem, ProfileStatItem];
  variant?: "onLight" | "onDark";
}) {
  const onDark = variant === "onDark";
  const divider = onDark ? "bg-white/25" : "bg-border";
  const valueClass = onDark
    ? "text-white"
    : "text-foreground";
  const labelClass = onDark
    ? "text-white/80"
    : "text-muted-foreground";
  const iconClass = onDark ? "text-white" : "text-primary";

  return (
    <div className="grid grid-cols-3 items-stretch">
      {items.map((item, i) => {
        const Icon = item.icon;
        const inner = (
          <div className="flex flex-col items-center justify-center gap-1 px-1 py-1 text-center">
            <Icon className={`size-5 ${iconClass}`} aria-hidden />
            <p className={`text-lg font-bold tabular-nums leading-none ${valueClass}`}>
              {item.value}
            </p>
            <p className={`text-[11px] leading-tight ${labelClass}`}>{item.label}</p>
          </div>
        );

        return (
          <div key={item.label} className="relative">
            {i > 0 ? (
              <span
                className={`absolute left-0 top-2 bottom-2 w-px ${divider}`}
                aria-hidden
              />
            ) : null}
            {item.href ? (
              <Link
                href={item.href}
                className="block no-underline hover:no-underline rounded-lg hover:bg-white/10"
              >
                {inner}
              </Link>
            ) : (
              inner
            )}
          </div>
        );
      })}
    </div>
  );
}

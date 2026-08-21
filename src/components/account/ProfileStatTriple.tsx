"use client";

import type { LucideIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export interface ProfileStatItem {
  icon?: LucideIcon;
  iconSrc?: string;
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
  const divider = onDark ? "bg-white/20" : "bg-border";
  const valueClass = onDark
    ? "text-white text-[22px] leading-[22px]"
    : "text-foreground text-lg leading-none";
  const labelClass = onDark
    ? "text-white/72 text-[11px] leading-[16.5px]"
    : "text-muted-foreground text-[11px] leading-tight";
  const iconClass = onDark ? "text-white" : "text-primary";

  return (
    <div className="grid grid-cols-3 items-stretch">
      {items.map((item, i) => {
        const Icon = item.icon;
        const inner = (
          <div
            className={`flex flex-col items-center text-center ${
              onDark ? "px-1 py-5" : "justify-center gap-1 px-1 py-1"
            }`}
          >
            {item.iconSrc ? (
              <span className="relative block size-5 overflow-hidden">
                <Image
                  src={item.iconSrc}
                  alt=""
                  width={20}
                  height={20}
                  className="size-full"
                  unoptimized
                />
              </span>
            ) : Icon ? (
              <Icon className={`size-5 ${iconClass}`} aria-hidden />
            ) : null}
            <p
              className={`font-nunito font-extrabold tabular-nums ${valueClass} ${
                onDark ? "mt-1.5" : ""
              }`}
            >
              {item.value}
            </p>
            <p
              className={`font-nunito font-semibold ${labelClass} ${
                onDark ? "mt-0.5" : ""
              }`}
            >
              {item.label}
            </p>
          </div>
        );

        return (
          <div key={item.label} className="relative">
            {i > 0 ? (
              <span
                className={`absolute bottom-5 left-0 top-5 w-px ${divider}`}
                aria-hidden
              />
            ) : null}
            {item.href ? (
              <Link
                href={item.href}
                className="block rounded-lg no-underline hover:bg-white/10 hover:no-underline"
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

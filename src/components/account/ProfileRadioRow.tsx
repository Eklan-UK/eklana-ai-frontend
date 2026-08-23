"use client";

import type { ReactNode } from "react";

export function ProfileRadio({ selected }: { selected: boolean }) {
  return (
    <span
      className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 ${
        selected ? "border-primary bg-primary" : "border-muted-foreground/40"
      }`}
      aria-hidden
    >
      {selected ? <span className="size-1.5 rounded-full bg-white" /> : null}
    </span>
  );
}

export function ProfileRadioRow({
  selected,
  onSelect,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`w-full text-left rounded-2xl border px-4 py-3.5 transition-colors ${
        selected
          ? "border-primary bg-primary/5"
          : "border-border bg-card hover:bg-muted/50"
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">{children}</div>
        <ProfileRadio selected={selected} />
      </div>
    </button>
  );
}

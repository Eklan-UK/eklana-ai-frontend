"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  Archive,
  Copy,
  Eye,
  MoreVertical,
  Pencil,
  Play,
  Trash2,
  Users,
} from "lucide-react";

export type ClinicRowAction =
  | "view"
  | "edit"
  | "duplicate"
  | "assign"
  | "preview"
  | "archive"
  | "delete";

type ClinicRowActionsMenuProps = {
  drillTitle: string;
  disabled?: boolean;
  busyAction?: ClinicRowAction | null;
  onAction: (action: ClinicRowAction) => void;
};

const MENU_ITEMS: Array<{
  action: ClinicRowAction;
  label: string;
  icon: typeof Eye;
  danger?: boolean;
}> = [
  { action: "view", label: "View Drill", icon: Eye },
  { action: "edit", label: "Edit Drill", icon: Pencil },
  { action: "duplicate", label: "Duplicate", icon: Copy },
  { action: "assign", label: "Assign to Students", icon: Users },
  { action: "preview", label: "Preview Drill", icon: Play },
  { action: "archive", label: "Archive Drill", icon: Archive },
  { action: "delete", label: "Delete Drill", icon: Trash2, danger: true },
];

/** Approximate menu height for flip-up when near viewport bottom. */
const MENU_HEIGHT_ESTIMATE = 300;

export function ClinicRowActionsMenu({
  drillTitle,
  disabled,
  busyAction,
  onAction,
}: ClinicRowActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const placeMenu = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpward = spaceBelow < MENU_HEIGHT_ESTIMATE && rect.top > MENU_HEIGHT_ESTIMATE;
    setMenuStyle({
      position: "fixed",
      right: window.innerWidth - rect.right,
      ...(openUpward
        ? { bottom: window.innerHeight - rect.top + 4 }
        : { top: rect.bottom + 4 }),
    });
  };

  const toggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    placeMenu();
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        rootRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onReposition = () => {
      // Close on scroll/resize so fixed coords don't drift vs the row.
      setOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onReposition, true);
    window.addEventListener("resize", onReposition);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onReposition, true);
      window.removeEventListener("resize", onReposition);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative inline-flex justify-end">
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={toggle}
        className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 disabled:cursor-not-allowed disabled:opacity-50 dark:text-muted-foreground dark:hover:bg-muted dark:hover:text-foreground"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Actions for ${drillTitle}`}
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {open && menuStyle ? (
        <div
          ref={menuRef}
          role="menu"
          style={menuStyle}
          className="z-50 w-52 overflow-hidden rounded-xl border border-gray-100 bg-white py-1 shadow-lg dark:border-border dark:bg-card"
        >
          {MENU_ITEMS.map((item) => {
            const Icon = item.icon;
            const isBusy = busyAction === item.action;
            return (
              <button
                key={item.action}
                type="button"
                role="menuitem"
                disabled={Boolean(busyAction)}
                onClick={() => {
                  setOpen(false);
                  onAction(item.action);
                }}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors disabled:opacity-50 ${
                  item.danger
                    ? "text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                    : "text-gray-700 hover:bg-gray-50 dark:text-foreground dark:hover:bg-muted"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{isBusy ? `${item.label}…` : item.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { CustomiseQuickActionsModal } from "./CustomiseQuickActionsModal";
import {
  getQuickActionIdsServerSnapshot,
  loadQuickActionIds,
  resolveQuickActions,
  saveQuickActionIds,
  subscribeQuickActionIds,
} from "./quick-actions";

export function QuickActions() {
  const [customiseOpen, setCustomiseOpen] = useState(false);
  const ids = useSyncExternalStore(
    subscribeQuickActionIds,
    loadQuickActionIds,
    getQuickActionIdsServerSnapshot,
  );
  const visibleActions = resolveQuickActions(ids);

  return (
    <section className="overflow-hidden rounded-[22px] border border-gray-200 bg-white shadow-sm dark:border-border dark:bg-card">
      <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3.5 dark:border-border">
        <h2 className="text-[13px] font-extrabold text-[#101828] dark:text-foreground">
          Quick Actions
        </h2>
        <button
          type="button"
          onClick={() => setCustomiseOpen(true)}
          className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#99a1af] hover:text-gray-600 dark:hover:text-foreground"
        >
          <span className="relative size-3 overflow-clip">
            {/* Figma-exported SVG; next/image does not serve local SVGs reliably. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/admin-dashboard/icon-customise.svg"
              alt=""
              width={12}
              height={12}
              className="size-full"
            />
          </span>
          Customise
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-5">
        {visibleActions.map((action) => (
          <Link
            key={action.id}
            href={action.href}
            className="flex flex-col items-center gap-2.5 rounded-[22px] border border-gray-200 px-2 py-4 transition-colors hover:border-gray-300 hover:bg-gray-50 dark:border-border dark:hover:bg-muted"
          >
            <div
              className={`flex size-10 items-center justify-center overflow-clip ${action.iconBg} ${action.iconRounded}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={action.iconSrc}
                alt=""
                width={17}
                height={17}
                className="size-[17px]"
              />
            </div>
            <p className="text-center text-[11px] font-bold text-[#101828] dark:text-foreground">
              {action.label}
            </p>
          </Link>
        ))}
      </div>
      {customiseOpen ? (
        <CustomiseQuickActionsModal
          selectedIds={visibleActions.map((action) => action.id)}
          onClose={() => setCustomiseOpen(false)}
          onSave={(next) => {
            saveQuickActionIds(next);
            setCustomiseOpen(false);
          }}
        />
      ) : null}
    </section>
  );
}

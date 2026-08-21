"use client";

import type { ReactNode } from "react";
import { ProfileMenuCardContext } from "@/components/account/ProfileMenuRow";

export function ProfileMenuSection({
  title,
  children,
  card = false,
}: {
  title?: string;
  children: ReactNode;
  card?: boolean;
}) {
  const body = card ? (
    <ProfileMenuCardContext.Provider value={true}>
      <div className="overflow-hidden rounded-[18px] bg-card shadow-[0px_1px_6px_0px_rgba(0,0,0,0.06)] dark:border dark:border-border">
        {children}
      </div>
    </ProfileMenuCardContext.Provider>
  ) : (
    children
  );

  return (
    <section>
      {title ? (
        <h2 className="mb-2 px-0 font-nunito text-[10.5px] font-extrabold uppercase tracking-[1.05px] text-[#99a1af]">
          {title}
        </h2>
      ) : null}
      {body}
    </section>
  );
}

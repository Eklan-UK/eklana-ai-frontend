import type { ReactNode } from "react";

export function ProfileMenuSection({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <section className="py-2">
      {title ? (
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 px-1">
          {title}
        </h2>
      ) : null}
      <div>{children}</div>
    </section>
  );
}

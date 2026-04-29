import type { HTMLAttributes } from "react";

type RescheduleTagProps = HTMLAttributes<HTMLSpanElement>;

/**
 * In-app label when the class’s next (or this) session was set via reschedule.
 */
export function RescheduleTag({ className, ...rest }: RescheduleTagProps) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-900",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      Reschedule
    </span>
  );
}

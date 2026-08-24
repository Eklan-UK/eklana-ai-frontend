import type { ReactNode } from "react";
import type { NationalityOption } from "@/lib/nationalities";

interface NationalityOptionRowProps {
  option: NationalityOption;
  trailing?: ReactNode;
}

/**
 * Flag + English label on the left, native snippet on the far right, optional trailing slot (e.g. checkmark).
 */
export function NationalityOptionRow({
  option,
  trailing,
}: NationalityOptionRowProps) {
  return (
    <div className="flex items-center gap-3 md:gap-4 justify-between min-w-0 w-full">
      <div className="flex items-center gap-3 md:gap-4 min-w-0 flex-1">
        <span className="text-2xl shrink-0 leading-none">{option.flag}</span>
        <span className="text-base font-semibold text-foreground truncate">
          {option.label}
        </span>
      </div>
      <span className="text-sm text-gray-500 shrink-0 max-w-[45%] text-right truncate">
        {option.native}
      </span>
      {trailing != null ? <div className="shrink-0">{trailing}</div> : null}
    </div>
  );
}

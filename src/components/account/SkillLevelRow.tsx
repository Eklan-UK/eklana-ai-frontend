import type { SkillBandId } from "@/domain/progress/skill-bands";
import { getSkillBand, skillBarTicks } from "@/domain/progress/skill-bands";

const BAND_TICK: Record<SkillBandId, string> = {
  emerging: "bg-[#ef4444]",
  developing: "bg-[#f97316]",
  effective: "bg-[#3b82f6]",
  confident: "bg-[#22c55e]",
  authoritative: "bg-[#059669]",
};

const BAND_TEXT: Record<SkillBandId, string> = {
  emerging: "text-[#ef4444]",
  developing: "text-[#f97316]",
  effective: "text-[#3b82f6]",
  confident: "text-[#22c55e]",
  authoritative: "text-[#059669]",
};

const BAND_PILL: Record<SkillBandId, string> = {
  emerging: "bg-[#fef2f2] text-[#ef4444]",
  developing: "bg-[#fff7ed] text-[#f97316]",
  effective: "bg-[#eff6ff] text-[#3b82f6]",
  confident: "bg-[#f0fdf4] text-[#22c55e]",
  authoritative: "bg-emerald-50 text-[#059669] dark:bg-emerald-500/15 dark:text-emerald-300",
};

export function SkillLevelRow({
  emoji,
  title,
  score,
}: {
  emoji: string;
  title: string;
  score: number;
}) {
  const band = getSkillBand(score);
  const filled = skillBarTicks(score);
  const pct = Math.round(
    Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : 0,
  );
  const nextHint =
    band.nextLabel && band.pointsToNext > 0
      ? `+${band.pointsToNext}% → ${band.nextLabel}`
      : null;

  return (
    <div className="rounded-xl bg-[#f7faf9] p-3 dark:bg-muted/40">
      <div className="flex items-center gap-2.5">
        <span className="shrink-0 text-lg leading-none" aria-hidden>
          {emoji}
        </span>
        <p className="min-w-0 shrink font-nunito text-[13px] font-extrabold leading-[19.5px] text-[#101828] dark:text-foreground">
          {title}
        </p>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 font-nunito text-[10px] font-extrabold leading-[15px] ${BAND_PILL[band.id]}`}
        >
          {band.label}
        </span>
        <span
          className={`ml-auto shrink-0 font-nunito text-xs font-extrabold leading-[18px] ${BAND_TEXT[band.id]}`}
        >
          {pct}%
        </span>
      </div>

      <div className="mt-2 flex gap-[3px]" aria-hidden>
        {Array.from({ length: 10 }, (_, i) => (
          <span
            key={i}
            className={`h-[5px] flex-1 rounded-full ${
              i < filled ? BAND_TICK[band.id] : "bg-[#e2e8f0] dark:bg-border"
            }`}
          />
        ))}
      </div>

      <div className="mt-1.5 flex items-center justify-between">
        <span className="font-nunito text-[10px] font-bold leading-[15px] text-[#99a1af]">
          {pct}%
        </span>
        <span
          className={`font-nunito text-[10px] font-bold leading-[15px] ${
            nextHint ? BAND_TEXT[band.id] : "text-[#99a1af]"
          }`}
        >
          {nextHint ?? "Mastery reached"}
        </span>
      </div>
    </div>
  );
}

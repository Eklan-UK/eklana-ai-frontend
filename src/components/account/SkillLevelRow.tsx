import type { SkillBandId } from "@/domain/progress/skill-bands";
import { getSkillBand, skillBarTicks } from "@/domain/progress/skill-bands";

const BAND_TICK: Record<SkillBandId, string> = {
  emerging: "bg-red-500",
  developing: "bg-orange-500",
  effective: "bg-blue-500",
  confident: "bg-primary",
  authoritative: "bg-emerald-600",
};

const BAND_PILL: Record<SkillBandId, string> = {
  emerging: "bg-red-500/10 text-red-700 dark:text-red-300",
  developing: "bg-orange-500/10 text-orange-700 dark:text-orange-300",
  effective: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  confident: "bg-primary/10 text-primary",
  authoritative: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
};

export function SkillLevelRow({
  emoji,
  title,
  score,
  nextHint,
}: {
  emoji: string;
  title: string;
  score: number;
  nextHint: string;
}) {
  const band = getSkillBand(score);
  const filled = skillBarTicks(score);
  const pct = Math.round(Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : 0);

  return (
    <div className="py-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg leading-none" aria-hidden>
          {emoji}
        </span>
        <p className="text-sm font-semibold text-foreground flex-1 min-w-0">
          {title}
        </p>
        <span
          className={`text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${BAND_PILL[band.id]}`}
        >
          {band.label}
        </span>
      </div>
      <div className="flex gap-1 mb-1.5" aria-hidden>
        {Array.from({ length: 10 }, (_, i) => (
          <span
            key={i}
            className={`h-2 flex-1 rounded-sm ${
              i < filled ? BAND_TICK[band.id] : "bg-muted"
            }`}
          />
        ))}
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{pct}%</span>
        <span>{nextHint}</span>
      </div>
    </div>
  );
}

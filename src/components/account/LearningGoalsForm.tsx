"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { LEARNING_GOAL_ITEMS } from "@/components/onboarding/LearningGoalCards";

export const LEARNING_GOAL_OPTIONS: ReadonlyArray<{ id: string }> =
  LEARNING_GOAL_ITEMS.map(({ id }) => ({ id }));

interface LearningGoalsFormProps {
  value: string | null;
  onChange: (id: string) => void;
  onSubmit: () => void;
  submitting?: boolean;
  disabled?: boolean;
  submitLabel?: string;
}

export function LearningGoalsForm({
  value,
  onChange,
  onSubmit,
  submitting = false,
  disabled = false,
  submitLabel,
}: LearningGoalsFormProps) {
  const t = useTranslations("settingsGoals");
  const tOptions = useTranslations("settingsGoals.options");
  const ctaLabel = submitLabel ?? t("continue");
  const isSubmitDisabled = disabled || submitting || !value;
  const subheading = t("subheading").trim();

  return (
    <div className="w-full max-w-lg mx-auto px-4 md:max-w-xl md:px-8 py-6 md:py-12">
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-foreground leading-snug tracking-tight">
          {t("heading")}
        </h1>
        {subheading ? (
          <p className="mt-3 text-base text-muted-foreground">{subheading}</p>
        ) : null}
      </div>

      <div
        role="radiogroup"
        aria-label={t("heading")}
        className="flex flex-col gap-4"
      >
        {LEARNING_GOAL_ITEMS.map((goal) => {
          const Icon = goal.Icon;
          const isSelected = value === goal.id;
          return (
            <button
              key={goal.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onChange(goal.id)}
              className={`w-full rounded-3xl bg-white text-left transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500/30 focus-visible:ring-offset-2 p-6 ${
                isSelected
                  ? "border border-green-200 shadow-md shadow-green-100/90"
                  : "border border-gray-100 shadow-sm hover:shadow-md"
              }`}
            >
              <div className="flex items-center gap-4">
                <div
                  className={`w-12 h-12 rounded-xl shrink-0 flex items-center justify-center ${goal.iconBg}`}
                >
                  <Icon className={`w-6 h-6 ${goal.iconColor}`} />
                </div>
                <h3 className="text-base font-semibold text-gray-900 flex-1 min-w-0">
                  {tOptions(goal.id)}
                </h3>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-10">
        <Button
          variant="primary"
          size="lg"
          fullWidth
          disabled={isSubmitDisabled}
          onClick={onSubmit}
        >
          {submitting ? t("saving") : ctaLabel}
        </Button>
      </div>
    </div>
  );
}

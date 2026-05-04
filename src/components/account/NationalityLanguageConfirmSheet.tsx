"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Languages } from "lucide-react";

export type NationalityLanguageConfirmSheetProps = {
  open: boolean;
  displayName: string;
  nationalityLabel: string;
  suggestedLanguage: string;
  currentLanguage: string;
  onSwitch: () => void;
  onKeep: () => void;
  onDismiss: () => void;
};

export function NationalityLanguageConfirmSheet({
  open,
  displayName,
  nationalityLabel,
  suggestedLanguage,
  currentLanguage,
  onSwitch,
  onKeep,
  onDismiss,
}: NationalityLanguageConfirmSheetProps) {
  const t = useTranslations("nationalityLanguageModal");

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col justify-end"
      role="dialog"
      aria-modal="true"
      aria-labelledby="nationality-lang-modal-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        aria-label={t("closeBackdrop")}
        onClick={onDismiss}
      />

      <div className="relative bg-white rounded-t-3xl shadow-xl px-5 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] max-w-md mx-auto w-full md:max-w-lg md:rounded-2xl md:mb-8 md:mx-auto">
        <div className="flex justify-center mb-4">
          <div className="w-14 h-14 rounded-full bg-white border border-gray-100 shadow-sm flex items-center justify-center">
            <Languages className="w-7 h-7 text-green-600" aria-hidden />
          </div>
        </div>

        <p
          id="nationality-lang-modal-title"
          className="text-center text-base text-gray-800 leading-relaxed mb-6 px-1"
        >
          {t("lineStart")}{" "}
          <strong className="font-semibold text-gray-900">{displayName}</strong>{" "}
          {t("lineMid")}{" "}
          <strong className="font-semibold text-gray-900">
            {nationalityLabel}
          </strong>{" "}
          {t("lineEnd", { language: suggestedLanguage })}
        </p>

        <div className="space-y-3">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            type="button"
            onClick={onSwitch}
          >
            {t("switchPrimary", { language: suggestedLanguage })}
          </Button>
          <Button
            variant="outline"
            size="lg"
            fullWidth
            type="button"
            onClick={onKeep}
            className="text-green-700 border-gray-200"
          >
            {t("keepSecondary", { currentLanguage })}
          </Button>
        </div>
      </div>
    </div>
  );
}

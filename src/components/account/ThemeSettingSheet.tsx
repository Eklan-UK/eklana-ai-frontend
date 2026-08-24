"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useTheme } from "next-themes";
import { userAPI } from "@/lib/api";
import { useTranslations } from "next-intl";

type ThemeValue = "system" | "light" | "dark";

interface ThemeSettingSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

const OPTION_EMOJI: Record<ThemeValue, string> = {
  system: "⚙️",
  light: "☀️",
  dark: "🌙",
};

export function ThemeSettingSheet({ isOpen, onClose }: ThemeSettingSheetProps) {
  const { theme, setTheme } = useTheme();
  const t = useTranslations("settingsTheme");
  const [staged, setStaged] = useState<ThemeValue>(
    (theme as ThemeValue) ?? "light"
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setStaged((theme as ThemeValue) ?? "system");
    }
  }, [isOpen, theme]);

  const handleSave = async () => {
    setSaving(true);
    setTheme(staged);
    try {
      await userAPI.updatePreferences({ theme: staged });
    } catch {
      // silent — local theme is already applied
    } finally {
      setSaving(false);
      onClose();
    }
  };

  const options: { value: ThemeValue; labelKey: "system" | "light" | "dark" }[] =
    [
      { value: "system", labelKey: "system" },
      { value: "light", labelKey: "light" },
      { value: "dark", labelKey: "dark" },
    ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60]">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden
      />
      <div className="absolute inset-x-0 bottom-0 flex justify-center pb-[max(5.5rem,calc(4.25rem+env(safe-area-inset-bottom,0px)))]">
        <div
          role="dialog"
          aria-modal
          aria-label={t("pageTitle")}
          className="relative mx-4 mb-2 flex w-full max-w-md flex-col overflow-hidden rounded-[28px] bg-card px-5 pb-10 pt-6 shadow-[0px_-4px_16px_rgba(0,0,0,0.15)]"
        >
          <div className="flex h-8 items-center justify-between">
            <h2 className="font-nunito text-lg font-extrabold leading-[27px] text-[#101828] dark:text-foreground">
              {t("pageTitle")}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="flex size-8 items-center justify-center rounded-full bg-[#f3f4f6] text-[#6a7282] hover:text-[#101828] dark:bg-muted dark:text-muted-foreground"
              aria-label="Close"
            >
              <span className="relative block size-3 overflow-hidden">
                <Image
                  src="/icons/profile/sheet-close.svg"
                  alt=""
                  width={12}
                  height={12}
                  className="size-full"
                  unoptimized
                />
              </span>
            </button>
          </div>

          <p className="mt-1 font-nunito text-[12.5px] font-semibold leading-[18.75px] text-[#99a1af]">
            {t("description")}
          </p>

          <div className="flex gap-3 pb-6 pt-5">
            {options.map(({ value, labelKey }) => {
              const selected = staged === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setStaged(value)}
                  className={`flex h-[51.5px] flex-1 items-center justify-center rounded-[14px] border-2 transition-colors ${
                    selected
                      ? "border-[#3b883e] bg-[#ecffed] dark:border-primary dark:bg-primary/15"
                      : "border-[#f3f4f6] bg-[#f9fafb] dark:border-border dark:bg-muted/40"
                  }`}
                >
                  <span
                    className={`font-nunito text-[13px] font-extrabold leading-[19.5px] ${
                      selected
                        ? "text-[#3b883e] dark:text-primary"
                        : "text-[#6a7282] dark:text-muted-foreground"
                    }`}
                  >
                    {OPTION_EMOJI[value]} {t(labelKey)}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex h-[49px] w-full items-center justify-center rounded-[14px] bg-[#2a602c] font-nunito text-sm font-extrabold text-white disabled:opacity-60 dark:bg-primary"
          >
            {saving ? t("saving") : t("saveSettings")}
          </button>
        </div>
      </div>
    </div>
  );
}

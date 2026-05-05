"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { X, Sun, Moon } from "lucide-react";
import { userAPI } from "@/lib/api";
import { useTranslations } from "next-intl";

type ThemeValue = "system" | "light" | "dark";

interface ThemeSettingSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

function SystemIcon({ selected }: { selected: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
      className={selected ? "text-foreground" : "text-muted-foreground"}
    >
      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 1 A7 7 0 0 1 8 15 Z" fill="currentColor" />
    </svg>
  );
}

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

  const options: { value: ThemeValue; labelKey: "system" | "light" | "dark"; icon: React.ReactNode }[] = [
    {
      value: "system",
      labelKey: "system",
      icon: <SystemIcon selected={staged === "system"} />,
    },
    {
      value: "light",
      labelKey: "light",
      icon: (
        <Sun
          size={16}
          className={staged === "light" ? "text-foreground" : "text-muted-foreground"}
        />
      ),
    },
    {
      value: "dark",
      labelKey: "dark",
      icon: (
        <Moon
          size={16}
          className={staged === "dark" ? "text-foreground" : "text-muted-foreground"}
        />
      ),
    },
  ];

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40"
        onClick={onClose}
        aria-hidden
      />

      {/* Sheet */}
      <div
        role="dialog"
        aria-modal
        aria-label={t("pageTitle")}
        className="fixed bottom-0 left-0 right-0 z-50 max-w-md mx-auto bg-card rounded-t-[32px] shadow-lg px-4 pt-5 pb-6 flex flex-col gap-6"
      >
        {/* Header row */}
        <div className="flex items-center justify-between h-7">
          <span className="text-base font-bold text-foreground">
            {t("pageTitle")}
          </span>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full border border-border text-muted-foreground hover:text-foreground"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>

        {/* Subtitle */}
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-foreground">
            {t("themeColour")}
          </span>
          <span className="text-xs text-muted-foreground">
            {t("description")}
          </span>
        </div>

        {/* Option tiles */}
        <div className="flex gap-2.5">
          {options.map(({ value, labelKey, icon }) => {
            const selected = staged === value;
            return (
              <button
                key={value}
                onClick={() => setStaged(value)}
                className={`flex-1 h-[66px] rounded-2xl flex flex-col justify-between p-2.5 border transition-colors ${
                  selected
                    ? "border-primary bg-primary/5"
                    : "border-border bg-muted/40"
                }`}
              >
                {icon}
                <span
                  className={`text-xs leading-4 font-medium ${
                    selected ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {t(labelKey)}
                </span>
              </button>
            );
          })}
        </div>

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full h-12 rounded-full bg-primary text-white font-medium text-sm disabled:opacity-60"
        >
          {saving ? "Saving…" : t("saveSettings")}
        </button>
      </div>
    </>
  );
}

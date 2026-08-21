"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Header } from "@/components/layout/Header";
import { useUserCurrent } from "@/hooks/useUserCurrent";
import { userAPI } from "@/lib/api";

interface NotificationPreferences {
  learningReminders: boolean;
  specialOffers: boolean;
  subscriptionExpires: boolean;
}

const DEFAULTS: NotificationPreferences = {
  learningReminders: true,
  specialOffers: true,
  subscriptionExpires: true,
};

function Toggle({
  enabled,
  onChange,
  disabled,
  id,
}: {
  enabled: boolean;
  onChange: (val: boolean) => void;
  disabled?: boolean;
  id: string;
}) {
  return (
    <button
      id={id}
      role="switch"
      aria-checked={enabled}
      type="button"
      disabled={disabled}
      onClick={() => onChange(!enabled)}
      className={`relative w-[52px] h-[30px] rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 ${
        enabled ? "bg-green-500" : "bg-muted"
      } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <span
        className={`absolute top-[3px] left-[3px] w-6 h-6 rounded-full bg-white shadow-sm transition-transform duration-200 ${
          enabled ? "translate-x-[22px]" : "translate-x-0"
        }`}
      />
    </button>
  );
}

interface ToggleRowProps {
  label: string;
  value: boolean;
  onChange: (val: boolean) => void;
  saving: boolean;
  id: string;
  last?: boolean;
}

function ToggleRow({ label, value, onChange, saving, id, last }: ToggleRowProps) {
  return (
    <div
      className={`flex items-center justify-between py-4 ${
        last ? "" : "border-b border-border"
      }`}
    >
      <label htmlFor={id} className="text-base text-foreground cursor-pointer select-none">
        {label}
      </label>
      <Toggle id={id} enabled={value} onChange={onChange} disabled={saving} />
    </div>
  );
}

export default function SettingsNotificationsPage() {
  const t = useTranslations("settings");
  const queryClient = useQueryClient();
  const { data: me, isLoading } = useUserCurrent();

  const [prefs, setPrefs] = useState<NotificationPreferences>(DEFAULTS);
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (hydrated || isLoading) return;
    const stored = (me?.profile as { notificationPreferences?: Partial<NotificationPreferences> })
      ?.notificationPreferences;
    setPrefs({
      learningReminders: stored?.learningReminders ?? DEFAULTS.learningReminders,
      specialOffers: stored?.specialOffers ?? DEFAULTS.specialOffers,
      subscriptionExpires: stored?.subscriptionExpires ?? DEFAULTS.subscriptionExpires,
    });
    setHydrated(true);
  }, [hydrated, isLoading, me]);

  const save = async (next: NotificationPreferences) => {
    setSaving(true);
    try {
      await userAPI.updatePreferences({ notificationPreferences: next });
      await queryClient.invalidateQueries({ queryKey: ["user-current"] });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
      // revert
      const stored = (me?.profile as { notificationPreferences?: Partial<NotificationPreferences> })
        ?.notificationPreferences;
      setPrefs({
        learningReminders: stored?.learningReminders ?? DEFAULTS.learningReminders,
        specialOffers: stored?.specialOffers ?? DEFAULTS.specialOffers,
        subscriptionExpires: stored?.subscriptionExpires ?? DEFAULTS.subscriptionExpires,
      });
    } finally {
      setSaving(false);
    }
  };

  const update = (key: keyof NotificationPreferences) => (val: boolean) => {
    const next = { ...prefs, [key]: val };
    setPrefs(next);
    save(next);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="h-6" />
      <Header showBack title={t("notifications")} />

      <div className="max-w-md mx-auto px-5 md:max-w-2xl md:px-8 mt-4">
        <ToggleRow
          id="pref-learning-reminders"
          label={t("learningReminders")}
          value={prefs.learningReminders}
          onChange={update("learningReminders")}
          saving={saving || !hydrated}
        />
        <ToggleRow
          id="pref-special-offers"
          label={t("specialOffers")}
          value={prefs.specialOffers}
          onChange={update("specialOffers")}
          saving={saving || !hydrated}
        />
        <ToggleRow
          id="pref-subscription-expires"
          label={t("subscriptionExpires")}
          value={prefs.subscriptionExpires}
          onChange={update("subscriptionExpires")}
          saving={saving || !hydrated}
          last
        />
      </div>
    </div>
  );
}

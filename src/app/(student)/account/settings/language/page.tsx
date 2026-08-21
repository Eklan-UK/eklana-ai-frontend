"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { useQueryClient } from "@tanstack/react-query";
import { userAPI } from "@/lib/api";
import { toast } from "sonner";
import { APP_INTERFACE_LANGUAGE_NAMES } from "@/lib/nationality-language";
import { SUPPORTED_LOCALES } from "@/i18n/locales";
import { ProfileRadioRow } from "@/components/account/ProfileRadioRow";

export default function LanguagePage() {
  const t = useTranslations("settingsLanguage");
  const tCommon = useTranslations("common");
  const tSettings = useTranslations("settings");

  const queryClient = useQueryClient();
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const languages = APP_INTERFACE_LANGUAGE_NAMES.map((name, i) => ({
    code: SUPPORTED_LOCALES[i],
    name,
  }));

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await userAPI.getCurrent({ cache: false });
        const p = (res as { profile?: { language?: string } }).profile;
        if (mounted) setSelected(p?.language?.trim() || "");
      } catch {
        toast.error(tSettings("loadProfileError"));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [tSettings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await userAPI.updatePreferences({ language: selected });
      await queryClient.invalidateQueries({ queryKey: ["user-current"] });
      toast.success(tSettings("saved"));
    } catch (e: unknown) {
      const msg =
        e instanceof Error && e.message ? e.message : tSettings("saveFailed");
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="h-6" />

      <Header showBack title={t("pageTitle")} />

      <div className="max-w-md mx-auto px-4 py-6 md:max-w-2xl md:px-8">
        <p className="text-base text-muted-foreground mb-6">{t("description")}</p>

        <div className="space-y-2 mb-6">
          {languages.map((language) => (
            <ProfileRadioRow
              key={language.code}
              selected={selected === language.name}
              onSelect={() => setSelected(language.name)}
            >
              <span className="text-base font-medium text-foreground">
                {language.name}
              </span>
            </ProfileRadioRow>
          ))}
        </div>

        <Button
          variant="primary"
          size="lg"
          fullWidth
          disabled={loading || saving || !selected}
          onClick={handleSave}
        >
          {saving ? tCommon("saving") : tCommon("save")}
        </Button>
      </div>
    </div>
  );
}

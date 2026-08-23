"use client";

import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { useQueryClient } from "@tanstack/react-query";
import { userAPI } from "@/lib/api";
import { toast } from "sonner";
import { NATIONALITY_OPTIONS } from "@/lib/nationalities";
import {
  nationalityLabelToAppLanguage,
  shouldOfferLanguageSwitchForNationality,
} from "@/lib/nationality-language";
import { NationalityOptionRow } from "@/components/account/NationalityOptionRow";
import { NationalityLanguageConfirmSheet } from "@/components/account/NationalityLanguageConfirmSheet";
import { ProfileRadioRow } from "@/components/account/ProfileRadioRow";
import { useUserCurrent } from "@/hooks/useUserCurrent";
import { useAuthStore } from "@/store/auth-store";
import { getUserDisplayName } from "@/utils/user";
import { useTranslations } from "next-intl";

export default function NationalityPage() {
  const tSettings = useTranslations("settings");
  const tAccount = useTranslations("account");
  const tCommon = useTranslations("common");

  const queryClient = useQueryClient();
  const { data: me, isLoading: userLoading } = useUserCurrent();
  const profile = me?.profile;
  const { user } = useAuthStore();

  const [selected, setSelected] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [revertSelected, setRevertSelected] = useState<string | null>(null);

  const displayName = getUserDisplayName(user)?.trim() || tAccount("guestName");
  const currentAppLanguage = profile?.language?.trim() || "English";

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await userAPI.getCurrent({ cache: false });
        const p = (res as { profile?: { nationality?: string } }).profile;
        if (mounted) setSelected(p?.nationality?.trim() || "");
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

  const savedNationality = profile?.nationality?.trim() ?? "";
  const suggestedForSelected = nationalityLabelToAppLanguage(selected);

  const persistNationalityOnly = useCallback(
    async (nationality: string) => {
      await userAPI.updatePreferences({ nationality });
      await queryClient.invalidateQueries({ queryKey: ["user-current"] });
      toast.success(tSettings("saved"));
    },
    [queryClient, tSettings]
  );

  const persistNationalityAndLanguage = useCallback(
    async (nationality: string, language: string) => {
      await userAPI.updatePreferences({ nationality, language });
      await queryClient.invalidateQueries({ queryKey: ["user-current"] });
      toast.success(tSettings("saved"));
    },
    [queryClient, tSettings]
  );

  const handlePickNationality = (label: string) => {
    const previousUi = selected;
    setSelected(label);

    if (shouldOfferLanguageSwitchForNationality(label, currentAppLanguage)) {
      setRevertSelected(previousUi);
      setModalOpen(true);
    }
  };

  const closeModal = () => {
    setModalOpen(false);
    if (revertSelected !== null) {
      setSelected(revertSelected);
      setRevertSelected(null);
    }
  };

  const handleModalSwitch = async () => {
    setSaving(true);
    try {
      await persistNationalityAndLanguage(selected, suggestedForSelected);
      setModalOpen(false);
      setRevertSelected(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : tSettings("saveFailed");
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleModalKeep = async () => {
    setSaving(true);
    try {
      await persistNationalityOnly(selected);
      setModalOpen(false);
      setRevertSelected(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : tSettings("saveFailed");
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!selected) return;

    const savedNat = profile?.nationality?.trim() ?? "";
    if (selected === savedNat) {
      toast.success(tSettings("saved"));
      return;
    }

    if (shouldOfferLanguageSwitchForNationality(selected, currentAppLanguage)) {
      setRevertSelected(savedNat);
      setModalOpen(true);
      return;
    }

    setSaving(true);
    try {
      await persistNationalityOnly(selected);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : tSettings("saveFailed");
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const dirty = selected !== savedNationality;
  const saveDisabled =
    loading ||
    saving ||
    userLoading ||
    !selected ||
    !dirty ||
    modalOpen;

  return (
    <div className="min-h-screen bg-background">
      <div className="h-6" />

      <Header showBack title={tSettings("nationality")} />

      <div className="max-w-md mx-auto px-4 py-6 md:max-w-2xl md:px-8">
        <p className="text-base text-muted-foreground mb-6">
          {tSettings("nationalityDescription")}
        </p>

        <div className="space-y-2 mb-6">
          {NATIONALITY_OPTIONS.map((nationality) => (
            <ProfileRadioRow
              key={nationality.id}
              selected={selected === nationality.label}
              onSelect={() => handlePickNationality(nationality.label)}
            >
              <NationalityOptionRow option={nationality} />
            </ProfileRadioRow>
          ))}
        </div>

        <Button
          variant="primary"
          size="lg"
          fullWidth
          disabled={saveDisabled}
          onClick={handleSave}
        >
          {saving ? tCommon("saving") : tCommon("save")}
        </Button>
      </div>

      <NationalityLanguageConfirmSheet
        open={modalOpen}
        displayName={displayName}
        nationalityLabel={selected}
        suggestedLanguage={suggestedForSelected}
        currentLanguage={currentAppLanguage}
        onSwitch={handleModalSwitch}
        onKeep={handleModalKeep}
        onDismiss={closeModal}
      />
    </div>
  );
}

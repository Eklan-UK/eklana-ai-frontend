"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Header } from "@/components/layout/Header";
import {
  LEARNING_GOAL_OPTIONS,
  LearningGoalsForm,
} from "@/components/account/LearningGoalsForm";
import { useUserCurrent } from "@/hooks/useUserCurrent";
import { userAPI } from "@/lib/api";

export default function SettingsGoalsPage() {
  const t = useTranslations("settings");
  const tGoals = useTranslations("settingsGoals");
  const queryClient = useQueryClient();
  const { data: me, isLoading } = useUserCurrent();

  const validIds = useMemo(
    () => new Set(LEARNING_GOAL_OPTIONS.map((o) => o.id)),
    []
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (hydrated || isLoading) return;
    const profile = (me?.profile ?? {}) as {
      learningGoals?: string[] | null;
      learningGoal?: string | null;
    };
    const fromList = profile.learningGoals?.find((id) => validIds.has(id));
    const fromSingle =
      profile.learningGoal && validIds.has(profile.learningGoal)
        ? profile.learningGoal
        : null;
    setSelectedId(fromList ?? fromSingle ?? null);
    setHydrated(true);
  }, [hydrated, isLoading, me, validIds]);

  const handleSave = async () => {
    if (!selectedId) return;
    setSaving(true);
    try {
      await userAPI.updatePreferences({
        learningGoals: [selectedId],
        learningGoal: selectedId,
      });
      await queryClient.invalidateQueries({ queryKey: ["user-current"] });
      toast.success(t("saved"));
    } catch (error: unknown) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : t("saveFailed");
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="h-6" />
      <Header showBack title={t("learningGoals")} />

      <LearningGoalsForm
        value={selectedId}
        onChange={setSelectedId}
        onSubmit={handleSave}
        submitting={saving}
        disabled={!hydrated}
        submitLabel={tGoals("continue")}
      />
    </div>
  );
}

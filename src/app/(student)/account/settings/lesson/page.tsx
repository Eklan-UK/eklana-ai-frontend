"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronRight, X } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { useUserCurrent } from "@/hooks/useUserCurrent";
import { userAPI } from "@/lib/api";
import {
  ACCENT_VOICE_OPTIONS,
  DEFAULT_ENGLISH_ACCENT,
  normalizeEnglishAccent,
} from "@/services/tts-accent-voices";

// ─── Option lists ──────────────────────────────────────────────────────────────

const ACCENT_FLAGS: Record<string, string> = {
  aanu_afolabi: "🇳🇬",
  american_male: "🇺🇸",
  american_female: "🇺🇸",
  british_male: "🇬🇧",
  british_female: "🇬🇧",
  australian_male: "🇦🇺",
  australian_female: "🇦🇺",
};

const ACCENT_OPTIONS = ACCENT_VOICE_OPTIONS.map((opt) => ({
  id: opt.key,
  label: opt.label,
  flag: ACCENT_FLAGS[opt.key] ?? "",
  display: opt.label,
}));

const VOICE_OPTIONS = [
  { id: "eklan_confident", label: "eklan Confident" },
  { id: "warm", label: "Warm" },
  { id: "calm", label: "Calm" },
  { id: "friendly", label: "Friendly" },
  { id: "relaxed", label: "Relaxed" },
];

const SPEED_OPTIONS = [
  { id: "normal", label: "1x Normal (Recommended)", display: "Normal" },
  { id: "slow", label: "0.5x Slower", display: "Slow" },
  { id: "slightly_slow", label: "0.75x Slightly slower than normal", display: "0.75x" },
];

// ─── Defaults ──────────────────────────────────────────────────────────────────

interface LessonPrefs {
  eklanTalks: boolean;
  chatTranslation: boolean;
  englishAccent: string;
  voiceTone: string;
  speakingSpeed: string;
}

const DEFAULTS: LessonPrefs = {
  eklanTalks: true,
  chatTranslation: false,
  englishAccent: DEFAULT_ENGLISH_ACCENT,
  voiceTone: "warm",
  speakingSpeed: "normal",
};

// ─── Toggle ────────────────────────────────────────────────────────────────────

function Toggle({
  enabled,
  onChange,
  disabled,
}: {
  enabled: boolean;
  onChange: (val: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      role="switch"
      aria-checked={enabled}
      type="button"
      disabled={disabled}
      onClick={() => onChange(!enabled)}
      className={`relative h-5 w-[33px] rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 shrink-0 ${
        enabled ? "bg-[#4caf50]" : "bg-[rgba(120,120,128,0.16)]"
      } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <span
        className={`absolute top-[6.5%] h-[17.4px] w-[17.4px] rounded-full bg-white shadow-[0px_2px_5px_rgba(0,0,0,0.15)] transition-all duration-200 ${
          enabled ? "right-[1.3px]" : "left-[1.3px]"
        }`}
      />
    </button>
  );
}

// ─── Separator ─────────────────────────────────────────────────────────────────

function Separator() {
  return <div className="h-px w-full bg-border" />;
}

// ─── Setting row (toggle variant) ──────────────────────────────────────────────

function ToggleRow({
  label,
  enabled,
  onChange,
  disabled,
}: {
  label: string;
  enabled: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Toggle enabled={enabled} onChange={onChange} disabled={disabled} />
      </div>
      <Separator />
    </div>
  );
}

// ─── Setting row (navigation variant) ─────────────────────────────────────────

function NavRow({
  label,
  value,
  onClick,
}: {
  label: string;
  value: string;
  onClick: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={onClick}
        className="flex items-center justify-between w-full text-left"
      >
        <span className="text-sm text-foreground">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{value}</span>
          <ChevronRight className="w-4 h-4 text-muted-foreground" strokeWidth={1.8} />
        </div>
      </button>
      <Separator />
    </div>
  );
}

// ─── Bottom Sheet ──────────────────────────────────────────────────────────────

function BottomSheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      {/* Overlay */}
      <div
        ref={overlayRef}
        className="absolute inset-0 bg-[rgba(45,50,56,0.8)]"
        onClick={onClose}
        aria-hidden
      />
      {/* Sheet */}
      <div className="relative z-10 w-full bg-card rounded-t-[32px] border border-border shadow-[0px_4px_6px_-1px_rgba(18,18,23,0.08),0px_2px_4px_-1px_rgba(18,18,23,0.06)] pb-6 pt-5 px-4 max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 pr-1">
          <h2 className="text-base font-bold text-foreground leading-6">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Selection Card ────────────────────────────────────────────────────────────

function SelectionCard({
  label,
  prefix,
  selected,
  onClick,
}: {
  label: string;
  prefix?: React.ReactNode;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left p-4 rounded-2xl flex items-center gap-2 transition-all ${
        selected
          ? "border border-[rgba(76,175,80,0.5)] bg-card [box-shadow:0px_4px_0px_rgba(52,199,89,0.1)]"
          : "border border-border bg-card [box-shadow:0px_4px_0px_rgba(231,234,237,0.5)]"
      }`}
    >
      {prefix && <span className="text-xl leading-none shrink-0">{prefix}</span>}
      <span className="text-sm font-medium text-foreground">{label}</span>
    </button>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

type Sheet = "accent" | "voice" | "speed" | null;

export default function LessonSettingsPage() {
  const queryClient = useQueryClient();
  const { data: me, isLoading } = useUserCurrent();

  const [prefs, setPrefs] = useState<LessonPrefs>(DEFAULTS);
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeSheet, setActiveSheet] = useState<Sheet>(null);

  useEffect(() => {
    if (hydrated || isLoading) return;
    const stored = (
      me?.profile as { lessonPreferences?: Partial<LessonPrefs> } | undefined
    )?.lessonPreferences;
    setPrefs({
      eklanTalks: stored?.eklanTalks ?? DEFAULTS.eklanTalks,
      chatTranslation: stored?.chatTranslation ?? DEFAULTS.chatTranslation,
      englishAccent:
        normalizeEnglishAccent(stored?.englishAccent) ?? DEFAULTS.englishAccent,
      voiceTone: stored?.voiceTone ?? DEFAULTS.voiceTone,
      speakingSpeed: stored?.speakingSpeed ?? DEFAULTS.speakingSpeed,
    });
    setHydrated(true);
  }, [hydrated, isLoading, me]);

  const persist = async (patch: Partial<LessonPrefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    setSaving(true);
    try {
      await userAPI.updatePreferences({ lessonPreferences: next });
      await queryClient.invalidateQueries({ queryKey: ["user-current"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
      // revert
      setPrefs(prefs);
    } finally {
      setSaving(false);
    }
  };

  // ── Display helpers ──────────────────────────────────────────────────────────

  const accentDisplay =
    ACCENT_OPTIONS.find((o) => o.id === prefs.englishAccent)?.display ??
    ACCENT_OPTIONS[0].display;

  const voiceDisplay =
    VOICE_OPTIONS.find((o) => o.id === prefs.voiceTone)?.label ??
    VOICE_OPTIONS[1].label;

  const speedDisplay =
    SPEED_OPTIONS.find((o) => o.id === prefs.speakingSpeed)?.display ??
    SPEED_OPTIONS[0].display;

  return (
    <div className="min-h-screen bg-background">
      <div className="h-6" />
      <Header showBack title="Lesson" />

      <div className="max-w-md mx-auto px-5 md:max-w-2xl md:px-8 mt-6 flex flex-col gap-[22px]">
        <ToggleRow
          label="eklan talks"
          enabled={prefs.eklanTalks}
          onChange={(v) => persist({ eklanTalks: v })}
          disabled={saving || !hydrated}
        />
        <ToggleRow
          label="Chat translation"
          enabled={prefs.chatTranslation}
          onChange={(v) => persist({ chatTranslation: v })}
          disabled={saving || !hydrated}
        />
        <NavRow
          label="English type / accent"
          value={accentDisplay}
          onClick={() => setActiveSheet("accent")}
        />
        <NavRow
          label="eklan's voice"
          value={voiceDisplay}
          onClick={() => setActiveSheet("voice")}
        />
        <NavRow
          label="Speaking speed"
          value={speedDisplay}
          onClick={() => setActiveSheet("speed")}
        />
      </div>

      {/* ── English type / accent sheet ─────────────────────────────────── */}
      <BottomSheet
        open={activeSheet === "accent"}
        title="English type / accent"
        onClose={() => setActiveSheet(null)}
      >
        <div className="flex flex-col gap-4">
          {ACCENT_OPTIONS.map((opt) => (
            <SelectionCard
              key={opt.id}
              label={opt.label}
              prefix={opt.flag}
              selected={prefs.englishAccent === opt.id}
              onClick={() => {
                persist({ englishAccent: opt.id });
                setActiveSheet(null);
              }}
            />
          ))}
        </div>
      </BottomSheet>

      {/* ── eklan's voices sheet ────────────────────────────────────────── */}
      <BottomSheet
        open={activeSheet === "voice"}
        title="eklan's voices"
        onClose={() => setActiveSheet(null)}
      >
        <div className="flex flex-col gap-4">
          {VOICE_OPTIONS.map((opt) => (
            <SelectionCard
              key={opt.id}
              label={opt.label}
              selected={prefs.voiceTone === opt.id}
              onClick={() => {
                persist({ voiceTone: opt.id });
                setActiveSheet(null);
              }}
            />
          ))}
        </div>
      </BottomSheet>

      {/* ── Speaking speed sheet ────────────────────────────────────────── */}
      <BottomSheet
        open={activeSheet === "speed"}
        title="Speaking speed"
        onClose={() => setActiveSheet(null)}
      >
        <div className="flex flex-col gap-4">
          {SPEED_OPTIONS.map((opt) => (
            <SelectionCard
              key={opt.id}
              label={opt.label}
              selected={prefs.speakingSpeed === opt.id}
              onClick={() => {
                persist({ speakingSpeed: opt.id });
                setActiveSheet(null);
              }}
            />
          ))}
        </div>
      </BottomSheet>
    </div>
  );
}

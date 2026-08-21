"use client";

import { useEffect, useState } from "react";
import { Star, X } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useUserCurrent } from "@/hooks/useUserCurrent";
import { getUserDisplayName } from "@/utils/user";

function StarButton({
  filled,
  onClick,
  label,
}: {
  filled: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button type="button" onClick={onClick} aria-label={label}>
      <Star
        className={`w-9 h-9 ${
          filled ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/40"
        }`}
        strokeWidth={1.5}
      />
    </button>
  );
}

interface FeedbackSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export function FeedbackSheet({ isOpen, onClose }: FeedbackSheetProps) {
  const t = useTranslations("feedbackSheet");
  const { data: me } = useUserCurrent();
  const displayName = getUserDisplayName(me?.user);

  const [rating, setRating] = useState(0);
  const [feedbackName, setFeedbackName] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFeedbackName(displayName || "");
      setRating(0);
      setFeedbackMessage("");
    }
  }, [isOpen, displayName]);

  if (!isOpen) return null;

  const firstName = feedbackName.trim().split(" ")[0];
  const title = firstName
    ? t("titleNamed", { name: firstName })
    : t("title");
  const canSubmit = rating >= 1;

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: feedbackName,
          rating,
          message: feedbackMessage,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || t("failed"));
      toast.success(t("thanks"));
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t("failed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 flex justify-center pb-[max(5.5rem,calc(4.25rem+env(safe-area-inset-bottom,0px)))]">
        <div
          role="dialog"
          aria-modal
          aria-label={t("title")}
          className="relative bg-card rounded-[32px] w-full max-w-md overflow-hidden shadow-xl px-5 pt-5 pb-8 flex flex-col gap-6 mx-4 mb-2"
        >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full border border-border text-muted-foreground hover:text-foreground"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>

        <div className="flex flex-col items-center gap-3">
          <p className="text-sm text-muted-foreground text-center">
            {t("subtitle")}
          </p>
          <div className="flex gap-3">
            {[1, 2, 3, 4, 5].map((n) => (
              <StarButton
                key={n}
                filled={n <= rating}
                onClick={() => setRating(n)}
                label={`${n}`}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-sm text-muted-foreground">{t("name")}</label>
            <div className="bg-muted border border-border rounded-xl p-3">
              <input
                type="text"
                value={feedbackName}
                onChange={(e) => setFeedbackName(e.target.value)}
                placeholder={t("name")}
                className="w-full bg-transparent text-base text-foreground outline-none"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm text-muted-foreground">
              {t("message")}
            </label>
            <div className="bg-muted border border-border rounded-xl p-3 h-[104px]">
              <textarea
                value={feedbackMessage}
                onChange={(e) => setFeedbackMessage(e.target.value)}
                placeholder={t("messagePlaceholder")}
                className="w-full h-full bg-transparent text-sm text-foreground outline-none resize-none placeholder:text-muted-foreground"
              />
            </div>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">{t("disclaimer")}</p>
        <button
          type="button"
          disabled={!canSubmit || submitting}
          onClick={handleSubmit}
          className="w-full py-4 rounded-full text-base font-semibold text-center transition-colors bg-primary text-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? t("submitting") : t("submit")}
        </button>
        </div>
      </div>
    </div>
  );
}

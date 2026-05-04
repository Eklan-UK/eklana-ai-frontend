"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Star } from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/layout/Header";
import { useUserCurrent } from "@/hooks/useUserCurrent";

function SettingsRow({
  label,
  onClick,
  last,
}: {
  label: string;
  onClick: () => void;
  last?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={onClick}
        className="flex items-center justify-between w-full py-1 text-left"
      >
        <span className="text-sm text-[#333]">{label}</span>
        <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
      </button>
      {!last && <div className="h-px w-full bg-gray-100" />}
    </div>
  );
}

function StarButton({
  filled,
  onClick,
}: {
  filled: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} aria-label="star">
      <Star
        className={`w-9 h-9 ${filled ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`}
        strokeWidth={1.5}
      />
    </button>
  );
}

export default function HelpFeedbackPage() {
  const router = useRouter();
  const { data: me } = useUserCurrent();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [feedbackName, setFeedbackName] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const userName =
    (me?.profile as { firstName?: string; lastName?: string } | undefined)
      ?.firstName ||
    (me?.user as { name?: string } | undefined)?.name ||
    "";

  const openSheet = () => {
    setFeedbackName(userName);
    setRating(0);
    setFeedbackMessage("");
    setSheetOpen(true);
  };

  const closeSheet = () => setSheetOpen(false);

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
      if (!res.ok) throw new Error(json.message || "Failed to submit");
      toast.success("Thank you for your feedback!");
      closeSheet();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="h-6" />
      <Header showBack title="Help & feedback" />

      <div className="max-w-md mx-auto px-5 mt-4 md:max-w-2xl md:px-8">
        <div className="flex flex-col gap-4">
          <SettingsRow
            label="Frequently Asked Questions"
            onClick={() => router.push("/account/settings/faq")}
          />
          <SettingsRow
            label="Contact Us"
            onClick={() => router.push("/account/settings/contact")}
          />
          <SettingsRow
            label="Feedback"
            onClick={openSheet}
            last
          />
        </div>
      </div>

      {/* Feedback bottom-sheet */}
      {sheetOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          {/* Scrim */}
          <div
            className="absolute inset-0 bg-[rgba(45,50,56,0.8)]"
            onClick={closeSheet}
          />

          {/* Sheet */}
          <div className="relative bg-white rounded-t-[26px] w-full max-w-md mx-auto overflow-hidden shadow-xl">
            {/* Decorative wave background */}
            <div className="absolute inset-x-0 top-0 h-28 overflow-hidden pointer-events-none">
              <div
                className="absolute w-[500px] h-[135px] opacity-30"
                style={{
                  background:
                    "linear-gradient(135deg, #a8e6a3 0%, #d4f5d0 50%, transparent 100%)",
                  top: -80,
                  left: -60,
                  transform: "rotate(-31.62deg)",
                }}
              />
              <div
                className="absolute w-[350px] h-[135px] opacity-30"
                style={{
                  background:
                    "linear-gradient(135deg, #a8e6a3 0%, #d4f5d0 50%, transparent 100%)",
                  top: -100,
                  right: -60,
                  transform: "rotate(31.61deg)",
                }}
              />
            </div>

            <div className="relative px-5 pt-10 pb-8 flex flex-col gap-8">
              {/* Heading block */}
              <div className="flex flex-col items-center gap-4">
                <div className="flex flex-col items-center gap-4 w-[234px] text-center">
                  <div>
                    <p className="text-xl font-bold text-[#1b1b1b] leading-[34px] whitespace-nowrap">
                      {feedbackName
                        ? `How is it going, ${feedbackName.split(" ")[0]}?`
                        : "How is it going?"}
                    </p>
                    <p className="text-sm text-[#8e8e8e] mt-1">
                      Enjoying your experience with{" "}
                      <span className="font-bold text-[#3b883e]">eklan</span>
                      <span className="font-bold text-[#3b883e]">?</span>{" "}
                      give us a rating
                    </p>
                  </div>
                  {/* Stars */}
                  <div className="flex gap-3">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <StarButton
                        key={n}
                        filled={n <= rating}
                        onClick={() => setRating(n)}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Input fields */}
              <div className="flex flex-col gap-10">
                <div className="flex flex-col gap-2.5">
                  {/* Name field */}
                  <div className="flex flex-col gap-1">
                    <label className="text-sm text-[#777]">Name</label>
                    <div className="bg-[#fcfcfc] border border-[rgba(231,234,237,0.5)] rounded-xl p-3">
                      <input
                        type="text"
                        value={feedbackName}
                        onChange={(e) => setFeedbackName(e.target.value)}
                        placeholder="Your name"
                        className="w-full bg-transparent text-base text-[#171717] outline-none"
                      />
                    </div>
                  </div>

                  {/* Message field */}
                  <div className="flex flex-col gap-1">
                    <label className="text-sm text-[#777]">
                      Tell us what you want us to improve
                    </label>
                    <div className="bg-[rgba(252,252,252,0.36)] border border-[#e7eaed] rounded-xl p-3 h-[104px]">
                      <textarea
                        value={feedbackMessage}
                        onChange={(e) => setFeedbackMessage(e.target.value)}
                        placeholder="Tell us how we can improve your experience..."
                        className="w-full h-full bg-transparent text-sm text-[#171717] outline-none resize-none placeholder:text-[#d2d2d2]"
                      />
                    </div>
                  </div>
                </div>

                {/* Bottom CTA */}
                <div className="flex flex-col gap-4">
                  <p className="text-sm text-[#a4a4a4]">
                    Your feedback helps us improve and serve you better.
                  </p>
                  <button
                    type="button"
                    disabled={!canSubmit || submitting}
                    onClick={handleSubmit}
                    className={`w-full py-4 rounded-[50px] text-base font-medium text-center transition-colors ${
                      canSubmit
                        ? "bg-[#fbd100] text-[#171717]"
                        : "bg-[#e8e8e8] text-[#fafafa] cursor-not-allowed"
                    }`}
                  >
                    {submitting ? "Submitting…" : "Submit feedback"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

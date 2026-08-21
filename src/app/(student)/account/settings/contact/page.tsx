"use client";

import { useEffect, useState } from "react";
import { User, Mail } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Header } from "@/components/layout/Header";
import { useUserCurrent } from "@/hooks/useUserCurrent";

const MAX_MESSAGE_LENGTH = 500;

function InputField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

export default function ContactUsPage() {
  const t = useTranslations("settings");
  const { data: me } = useUserCurrent();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!me) return;
    const profile = me.profile as
      | { firstName?: string; lastName?: string }
      | undefined;
    const user = me.user as { name?: string; email?: string } | undefined;

    if (!name) {
      const fullName =
        profile?.firstName
          ? `${profile.firstName}${profile.lastName ? ` ${profile.lastName}` : ""}`
          : user?.name || "";
      setName(fullName);
    }
    if (!email) {
      setEmail(user?.email || "");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me]);

  const canSubmit =
    name.trim().length > 0 &&
    email.trim().length > 0 &&
    subject.trim().length > 0 &&
    message.trim().length > 0 &&
    message.length <= MAX_MESSAGE_LENGTH;

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, subject, message }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to send message");
      toast.success("Message sent! We'll get back to you soon.");
      setSubject("");
      setMessage("");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="h-6" />
      <Header showBack title={t("contact")} />

      <div className="max-w-md mx-auto w-full px-5 py-4 md:max-w-2xl md:px-8 flex flex-col gap-5 flex-1">
        <InputField label="Name">
          <div className="bg-muted border border-border rounded-xl p-3 flex items-center gap-2">
            <User className="w-5 h-5 text-muted-foreground shrink-0" />
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="flex-1 bg-transparent text-base text-foreground outline-none min-w-0"
            />
          </div>
        </InputField>

        <InputField label="Email">
          <div className="bg-muted border border-border rounded-xl p-3 flex items-center gap-2">
            <Mail className="w-5 h-5 text-muted-foreground shrink-0" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="flex-1 bg-transparent text-base text-foreground outline-none min-w-0"
            />
          </div>
        </InputField>

        <InputField label="Subject">
          <div className="bg-muted border border-border rounded-xl p-3 flex items-center">
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="What's this about?"
              className="w-full bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>
        </InputField>

        <InputField label="Your message">
          <div className="bg-muted border border-border rounded-xl p-3 min-h-[180px]">
            <textarea
              value={message}
              onChange={(e) => {
                if (e.target.value.length <= MAX_MESSAGE_LENGTH) {
                  setMessage(e.target.value);
                }
              }}
              placeholder="Tell us how we can help…"
              className="w-full h-[160px] bg-transparent text-base text-foreground outline-none resize-none placeholder:text-muted-foreground"
            />
          </div>
          <p
            className={`text-xs text-right mt-1 ${
              message.length > MAX_MESSAGE_LENGTH
                ? "text-destructive"
                : "text-muted-foreground"
            }`}
          >
            {message.length}/{MAX_MESSAGE_LENGTH}
          </p>
        </InputField>

        <div className="pt-2 pb-8 mt-auto">
          <button
            type="button"
            disabled={!canSubmit || submitting}
            onClick={handleSubmit}
            className="w-full bg-primary text-white py-4 rounded-full text-base font-medium disabled:opacity-50 transition-opacity"
          >
            {submitting ? "Sending…" : "Submit"}
          </button>
        </div>
      </div>
    </div>
  );
}

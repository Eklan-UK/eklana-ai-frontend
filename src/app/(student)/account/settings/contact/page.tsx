"use client";

import { useEffect, useState } from "react";
import { User, Mail } from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/layout/Header";
import { useUserCurrent } from "@/hooks/useUserCurrent";

function InputField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm text-foreground">{label}</label>
      {children}
    </div>
  );
}

export default function ContactUsPage() {
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

  const canSubmit = subject.trim().length > 0 && message.trim().length > 0;

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
    <div className="min-h-screen bg-background">
      <div className="h-6" />
      <Header showBack title="Contact Us" />

      <div className="max-w-md mx-auto px-5 py-6 md:max-w-2xl md:px-8 flex flex-col gap-8">
        {/* Form fields */}
        <div className="flex flex-col gap-4">
          {/* Name + Email row */}
          <div className="flex flex-col gap-4">
            <InputField label="Name">
              <div className="bg-muted border border-border rounded-xl p-3 flex items-center gap-2">
                <User className="w-6 h-6 text-muted-foreground shrink-0" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="flex-1 bg-transparent text-base text-foreground outline-none"
                />
              </div>
            </InputField>

            <InputField label="Email">
              <div className="bg-muted border border-border rounded-xl p-3 flex items-center gap-2">
                <Mail className="w-6 h-6 text-muted-foreground shrink-0" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="flex-1 bg-transparent text-base text-foreground outline-none"
                />
              </div>
            </InputField>
          </div>

          {/* Subject + Message */}
          <div className="flex flex-col gap-4">
            <InputField label="Subject">
              <div className="bg-muted border border-border rounded-xl p-3 h-12 flex items-center">
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="What's this about?"
                  className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                />
              </div>
            </InputField>

            <InputField label="Your message">
              <div className="bg-muted border border-border rounded-xl p-3 h-[193px]">
                <textarea
                  value={message}
                  onChange={(e) => {
                    if (e.target.value.length <= 500) setMessage(e.target.value);
                  }}
                  placeholder="Message (max 500 characters)"
                  className="w-full h-full bg-transparent text-sm text-foreground outline-none resize-none placeholder:text-muted-foreground"
                />
              </div>
              {message.length > 0 && (
                <p className="text-xs text-muted-foreground text-right mt-1">
                  {message.length}/500
                </p>
              )}
            </InputField>
          </div>
        </div>

        {/* Submit button */}
        <button
          type="button"
          disabled={!canSubmit || submitting}
          onClick={handleSubmit}
          className={`w-full py-4 rounded-[50px] text-base font-medium text-center transition-colors ${
            canSubmit
              ? "bg-[#3b883e] text-[#fafafa]"
              : "bg-[#e8e8e8] text-[#fafafa] cursor-not-allowed"
          }`}
        >
          {submitting ? "Sending…" : "Submit"}
        </button>
      </div>
    </div>
  );
}

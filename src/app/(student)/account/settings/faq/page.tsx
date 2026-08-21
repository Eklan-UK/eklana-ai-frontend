"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Plus, Minus } from "lucide-react";
import { Header } from "@/components/layout/Header";

interface FAQItem {
  question: string;
  answer: React.ReactNode;
}

const faqs: FAQItem[] = [
  {
    question: "What is eklan AI?",
    answer:
      "Eklan AI is an English learning platform that uses artificial intelligence to help you improve your speaking, pronunciation, and overall communication skills through personalised practice sessions and real-time feedback.",
  },
  {
    question: "Who can use eklan?",
    answer: (
      <div className="text-sm text-muted-foreground leading-5">
        <p className="mb-1 text-foreground">Eklan is built for:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Learners of all ages above 16</li>
          <li>Professionals who want clearer communication</li>
          <li>
            Students preparing for interviews, presentations, IELTS/TOEFL
            speaking
          </li>
          <li>
            Anyone who wants to sound more natural and confident in English
          </li>
        </ul>
      </div>
    ),
  },
  {
    question: "How does eklan improve my pronunciation?",
    answer:
      "Eklan uses AI-powered speech analysis to identify pronunciation patterns and provide instant feedback. You'll practise with interactive exercises and receive targeted suggestions to help you sound clearer and more natural.",
  },
  {
    question: "What makes eklan different from other English learning apps?",
    answer:
      "Eklan focuses specifically on spoken English and pronunciation, using AI technology to give you real-time feedback that's personalised to your accent and learning goals — not a one-size-fits-all approach.",
  },
  {
    question: "Do I need to be fluent in English to use eklan?",
    answer:
      "Not at all. Eklan is designed for learners at all levels. Whether you're a beginner or looking to polish your advanced speaking skills, eklan adapts to where you are.",
  },
  {
    question: "Does Eklan work on mobile and web?",
    answer:
      "Yes! Eklan works on iOS and Android mobile devices, as well as modern web browsers, so you can practise wherever and whenever suits you.",
  },
  {
    question: "Do I need a subscription to use Eklan?",
    answer:
      "Eklan offers a free tier with access to core features. A premium subscription unlocks advanced lessons, unlimited AI practice, and more personalised feedback tools.",
  },
  {
    question: "How do I start a lesson?",
    answer:
      "Once you've completed onboarding and set your learning goals, simply navigate to the home screen and tap on any available lesson or daily drill to get started.",
  },
  {
    question: "Can the AI understand different accents?",
    answer:
      "Yes, eklan's AI is trained on a wide variety of accents and adapts its feedback accordingly, so you'll receive relevant guidance regardless of your native language background.",
  },
  {
    question: "Does Eklan store my voice recordings?",
    answer:
      "Voice recordings are processed in real time to provide feedback. Please refer to our Privacy Policy for full details on how your data is handled and stored.",
  },
  {
    question: "Is my data safe?",
    answer:
      "Absolutely. We take data privacy seriously. All your personal information and recordings are encrypted and stored securely in accordance with applicable data protection regulations.",
  },
];

function AccordionItem({
  number,
  item,
  isOpen,
  onToggle,
  last,
}: {
  number: number;
  item: FAQItem;
  isOpen: boolean;
  onToggle: () => void;
  last?: boolean;
}) {
  return (
    <div
      className={`py-1 ${last ? "" : "border-b border-border"}`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex items-start justify-between gap-3 w-full py-3.5 text-left"
      >
        <span className="text-base font-semibold text-foreground leading-5 flex-1">
          {number}. {item.question}
        </span>
        {isOpen ? (
          <Minus className="w-5 h-5 text-primary shrink-0 mt-0.5" aria-hidden />
        ) : (
          <Plus className="w-5 h-5 text-primary shrink-0 mt-0.5" aria-hidden />
        )}
      </button>

      {isOpen ? (
        <div className="pb-4 pr-8">
          {typeof item.answer === "string" ? (
            <p className="text-sm text-muted-foreground leading-6">
              {item.answer}
            </p>
          ) : (
            item.answer
          )}
        </div>
      ) : null}
    </div>
  );
}

export default function FAQPage() {
  const t = useTranslations("settings");
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggle = (i: number) => setOpenIndex(openIndex === i ? null : i);

  return (
    <div className="min-h-screen bg-background">
      <div className="h-6" />
      <Header showBack title={t("faq")} />

      <div className="max-w-md mx-auto px-5 py-4 md:max-w-2xl md:px-8">
        <p className="text-sm text-muted-foreground leading-5 mb-6">
          We&apos;ve answered some of the questions you might have. Can&apos;t
          find what you&apos;re looking for?{" "}
          <Link
            href="/account/settings/contact"
            className="text-primary font-medium underline-offset-2 hover:underline"
          >
            {t("contact")}
          </Link>{" "}
          or email{" "}
          <a
            href="mailto:support@eklanAI.com"
            className="text-primary font-medium underline-offset-2 hover:underline"
          >
            support@eklanAI.com
          </a>
          .
        </p>

        <div className="flex flex-col">
          {faqs.map((faq, i) => (
            <AccordionItem
              key={i}
              number={i + 1}
              item={faq}
              isOpen={openIndex === i}
              onToggle={() => toggle(i)}
              last={i === faqs.length - 1}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

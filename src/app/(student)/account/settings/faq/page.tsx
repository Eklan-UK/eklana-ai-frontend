"use client";

import { useState } from "react";
import { Plus, Minus } from "lucide-react";
import { Header } from "@/components/layout/Header";

interface FAQItem {
  question: string;
  answer: React.ReactNode;
}

const faqs: FAQItem[] = [
  {
    question: "1. What is eklan AI?",
    answer:
      "Eklan AI is an English learning platform that uses artificial intelligence to help you improve your speaking, pronunciation, and overall communication skills through personalised practice sessions and real-time feedback.",
  },
  {
    question: "2. Who can use eklan?",
    answer: (
      <div className="text-sm text-[#333] leading-5">
        <p className="mb-1">Eklan is built for:</p>
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
    question: "3. How does eklan improve my pronunciation?",
    answer:
      "Eklan uses AI-powered speech analysis to identify pronunciation patterns and provide instant feedback. You'll practise with interactive exercises and receive targeted suggestions to help you sound clearer and more natural.",
  },
  {
    question: "4. What makes eklan different from other English learning apps?",
    answer:
      "Eklan focuses specifically on spoken English and pronunciation, using AI technology to give you real-time feedback that's personalised to your accent and learning goals — not a one-size-fits-all approach.",
  },
  {
    question: "5. Do I need to be fluent in English to use eklan?",
    answer:
      "Not at all. Eklan is designed for learners at all levels. Whether you're a beginner or looking to polish your advanced speaking skills, eklan adapts to where you are.",
  },
  {
    question: "6. Does Eklan work on mobile and web?",
    answer:
      "Yes! Eklan works on iOS and Android mobile devices, as well as modern web browsers, so you can practise wherever and whenever suits you.",
  },
  {
    question: "7. Do I need a subscription to use Eklan?",
    answer:
      "Eklan offers a free tier with access to core features. A premium subscription unlocks advanced lessons, unlimited AI practice, and more personalised feedback tools.",
  },
  {
    question: "8. How do I start a lesson?",
    answer:
      "Once you've completed onboarding and set your learning goals, simply navigate to the home screen and tap on any available lesson or daily drill to get started.",
  },
  {
    question: "9. Can the AI understand different accents?",
    answer:
      "Yes, eklan's AI is trained on a wide variety of accents and adapts its feedback accordingly, so you'll receive relevant guidance regardless of your native language background.",
  },
  {
    question: "10. Does Eklan store my voice recordings?",
    answer:
      "Voice recordings are processed in real time to provide feedback. Please refer to our Privacy Policy for full details on how your data is handled and stored.",
  },
  {
    question: "11. Is my data safe?",
    answer:
      "Absolutely. We take data privacy seriously. All your personal information and recordings are encrypted and stored securely in accordance with applicable data protection regulations.",
  },
];

function AccordionItem({
  item,
  isOpen,
  onToggle,
  last,
}: {
  item: FAQItem;
  isOpen: boolean;
  onToggle: () => void;
  last?: boolean;
}) {
  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={onToggle}
        className={`flex items-start justify-between gap-3 w-full p-3 rounded-lg border text-left transition-colors ${
          isOpen
            ? "border-t border-[rgba(231,234,237,0.5)] border-b-0 border-x-0 rounded-b-none"
            : "border border-[rgba(231,234,237,0.5)]"
        }`}
      >
        <span className="text-sm font-bold text-[#171717] leading-5 flex-1">
          {item.question}
        </span>
        {isOpen ? (
          <Minus className="w-4 h-4 text-[#3b883e] shrink-0 mt-0.5" />
        ) : (
          <Plus className="w-4 h-4 text-[#3b883e] shrink-0 mt-0.5" />
        )}
      </button>

      {isOpen && (
        <div className="px-3 pb-3 pt-2 flex gap-2 border border-t-0 border-[rgba(231,234,237,0.5)] rounded-b-lg">
          <div className="text-sm text-[#333] leading-5 flex-1">
            {typeof item.answer === "string" ? (
              <p>{item.answer}</p>
            ) : (
              item.answer
            )}
          </div>
        </div>
      )}

      {!last && !isOpen && <div className="h-1" />}
    </div>
  );
}

export default function FAQPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = (i: number) => setOpenIndex(openIndex === i ? null : i);

  return (
    <div className="min-h-screen bg-white">
      <div className="h-6" />
      <Header showBack title="Frequently Asked Questions" />

      <div className="max-w-md mx-auto px-5 py-6 md:max-w-2xl md:px-8">
        {/* Heading */}
        <div className="flex flex-col gap-4 mb-4">
          <h2 className="text-xl font-bold text-[#171717] tracking-tight">
            FAQs
          </h2>
          <p className="text-sm text-black leading-5">
            We&apos;ve answered some of the questions you might have. Can&apos;t
            find what you&apos;re looking for? Reach out anytime at{" "}
            <a
              href="mailto:support@eklanAI.com"
              className="text-[#175eb6] underline"
            >
              support@eklanAI.com
            </a>{" "}
            we&apos;re here to help!
          </p>
        </div>

        {/* Accordion */}
        <div className="flex flex-col gap-1">
          {faqs.map((faq, i) => (
            <AccordionItem
              key={i}
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

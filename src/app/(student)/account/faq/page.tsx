"use client";

import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";

interface FAQItemProps {
  question: string;
  answer: string;
  isOpen: boolean;
  onToggle: () => void;
}

const FAQItem: React.FC<FAQItemProps> = ({
  question,
  answer,
  isOpen,
  onToggle,
}) => {
  return (
    <Card className="mb-4">
      <button
        onClick={onToggle}
        className="w-full text-left flex items-center justify-between"
      >
        <h3 className="text-base font-semibold text-gray-900 pr-4">
          {question}
        </h3>
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`transform transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        >
          <path
            d="M6 9L12 15L18 9"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {isOpen && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-sm text-gray-600 leading-relaxed">{answer}</p>
        </div>
      )}
    </Card>
  );
};

export default function FAQPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      question: "How does eklan AI work?",
      answer:
        "eklan AI uses advanced speech recognition and AI technology to help you practice English speaking. You'll engage in conversations, practice pronunciation, and receive personalized feedback to improve your skills.",
    },
    {
      question: "Is eklan AI free to use?",
      answer:
        "Yes! We offer a free tier with access to basic features. You can upgrade to premium for advanced features, unlimited practice, and personalized learning paths.",
    },
    {
      question: "What devices are supported?",
      answer:
        "eklan AI works on iOS and Android mobile devices, as well as web browsers. You can practice anywhere, anytime!",
    },
    {
      question: "How do I track my progress?",
      answer:
        "Your progress is tracked automatically. You can view your confidence scores, pronunciation improvements, and learning streaks in your profile dashboard.",
    },
    {
      question: "Can I practice offline?",
      answer:
        "Some features are available offline, but for the best experience including AI feedback and voice recognition, an internet connection is recommended.",
    },
    {
      question: "How do I cancel my subscription?",
      answer:
        "You can cancel your subscription anytime from the Settings page. Your access will continue until the end of your current billing period.",
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Status Bar Space */}
      <div className="h-6"></div>

      <Header showBack title="Frequently Asked Questions" />

      <div className="max-w-md mx-auto px-4 py-6 md:max-w-2xl md:px-8">
        <div className="mb-6">
          <p className="text-base text-gray-600">
            Find answers to common questions about eklan AI
          </p>
        </div>

        <div>
          {faqs.map((faq, index) => (
            <FAQItem
              key={index}
              question={faq.question}
              answer={faq.answer}
              isOpen={openIndex === index}
              onToggle={() => setOpenIndex(openIndex === index ? null : index)}
            />
          ))}
        </div>

        <Card className="bg-green-50 border-green-200 mt-6">
          <div className="text-center py-4">
            <p className="text-sm font-semibold text-gray-900 mb-2">
              Still have questions?
            </p>
            <a
              href="/contact"
              className="text-sm text-green-600 font-medium underline inline-flex items-center gap-1"
            >
              Contact our support team
            </a>
          </div>
        </Card>
      </div>
    </div>
  );
}


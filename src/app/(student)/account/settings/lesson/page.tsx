"use client";

import { useState } from "react";
import { Header } from "@/components/layout/Header";
import Link from "next/link";

interface SettingRowProps {
  label: string;
  value?: string;
  href?: string;
  toggle?: boolean;
  toggleValue?: boolean;
  onToggle?: (value: boolean) => void;
}

const SettingRow: React.FC<SettingRowProps> = ({
  label,
  value,
  href,
  toggle,
  toggleValue,
  onToggle,
}) => {
  const content = (
    <div className="flex items-center justify-between py-4 border-b border-gray-100">
      <span className="text-base font-medium text-gray-900">{label}</span>
      <div className="flex items-center gap-3">
        {toggle !== undefined ? (
          <button
            onClick={() => onToggle?.(!toggleValue)}
            className={`relative w-12 h-6 rounded-full transition-colors ${
              toggleValue ? "bg-green-600" : "bg-gray-300"
            }`}
          >
            <div
              className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                toggleValue ? "translate-x-6" : "translate-x-0"
              }`}
            />
          </button>
        ) : (
          <>
            {value && (
              <span className="text-sm text-gray-500">{value}</span>
            )}
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M7.5 5L12.5 10L7.5 15"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </>
        )}
      </div>
    </div>
  );

  if (href && toggle === undefined) {
    return (
      <Link href={href} className="block">
        {content}
      </Link>
    );
  }

  return <div className="block">{content}</div>;
};

export default function LessonSettingsPage() {
  const [eklanTalks, setEklanTalks] = useState(true);
  const [chatTranslation, setChatTranslation] = useState(false);

  return (
    <div className="min-h-screen bg-white">
      {/* Status Bar Space */}
      <div className="h-6"></div>

      <Header showBack title="Lesson" />

      <div className="max-w-md mx-auto px-4 py-6 md:max-w-2xl md:px-8">
        <SettingRow
          label="eklan talks"
          toggle
          toggleValue={eklanTalks}
          onToggle={setEklanTalks}
        />
        <SettingRow
          label="Chat translation"
          toggle
          toggleValue={chatTranslation}
          onToggle={setChatTranslation}
        />
        <SettingRow label="English type / accent" value="British" href="/settings/lesson/accent" />
        <SettingRow label="eklan's voice" value="Warm" href="/settings/lesson/voice" />
        <SettingRow label="Speaking speed" value="Normal" href="/settings/lesson/speed" />
      </div>
    </div>
  );
}


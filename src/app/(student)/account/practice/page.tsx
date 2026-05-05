"use client";

import { BottomNav } from "@/components/layout/BottomNav";
import { Header } from "@/components/layout/Header";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
function PracticeCard({
  href,
  iconBg,
  iconSrc,
  title,
  subtitle,
  meta,
  iconWidth = 24,
  iconHeight = 24,
  iconImageClassName = "brightness-0 invert",
}: {
  href: string;
  iconBg: string;
  iconSrc: string;
  title: string;
  subtitle: string;
  meta: string[];
  iconWidth?: number;
  iconHeight?: number;
  iconImageClassName?: string;
}) {
  return (
    <Link href={href}>
      <div className="bg-card border border-border rounded-2xl p-4 mb-3 flex items-center gap-4 hover:shadow-md transition-shadow active:scale-[0.98] transition-transform cursor-pointer">
        <div
          className={`w-12 h-12 ${iconBg} rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden`}
        >
          <Image
            src={iconSrc}
            alt={title}
            width={iconWidth}
            height={iconHeight}
            className={iconImageClassName}
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-base font-bold font-nunito text-foreground mb-0.5">{title}</p>
          <p className="text-sm font-satoshi text-muted-foreground mb-1 leading-snug">{subtitle}</p>
          <div className="flex items-center gap-3">
            {meta.map((m, i) => (
              <span key={i} className="text-xs font-satoshi text-muted-foreground">
                {m}
              </span>
            ))}
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
      </div>
    </Link>
  );
}

export default function PracticePage() {
  return (
    <div className="min-h-screen bg-background pb-[max(5.5rem,env(safe-area-inset-bottom,0px))]">
      <div className="h-6" />
      <Header title="Practice" />

      <div className="max-w-md mx-auto px-4 py-6 md:max-w-2xl md:px-8">

        {/* ── Practice Freely Section ── */}
        <div className="mb-8">
          <h2 className="text-xl font-bold font-nunito text-foreground mb-4">Choose your mode of practice</h2>

          <PracticeCard
            href="/account/practice/ai"
            iconBg="bg-[#3B883E]"
            iconSrc="/icons/logo-yellow.svg"
            title="Eklan Free Talk"
            subtitle="Speak about anything"
            meta={[""]}
          />
        </div>

        {/* ── Pressure Test Card ── */}
        <div className="mb-8">
          <PracticeCard
            href="/account/practice/ai/pressure-test"
            iconBg="bg-[#2A602C]"
            iconSrc="/Pressure_test_logo.svg"
            title="Eklan Pressure Test"
            subtitle="Test your response speed in a real-life scenario."
            meta={[]}
            iconWidth={40}
            iconHeight={38}
            iconImageClassName=""
          />
        </div>
      </div>
      <BottomNav />
    </div>
  );
}

"use client";

import { BottomNav } from "@/components/layout/BottomNav";
import { Header } from "@/components/layout/Header";
import { ChevronRight, Lock } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useUserCurrent } from "@/hooks/useUserCurrent";
import { ProLockHoverWrap } from "@/components/subscription/ProLockHoverWrap";
import { ProLockedCtaSwap } from "@/components/subscription/ProLockedCtaSwap";

function PracticeCard({
  href,
  iconBg,
  iconSrc,
  title,
  subtitle,
  meta,
  locked = false,
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
  locked?: boolean;
  iconWidth?: number;
  iconHeight?: number;
  iconImageClassName?: string;
}) {
  const inner = (
    <div
      className={`bg-card border border-border rounded-2xl p-4 mb-3 flex items-center gap-4 transition-shadow transition-transform ${
        locked
          ? "opacity-60 cursor-not-allowed"
          : "hover:shadow-md active:scale-[0.98] cursor-pointer"
      }`}
    >
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
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-base font-bold font-nunito text-foreground">{title}</p>
          {locked && (
            <span className="inline-block bg-orange-100 text-orange-800 text-[10px] font-semibold px-2 py-0.5 rounded-full leading-none">
              Pro
            </span>
          )}
        </div>
        <p className="text-sm font-satoshi text-muted-foreground mb-1 leading-snug">{subtitle}</p>
        <div className="flex items-center gap-3">
          {meta.map((m, i) => (
            <span key={i} className="text-xs font-satoshi text-muted-foreground">
              {m}
            </span>
          ))}
        </div>
      </div>
      {locked ? (
        <ProLockedCtaSwap density="compact">
          <span
            className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl border border-border bg-muted text-muted-foreground pointer-events-none flex-shrink-0"
            aria-hidden
          >
            <Lock className="w-4 h-4 sm:w-5 sm:h-5" />
          </span>
        </ProLockedCtaSwap>
      ) : (
        <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
      )}
    </div>
  );

  if (locked) {
    return (
      <ProLockHoverWrap className="block">
        <div aria-disabled="true">{inner}</div>
      </ProLockHoverWrap>
    );
  }

  return <Link href={href}>{inner}</Link>;
}

export default function PracticePage() {
  const { data: me, isLoading } = useUserCurrent();
  // Default locked while loading to prevent flash of unlocked state.
  const isSubscribed = !isLoading && me?.user?.isSubscribed === true;

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
            locked={!isSubscribed}
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
            locked={!isSubscribed}
          />
        </div>

        {!isSubscribed && !isLoading && (
          <p className="text-sm text-muted-foreground text-center -mt-4">
            <Link
              href="/account/settings/subscriptions"
              className="text-green-600 font-semibold hover:underline"
            >
              Upgrade to Pro
            </Link>{" "}
            to unlock AI practice features.
          </p>
        )}
      </div>
      <BottomNav />
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Check, Crown, Zap, CreditCard, Receipt, Ban, Loader2 } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import { ProfileMenuRow } from "@/components/account/ProfileMenuRow";
import { ProfileMenuSection } from "@/components/account/ProfileMenuSection";
import { useUserCurrent } from "@/hooks/useUserCurrent";
import { planTitleFromUser, getPlanCardMessage } from "@/lib/learner-learning-goals";
import { toast } from "sonner";

const FREE_FEATURES = [
  "Basic pronunciation practice",
  "Progress tracking",
  "Limited daily activity",
];

const PRO_FEATURES = [
  "Eklan Simulation Room — unlimited AI conversation practice sessions",
  "Full access to all current and future AI-powered features",
  "AI-driven feedback and scoring on every session",
  "Personalised difficulty that adapts as you improve",
];

async function createCheckoutSession(): Promise<string> {
  const res = await fetch("/api/v1/stripe/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.message || "Request failed");
  }
  const data = await res.json();
  if (!data.url) throw new Error("No redirect URL returned");
  return data.url;
}

async function openBillingPortal(): Promise<string> {
  const res = await fetch("/api/v1/stripe/portal", { method: "POST" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.message || "Request failed");
  }
  const data = await res.json();
  if (!data.url) throw new Error("No redirect URL returned");
  return data.url;
}

export default function SubscriptionsPage() {
  const t = useTranslations("settings");
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { data: me, isLoading: userLoading } = useUserCurrent();

  const user = me?.user;
  const isSubscribed: boolean = user?.isSubscribed === true;
  const planTitle = planTitleFromUser(user);
  const planMessage = getPlanCardMessage(isSubscribed);

  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (searchParams.get("checkout") !== "success") return;

    router.replace("/account/settings/subscriptions");

    queryClient.invalidateQueries({ queryKey: ["user-current"] });

    let attempts = 0;
    const MAX_ATTEMPTS = 5;

    pollingRef.current = setInterval(async () => {
      attempts += 1;
      const fresh = await queryClient.fetchQuery({
        queryKey: ["user-current"],
        queryFn: () =>
          fetch("/api/v1/users/current").then((r) => r.json()),
        staleTime: 0,
      });

      if (fresh?.user?.isSubscribed) {
        clearInterval(pollingRef.current!);
        toast.success("Welcome to Pro! AI features are now unlocked.");
        return;
      }

      if (attempts >= MAX_ATTEMPTS) {
        clearInterval(pollingRef.current!);
        toast.info(
          "Your payment is confirmed. Access will activate shortly — refresh if it doesn't appear in a minute."
        );
      }
    }, 2000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleUpgrade() {
    setCheckoutLoading(true);
    try {
      const url = await createCheckoutSession();
      window.location.href = url;
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Could not start checkout. Please try again or contact support.";
      toast.error(msg);
      setCheckoutLoading(false);
    }
  }

  async function handleManage() {
    setPortalLoading(true);
    try {
      const url = await openBillingPortal();
      window.location.href = url;
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Could not open billing portal. Please try again.";
      toast.error(msg);
      setPortalLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background pb-[max(5.5rem,env(safe-area-inset-bottom,0px))]">
      <div className="h-6" />
      <Header
        showBack
        title={t("subscriptions")}
        backHref="/account/profile"
      />

      <div className="max-w-md mx-auto px-5 py-4 md:max-w-2xl md:px-8">
        <p className="text-sm text-muted-foreground mb-5">
          Manage your Eklan Pro plan
        </p>

        {/* Current plan */}
        <div
          className={`rounded-2xl border px-4 py-4 mb-6 ${
            isSubscribed
              ? "bg-primary/10 border-primary/30"
              : "bg-muted/50 border-border"
          }`}
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("currentPlan")}
          </p>
          <p
            className={`text-2xl font-bold mt-1 ${
              isSubscribed ? "text-primary" : "text-foreground"
            }`}
          >
            {userLoading ? "—" : planTitle}
          </p>
          <p className="text-sm text-muted-foreground mt-2 leading-5">
            {planMessage}
          </p>
        </div>

        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 px-1">
          {t("planOverview")}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div
            className={`rounded-2xl border p-4 ${
              !isSubscribed
                ? "border-primary bg-primary/5"
                : "border-border bg-muted/30"
            }`}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="size-10 rounded-[10px] flex items-center justify-center bg-muted">
                <Zap className="size-5 text-muted-foreground" />
              </div>
              <h3 className="text-base font-bold text-foreground">Free</h3>
            </div>
            <ul className="space-y-2">
              {FREE_FEATURES.map((feature) => (
                <li key={feature} className="flex items-start gap-2">
                  <Check className="size-4 mt-0.5 shrink-0 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          <div
            className={`rounded-2xl border p-4 ${
              isSubscribed
                ? "border-primary bg-primary/5"
                : "border-primary/60 bg-primary/5"
            }`}
          >
            <div className="flex items-center gap-3 mb-1">
              <div className="size-10 rounded-[10px] flex items-center justify-center bg-primary/15">
                <Crown className="size-5 text-primary" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">Pro</h3>
                <p className="text-xs text-muted-foreground">
                  US$1.99 / month
                </p>
              </div>
            </div>
            <ul className="space-y-2 mt-3">
              {PRO_FEATURES.map((feature) => (
                <li key={feature} className="flex items-start gap-2">
                  <Check className="size-4 mt-0.5 shrink-0 text-primary" />
                  <span className="text-sm text-muted-foreground">{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {isSubscribed ? (
          <ProfileMenuSection>
            <ProfileMenuRow
              icon={CreditCard}
              title={t("managePayment")}
              onClick={() => {
                if (!portalLoading) void handleManage();
              }}
              trailing={
                portalLoading ? (
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                ) : undefined
              }
            />
            <ProfileMenuRow
              icon={Receipt}
              title={t("billingHistory")}
              onClick={() => {
                if (!portalLoading) void handleManage();
              }}
            />
            <ProfileMenuRow
              icon={Ban}
              title={t("cancelSubscription")}
              onClick={() => {
                if (!portalLoading) void handleManage();
              }}
              last
            />
          </ProfileMenuSection>
        ) : (
          <button
            type="button"
            onClick={handleUpgrade}
            disabled={checkoutLoading || userLoading}
            className="w-full flex items-center justify-center gap-2 bg-primary text-white font-medium rounded-full py-4 text-base disabled:opacity-50 transition-opacity"
            aria-label="Upgrade to Pro"
          >
            {checkoutLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : null}
            {checkoutLoading ? "Preparing checkout…" : "Upgrade to Pro"}
          </button>
        )}

        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground mb-2">
            Questions about subscriptions?
          </p>
          <Link
            href="/account/settings/contact"
            className="text-sm text-primary font-semibold"
          >
            {t("contact")}
          </Link>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}

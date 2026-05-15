"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import { Card } from "@/components/ui/Card";
import { Check, Crown, Zap, Calendar, Loader2 } from "lucide-react";
import { useUserCurrent } from "@/hooks/useUserCurrent";
import { planTitleFromUser, getPlanCardMessage } from "@/lib/learner-learning-goals";
import { toast } from "sonner";

// ── Plan data ─────────────────────────────────────────────────────────────────

const FREE_FEATURES = [
  "Basic pronunciation practice",
  "Progress tracking",
  "Limited daily activity",
];

const PRO_FEATURES = [
  "Eklan Free Talk — unlimited AI conversation practice sessions",
  "Eklan Pressure Test — timed, high-pressure AI speaking drills",
  "Full access to all current and future AI-powered features",
  "AI-driven feedback and scoring on every session",
  "Personalised difficulty that adapts as you improve",
];

// ── Helpers ───────────────────────────────────────────────────────────────────

async function callStripeEndpoint(path: string): Promise<string> {
  const res = await fetch(path, { method: "POST" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.message || "Request failed");
  }
  const data = await res.json();
  if (!data.url) throw new Error("No redirect URL returned");
  return data.url;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SubscriptionsPage() {
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

  // ── Handle ?checkout=success param ──────────────────────────────────────────
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (searchParams.get("checkout") !== "success") return;

    // Strip the param from the URL immediately to avoid re-triggering on refresh.
    router.replace("/account/settings/subscriptions");

    // Invalidate cache and start polling until subscribed = true (max 10 s).
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

  // ── CTA handlers ─────────────────────────────────────────────────────────────

  async function handleUpgrade() {
    setCheckoutLoading(true);
    try {
      const url = await callStripeEndpoint("/api/v1/stripe/checkout");
      window.location.href = url;
    } catch (err: any) {
      toast.error(
        err?.message || "Could not start checkout. Please try again or contact support."
      );
      setCheckoutLoading(false);
    }
  }

  async function handleManage() {
    setPortalLoading(true);
    try {
      const url = await callStripeEndpoint("/api/v1/stripe/portal");
      window.location.href = url;
    } catch (err: any) {
      toast.error(err?.message || "Could not open billing portal. Please try again.");
      setPortalLoading(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background pb-[max(5.5rem,env(safe-area-inset-bottom,0px))]">
      <div className="h-6" />
      <Header
        showBack
        title="Subscriptions"
        backHref="/account/profile"
      />

      <div className="max-w-md mx-auto px-4 py-6 md:max-w-2xl md:px-8">

        {/* Current plan summary card */}
        <Card className="mb-6 bg-primary/10 border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground mb-1">Current plan</p>
              <p className="text-2xl font-bold text-green-600">
                {userLoading ? "—" : planTitle}
              </p>
              <p className="text-sm text-muted-foreground mt-2 max-w-sm">{planMessage}</p>
            </div>
            <Calendar className="w-5 h-5 text-green-600 flex-shrink-0" />
          </div>
        </Card>

        {/* Plan overview */}
        <div className="mb-6">
          <h2 className="text-xl font-bold text-foreground mb-4">Plan overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Free plan */}
            <Card
              className={`relative ${!isSubscribed ? "ring-2 ring-green-600 bg-green-500/10" : ""}`}
            >
              {!isSubscribed && (
                <div className="absolute -top-3 right-3 bg-green-600 text-white px-3 py-1 rounded-full text-xs font-semibold">
                  Current
                </div>
              )}
              <div className="pt-4 pb-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-muted">
                    <Zap className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-bold text-foreground">Free</h3>
                </div>
                <ul className="space-y-2">
                  {FREE_FEATURES.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check className="w-5 h-5 mt-0.5 flex-shrink-0 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Card>

            {/* Pro plan */}
            <Card
              className={`relative ${isSubscribed ? "ring-2 ring-green-600 bg-green-500/10" : "border-2 border-green-600"}`}
            >
              {!isSubscribed && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-600 text-white px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap">
                  Unlock AI features
                </div>
              )}
              {isSubscribed && (
                <div className="absolute -top-3 right-3 bg-green-600 text-white px-3 py-1 rounded-full text-xs font-semibold">
                  Current
                </div>
              )}
              <div className="pt-6 pb-4">
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-green-500/15">
                    <Crown className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-foreground">Pro</h3>
                    <p className="text-xs text-muted-foreground">Unlock the full AI experience</p>
                  </div>
                </div>
                <ul className="space-y-2 mb-5 mt-4">
                  {PRO_FEATURES.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check className="w-5 h-5 mt-0.5 flex-shrink-0 text-green-600" />
                      <span className="text-sm text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA button */}
                {isSubscribed ? (
                  <button
                    onClick={handleManage}
                    disabled={portalLoading}
                    className="w-full flex items-center justify-center gap-2 border border-green-600 text-green-600 font-semibold rounded-lg py-2.5 px-4 text-sm hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    aria-label="Manage your Pro subscription"
                  >
                    {portalLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                    {portalLoading ? "Opening portal…" : "Manage subscription"}
                  </button>
                ) : (
                  <button
                    onClick={handleUpgrade}
                    disabled={checkoutLoading || userLoading}
                    className="w-full flex items-center justify-center gap-2 bg-green-600 text-white font-semibold rounded-lg py-2.5 px-4 text-sm hover:bg-green-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    aria-label="Upgrade to Pro to access AI features"
                  >
                    {checkoutLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                    {checkoutLoading ? "Preparing checkout…" : "Upgrade to Pro"}
                  </button>
                )}
              </div>
            </Card>

          </div>
        </div>

        {/* Support link */}
        <Card className="bg-muted/50 border-border">
          <div className="text-center py-4">
            <p className="text-sm font-semibold text-foreground mb-2">
              Questions about subscriptions?
            </p>
            <a
              href="/contact"
              className="text-sm text-green-600 font-medium underline"
            >
              Contact our support team
            </a>
          </div>
        </Card>

      </div>

      <BottomNav />
    </div>
  );
}

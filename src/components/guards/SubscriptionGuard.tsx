"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useUserCurrent } from "@/hooks/useUserCurrent";

/**
 * `usePathname()` follows the URL bar. Short aliases are rewritten (next.config)
 * but the browser still shows `/home`, `/practice`, etc. — normalize before allowlist checks.
 */
function subscriptionGuardPathname(pathname: string | null): string {
  if (!pathname) return "";
  if (pathname === "/home") return "/account";
  if (pathname.startsWith("/home/")) {
    return `/account${pathname.slice("/home".length)}`;
  }
  if (pathname === "/practice") return "/account/practice";
  if (pathname.startsWith("/practice/")) {
    return `/account/practice${pathname.slice("/practice".length)}`;
  }
  return pathname;
}

/**
 * Paths that are always accessible regardless of subscription status.
 * All other /account/* routes require an active Pro subscription.
 */
const SUBSCRIPTION_FREE_ROUTES = [
  "/account/onboarding",
  "/account/welcome",
  "/account/settings/subscriptions",
  "/account/settings/terms",
  "/account/settings/privacy",
  "/account/settings/contact",
  "/account/settings/faq",
  "/account/settings/help",
  "/account/settings",
  "/account/profile",
  "/account/payment",
  "/account/faq",
  "/account/practice", // practice hub + sub-routes (free tier sees locked cards)
  "/account",  // home dashboard (shows upsell)
];

/**
 * Redirects free-plan users away from Pro-gated routes to the subscriptions
 * page. Runs once the current-user query resolves so there is no loading flash.
 * Routes in SUBSCRIPTION_FREE_ROUTES are always allowed.
 */
export function SubscriptionGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: me, isLoading } = useUserCurrent();

  useEffect(() => {
    if (isLoading) return;
    if (!me?.user) return;

    const path = subscriptionGuardPathname(pathname);

    // Allow routes that should be accessible on any plan
    const isFreeRoute = SUBSCRIPTION_FREE_ROUTES.some(
      (route) =>
        path === route ||
        // Exact match for "/account" but allow sub-paths via startsWith for
        // routes that have their own deeper pages (e.g. /account/settings/*)
        (route !== "/account" && path.startsWith(route))
    );
    if (isFreeRoute) return;

    if (me.user.isSubscribed !== true) {
      router.replace("/account/settings/subscriptions");
    }
  }, [isLoading, me, pathname, router]);

  return <>{children}</>;
}

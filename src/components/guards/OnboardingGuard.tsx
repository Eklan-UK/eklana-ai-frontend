"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";
import {
  checkAuthFlowStatus,
  getCachedProfileStatus,
} from "@/utils/auth-flow";
import { Loader2 } from "lucide-react";

interface OnboardingGuardProps {
  children: React.ReactNode;
}

/**
 * Route guard that checks if learner profile exists
 * Redirects to onboarding if user is a learner without a profile
 * Uses cached profile status for faster loads
 */
export function OnboardingGuard({ children }: OnboardingGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const {
    user,
    isAuthenticated,
    isLoading: authLoading,
    hasHydrated,
  } = useAuthStore();
  const [isChecking, setIsChecking] = useState(true);
  const [isAllowed, setIsAllowed] = useState(false);

  // Routes that don't require onboarding check
  const publicRoutes = [
    "/auth/login",
    "/auth/register",
    "/auth/forgot-password",
    "/auth/reset-password",
    "/auth/verify-email",
    "/account/onboarding",
  ];

  useEffect(() => {
    const checkOnboarding = async () => {
      // Allow public routes
      if (publicRoutes.some((route) => pathname?.startsWith(route))) {
        setIsAllowed(true);
        setIsChecking(false);
        return;
      }

      // Wait for localStorage hydration and auth to load
      if (!hasHydrated || authLoading) {
        return;
      }

      // If not authenticated, allow (auth will handle redirect)
      if (!isAuthenticated || !user) {
        setIsAllowed(true);
        setIsChecking(false);
        return;
      }

      // Normalize role
      const userRole = user.role === "learner" ? "user" : user.role;

      // Admins and tutors don't need onboarding
      if (userRole === "admin" || userRole === "tutor") {
        setIsAllowed(true);
        setIsChecking(false);
        return;
      }

      // FAST PATH: Check cached profile status first (no API call)
      const cachedHasProfile = getCachedProfileStatus();
      if (cachedHasProfile === true) {
        // User has profile - allow immediately
        setIsAllowed(true);
        setIsChecking(false);
        return;
      }

      // If cached value says no profile, redirect to onboarding immediately
      if (cachedHasProfile === false) {
        if (pathname !== "/account/onboarding") {
          router.push("/account/onboarding");
        }
        setIsAllowed(false);
        setIsChecking(false);
        return;
      }

      // SLOW PATH: No cached value, need to check API
      try {
        const normalizedUser = {
          ...user,
          role: userRole,
        };

        const status = await checkAuthFlowStatus(normalizedUser);

        if (status.shouldOnboard) {
          if (pathname !== "/account/onboarding") {
            router.push("/account/onboarding");
          }
          setIsAllowed(false);
        } else {
          setIsAllowed(true);
        }
      } catch (error: any) {
        if (
          error?.message?.includes("Forbidden") ||
          error?.code === "Forbidden"
        ) {
          console.warn("Forbidden error, redirecting to onboarding:", error);
          if (pathname !== "/account/onboarding") {
            router.push("/account/onboarding");
          }
          setIsAllowed(false);
        } else {
          // On other errors, allow access (don't block user)
          console.error("Error checking onboarding status:", error);
          setIsAllowed(true);
        }
      } finally {
        setIsChecking(false);
      }
    };

    checkOnboarding();
  }, [isAuthenticated, user, authLoading, hasHydrated, pathname, router]);

  // Show loading only if hydrating or still checking (but not if cached)
  if (!hasHydrated || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-green-600 mx-auto mb-4" />
          <p className="text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  // If we have cached profile status, don't show loading
  if (isChecking) {
    const cachedHasProfile = getCachedProfileStatus();
    if (cachedHasProfile === true) {
      // Show content immediately since we know user has profile
      return <>{children}</>;
    }
    // Still checking and no cached data
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-green-600 mx-auto mb-4" />
          <p className="text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  // Only render children if allowed
  if (!isAllowed && pathname !== "/account/onboarding") {
    return null; // Will redirect
  }

  return <>{children}</>;
}

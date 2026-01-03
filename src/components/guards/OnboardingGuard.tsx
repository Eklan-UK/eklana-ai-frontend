"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";
import { checkAuthFlowStatus, getAuthRedirectPath } from "@/utils/auth-flow";
import { Loader2 } from "lucide-react";

interface OnboardingGuardProps {
  children: React.ReactNode;
}

/**
 * Route guard that checks if learner profile exists
 * Redirects to onboarding if user is a learner without a profile
 */
export function OnboardingGuard({ children }: OnboardingGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, isLoading: authLoading } = useAuthStore();
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

      // Wait for auth to load
      if (authLoading) {
        return;
      }

      // If not authenticated, allow (auth will handle redirect)
      if (!isAuthenticated || !user) {
        setIsAllowed(true);
        setIsChecking(false);
        return;
      }

      // Check verification and onboarding status
      try {
        const status = await checkAuthFlowStatus(user);
        
        // If verification is needed, that should be handled by VerificationGuard
        // Here we only check onboarding
        if (status.shouldOnboard) {
          // No onboarding, redirect to onboarding
          if (pathname !== "/account/onboarding") {
            router.push("/account/onboarding");
          }
          setIsAllowed(false);
        } else {
          // Onboarding complete (or not needed for non-learners), allow access
          setIsAllowed(true);
        }
      } catch (error) {
        // On error, allow access (don't block user)
        console.error("Error checking onboarding status:", error);
        setIsAllowed(true);
      } finally {
        setIsChecking(false);
      }
    };

    checkOnboarding();
  }, [isAuthenticated, user, authLoading, pathname, router]);

  // Show loading state while checking
  if (isChecking || authLoading) {
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



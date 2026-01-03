"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";
import { checkAuthFlowStatus, getAuthRedirectPath } from "@/utils/auth-flow";
import { Loader2 } from "lucide-react";

interface VerificationGuardProps {
  children: React.ReactNode;
}

/**
 * Route guard that checks if user's email is verified
 * Redirects to verification page if not verified (except OAuth users)
 */
export function VerificationGuard({ children }: VerificationGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, isLoading: authLoading } = useAuthStore();
  const [isChecking, setIsChecking] = useState(true);
  const [isAllowed, setIsAllowed] = useState(false);

  // Routes that don't require verification check
  const publicRoutes = [
    "/auth/login",
    "/auth/register",
    "/auth/forgot-password",
    "/auth/reset-password",
    "/auth/verify-email",
    "/account/onboarding", // Allow onboarding even if not verified
  ];

  useEffect(() => {
    const checkVerification = async () => {
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

      // Check verification status
      try {
        const status = await checkAuthFlowStatus(user);
        
        // OAuth users are auto-verified, so allow them
        if (status.isVerified || !status.shouldVerify) {
          setIsAllowed(true);
        } else {
          // Not verified, redirect to verification page
          if (pathname !== "/auth/verify-email") {
            router.push("/auth/verify-email");
          }
          setIsAllowed(false);
        }
      } catch (error) {
        // On error, allow access (don't block user)
        console.error("Error checking verification status:", error);
        setIsAllowed(true);
      } finally {
        setIsChecking(false);
      }
    };

    checkVerification();
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
  if (!isAllowed && pathname !== "/auth/verify-email") {
    return null; // Will redirect
  }

  return <>{children}</>;
}


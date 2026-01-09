"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";
import { Loader2 } from "lucide-react";

interface AuthGuardProps {
  children: React.ReactNode;
  allowedRoles?: ('admin' | 'user' | 'tutor')[];
  requireAuth?: boolean;
}

/**
 * Route guard that checks authentication and optionally role
 * Use this for client components that need auth protection
 */
export function AuthGuard({ 
  children, 
  allowedRoles,
  requireAuth = true 
}: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, session, isAuthenticated, isLoading: authLoading, hasHydrated } = useAuthStore();
  const [isChecking, setIsChecking] = useState(true);

  // Check if we have cached auth data (from localStorage)
  const hasCachedAuth = !!(user && session);

  // Public routes that don't require authentication
  const publicRoutes = [
    "/",
    "/welcome",
    "/splash",
    "/auth/login",
    "/auth/register",
    "/auth/forgot-password",
    "/auth/reset-password",
    "/auth/verify-email",
    "/auth/callback",
    "/terms",
    "/privacy",
    "/contact",
    "/landing",
  ];

  useEffect(() => {
    const checkAuth = async () => {
      // Allow public routes
      if (publicRoutes.some((route) => pathname?.startsWith(route))) {
        setIsChecking(false);
        return;
      }

      // Wait for localStorage hydration before checking authentication
      if (!hasHydrated) {
        return;
      }

      // If still loading AND we have cached auth, trust the cache
      if (authLoading && hasCachedAuth) {
        setIsChecking(false);
        return;
      }

      // If still loading with no cached auth, wait
      if (authLoading) {
        return;
      }

      // Check if authentication is required
      // Only redirect to login if we're definitely not authenticated AND no cached session
      if (requireAuth && !isAuthenticated && !hasCachedAuth) {
        router.push("/auth/login");
        return;
      }

      // If auth is required and user exists, check role
      if (requireAuth && user && allowedRoles) {
        const userRole = user.role || 'user';
        
        if (!allowedRoles.includes(userRole as 'admin' | 'user' | 'tutor')) {
          // Redirect based on role
          if (userRole === 'admin') {
            router.push("/admin/dashboard");
          } else if (userRole === 'tutor') {
            router.push("/tutor/dashboard");
          } else {
            router.push("/account");
          }
          return;
        }
      }

      setIsChecking(false);
    };

    checkAuth();
  }, [isAuthenticated, user, session, authLoading, hasHydrated, pathname, router, allowedRoles, requireAuth, hasCachedAuth]);

  // Show loading state while hydrating
  if (!hasHydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-green-600 mx-auto mb-4" />
          <p className="text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  // Show loading only if still loading AND no cached auth
  if (isChecking && authLoading && !hasCachedAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-green-600 mx-auto mb-4" />
          <p className="text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  // If we have cached auth, trust it
  if (hasCachedAuth || isAuthenticated) {
    // Check role if required
    if (requireAuth && user && allowedRoles) {
      const userRole = user.role || 'user';
      if (!allowedRoles.includes(userRole as 'admin' | 'user' | 'tutor')) {
        return null;
      }
    }
    return <>{children}</>;
  }

  // If auth is required but not authenticated (and no cache), don't render
  if (requireAuth) {
    return null;
  }

  return <>{children}</>;
}



"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";
import { Loader2 } from "lucide-react";

interface AuthGuardProps {
  children: React.ReactNode;
  allowedRoles?: ('admin' | 'learner' | 'tutor')[];
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
  const { user, isAuthenticated, isLoading: authLoading, checkSession } = useAuthStore();
  const [isChecking, setIsChecking] = useState(true);

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

      // Wait for auth to load (only on initial load)
      if (authLoading && !isAuthenticated && !user) {
        return;
      }

      // Check if authentication is required
      if (requireAuth && !isAuthenticated) {
        router.push("/auth/login");
        return;
      }

      // If auth is required and user is authenticated, check role
      if (requireAuth && isAuthenticated && user && allowedRoles) {
        const userRole = user.role || 'learner';
        
        if (!allowedRoles.includes(userRole as 'admin' | 'learner' | 'tutor')) {
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
  }, [isAuthenticated, user, authLoading, pathname, router, allowedRoles, requireAuth]);

  // Show loading state only on initial check, not on every route change
  if (isChecking && authLoading && !isAuthenticated && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-green-600 mx-auto mb-4" />
          <p className="text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  // If auth is required but not authenticated, don't render (will redirect)
  if (requireAuth && !isAuthenticated) {
    return null;
  }

  // If role is required but user doesn't have it, don't render (will redirect)
  if (requireAuth && isAuthenticated && user && allowedRoles) {
    const userRole = user.role || 'learner';
    if (!allowedRoles.includes(userRole as 'admin' | 'learner' | 'tutor')) {
      return null;
    }
  }

  return <>{children}</>;
}



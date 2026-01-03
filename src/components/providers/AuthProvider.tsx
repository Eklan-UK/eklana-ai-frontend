"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/store/auth-store";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { checkAuthFlowStatus, getAuthRedirectPath } from "@/utils/auth-flow";

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const { checkSession, isLoading, isAuthenticated } = useAuthStore();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    // Only check session on mount, not on every route change
    let mounted = true;
    
    const initializeAuth = async () => {
      // Check session only on initial mount
      if (mounted) {
        await checkSession();
      }
      
      // Handle OAuth callback - check if we just completed OAuth login
      const searchParams = new URLSearchParams(window.location.search);
      const isOAuthCallback = searchParams.has('code') || pathname?.includes('/callback');
      
      if (isOAuthCallback && isAuthenticated && mounted) {
        const { user } = useAuthStore.getState();
        if (user) {
          // OAuth users are typically auto-verified
          const status = await checkAuthFlowStatus(user);
          const redirectPath = getAuthRedirectPath(status);
          
          // Clean up URL and redirect
          window.history.replaceState({}, '', redirectPath);
          router.push(redirectPath);
        }
      }
    };
    
    initializeAuth();
    
    return () => {
      mounted = false;
    };
  }, []); // Only run on mount

  useEffect(() => {
    // Protect routes that require authentication
    const publicRoutes = [
      "/",
      "/welcome",
      "/splash",
      "/auth/login",
      "/auth/register",
      "/auth/verify-email",
      "/terms",
      "/privacy",
      "/contact",
      "/landing",
    ];

    const isPublicRoute = publicRoutes.some((route) =>
      pathname?.startsWith(route)
    );

    // Don't redirect if still loading or on public route
    if (isLoading || isPublicRoute) return;

    // Redirect to login if not authenticated and trying to access protected route
    if (!isAuthenticated && !isPublicRoute) {
      router.push("/auth/login");
    }
  }, [isLoading, isAuthenticated, pathname, router]);

  return <>{children}</>;
}


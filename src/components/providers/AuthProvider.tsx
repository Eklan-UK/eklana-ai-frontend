"use client";

import { useEffect, useCallback } from "react";
import { useAuthStore } from "@/store/auth-store";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { checkAuthFlowStatus, getAuthRedirectPath } from "@/utils/auth-flow";

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const { checkSession, isLoading, isAuthenticated, hasHydrated } = useAuthStore();
  const pathname = usePathname();
  const router = useRouter();

  // Handle coming back online - revalidate session
  const handleOnline = useCallback(() => {
    const state = useAuthStore.getState();
    // If user has cached session, verify it's still valid when back online
    if (state.user && state.session && state.isAuthenticated) {
      // Don't force refresh - just do a background check
      checkSession(false);
    }
  }, [checkSession]);

  // Handle visibility change - refresh session when tab becomes visible after being hidden
  const handleVisibilityChange = useCallback(() => {
    if (document.visibilityState === 'visible') {
      const state = useAuthStore.getState();
      const timeSinceLastCheck = state.lastSessionCheck 
        ? Date.now() - state.lastSessionCheck 
        : Infinity;
      
      // Only check if it's been more than 30 minutes
      if (timeSinceLastCheck > 30 * 60 * 1000 && state.isAuthenticated) {
        checkSession(false);
      }
    }
  }, [checkSession]);

  useEffect(() => {
    // Add online/offline listeners for better network resilience
    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [handleOnline, handleVisibilityChange]);

  useEffect(() => {
    // Only check session on mount, not on every route change
    let mounted = true;
    
    const initializeAuth = async () => {
      // Wait for localStorage hydration before checking session
      // This ensures we use persisted session data first
      let currentState = useAuthStore.getState();
      if (!currentState.hasHydrated) {
        // Wait for Zustand to hydrate from localStorage
        // The onRehydrateStorage callback will set hasHydrated to true
        const maxWait = 1000; // Max 1 second wait
        const startTime = Date.now();
        while (!currentState.hasHydrated && (Date.now() - startTime) < maxWait && mounted) {
          await new Promise(resolve => setTimeout(resolve, 50));
          currentState = useAuthStore.getState();
        }
      }
      
      // Only check session if we don't have a cached session or it's been a while
      // This prevents unnecessary API calls on every page load
      if (mounted) {
        const currentState = useAuthStore.getState();
        const shouldCheck = !currentState.user || 
                           !currentState.session || 
                           !currentState.lastSessionCheck ||
                           (Date.now() - currentState.lastSessionCheck) > 30 * 60 * 1000; // 30 minutes
        
        if (shouldCheck) {
          await checkSession();
        } else {
          // Use cached session, just set loading to false
          currentState.setLoading(false);
        }
      }
      
      // Handle OAuth callback - check if we just completed OAuth login
      const searchParams = new URLSearchParams(window.location.search);
      const isOAuthCallback = searchParams.has('code') || pathname?.includes('/callback');
      
      if (isOAuthCallback && mounted) {
        const state = useAuthStore.getState();
        if (state.isAuthenticated && state.user) {
          // OAuth users are typically auto-verified
          const status = await checkAuthFlowStatus(state.user);
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

    // Don't redirect if still loading, not hydrated, or on public route
    if (isLoading || !hasHydrated || isPublicRoute) return;

    // Redirect to login if not authenticated and trying to access protected route
    if (!isAuthenticated && !isPublicRoute) {
      router.push("/auth/login");
    }
  }, [isLoading, isAuthenticated, hasHydrated, pathname, router]);

  return <>{children}</>;
}


"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";
import { Loader2 } from "lucide-react";

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles: ('admin' | 'user' | 'tutor')[];
  fallback?: React.ReactNode;
}

/**
 * Role-based route guard for client components
 * Only allows access if user has one of the allowed roles
 */
export function RoleGuard({ children, allowedRoles, fallback }: RoleGuardProps) {
  const router = useRouter();
  const { user, session, isAuthenticated, isLoading, hasHydrated } = useAuthStore();

  // Check if we have cached auth data (from localStorage)
  const hasCachedAuth = !!(user && session);

  useEffect(() => {
    // Wait for localStorage hydration before checking authentication
    if (!hasHydrated) return;
    
    // If still loading AND we have cached auth, wait - don't redirect
    if (isLoading && hasCachedAuth) return;
    
    // If still loading and no cached auth, wait for loading to complete
    if (isLoading) return;

    // Only redirect to login if we're definitely not authenticated
    // AND we don't have any cached session data
    if (!isAuthenticated && !hasCachedAuth) {
      router.push("/auth/login");
      return;
    }

    // Check role if user exists
    if (user) {
      const userRole = (user.role as 'admin' | 'user' | 'tutor') || 'user';
      
      if (!allowedRoles.includes(userRole)) {
        // Redirect based on user's role
        if (userRole === 'admin') {
          router.push("/admin/dashboard");
        } else if (userRole === 'tutor') {
          router.push("/tutor/dashboard");
        } else {
          router.push("/account");
        }
      }
    }
  }, [user, session, isAuthenticated, isLoading, hasHydrated, allowedRoles, router, hasCachedAuth]);

  // Show loading while hydrating from localStorage
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
  if (isLoading && !hasCachedAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-green-600 mx-auto mb-4" />
          <p className="text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  // If we have cached auth data, trust it and render
  if (hasCachedAuth || (isAuthenticated && user)) {
    const userRole = (user?.role as 'admin' | 'user' | 'tutor') || 'user';
    
    if (!allowedRoles.includes(userRole)) {
      return fallback || null;
    }
    
    return <>{children}</>;
  }

  // No auth - will redirect via useEffect
  return null;
}



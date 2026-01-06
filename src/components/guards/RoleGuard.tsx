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
  const { user, isAuthenticated, isLoading, hasHydrated } = useAuthStore();

  useEffect(() => {
    // Wait for localStorage hydration before checking authentication
    if (!hasHydrated || isLoading) return;

    if (!isAuthenticated || !user) {
      router.push("/auth/login");
      return;
    }

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
  }, [user, isAuthenticated, isLoading, hasHydrated, allowedRoles, router]);

  // Show loading while hydrating from localStorage or checking session
  if (!hasHydrated || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-green-600 mx-auto mb-4" />
          <p className="text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  const userRole = (user.role as 'admin' | 'user' | 'tutor') || 'user';
  
  if (!allowedRoles.includes(userRole)) {
    return fallback || null;
  }

  return <>{children}</>;
}



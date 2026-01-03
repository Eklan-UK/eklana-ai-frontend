import { useAuthStore } from "@/store/auth-store";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Custom hook for authentication
 * Provides easy access to auth state and methods
 */
export function useAuth() {
  const store = useAuthStore();
  const router = useRouter();

  // Redirect to login if not authenticated
  const requireAuth = () => {
    if (!store.isAuthenticated && !store.isLoading) {
      router.push("/auth/login");
    }
  };

  // Redirect to home if authenticated
  const requireGuest = () => {
    if (store.isAuthenticated && !store.isLoading) {
      router.push("/");
    }
  };

  return {
    ...store,
    requireAuth,
    requireGuest,
  };
}

/**
 * Hook to protect routes - redirects to login if not authenticated
 */
export function useRequireAuth() {
  const { isAuthenticated, isLoading, requireAuth } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      requireAuth();
    }
  }, [isAuthenticated, isLoading, requireAuth]);

  return { isAuthenticated, isLoading };
}


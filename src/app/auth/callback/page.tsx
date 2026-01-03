"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";
import { checkAuthFlowStatus, getAuthRedirectPath } from "@/utils/auth-flow";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

function OAuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { checkSession, user } = useAuthStore();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Refresh session to get user data after OAuth
        await checkSession();
        
        // Small delay to ensure user is set
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const currentUser = useAuthStore.getState().user;
        
        if (currentUser) {
          // OAuth users are typically auto-verified
          const status = await checkAuthFlowStatus(currentUser);
          const redirectPath = getAuthRedirectPath(status);
          
          if (status.shouldOnboard) {
            toast.info("Please complete your profile setup");
            router.push("/account/onboarding");
          } else {
            toast.success("Welcome! Redirecting...");
            router.push(redirectPath);
          }
        } else {
          // No user found, redirect to login
          router.push("/auth/login");
        }
      } catch (error) {
        console.error("OAuth callback error:", error);
        router.push("/auth/login");
      }
    };

    handleCallback();
  }, [router, checkSession]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin text-green-600 mx-auto mb-4" />
        <p className="text-sm text-gray-500">Completing sign in...</p>
      </div>
    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="w-8 h-8 animate-spin text-green-600" />
      </div>
    }>
      <OAuthCallbackContent />
    </Suspense>
  );
}


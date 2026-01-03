"use client";

import { useState, useEffect, Suspense } from "react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CheckCircle, XCircle, Loader2, Mail } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { authService } from "@/services/auth.service";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth-store";
import { checkAuthFlowStatus, getAuthRedirectPath } from "@/utils/auth-flow";

function VerifyEmailConfirmPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const { setUser } = useAuthStore();

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const verifyEmail = async () => {
      if (!token) {
        setStatus("error");
        setErrorMessage("Invalid verification link. Please request a new verification email.");
        return;
      }

      try {
        const result = await authService.verifyEmail(token);
        setStatus("success");
        toast.success("Email verified successfully!");
        
        // Update user in store if available
        let verifiedUser = result.user;
        if (verifiedUser) {
          setUser(verifiedUser);
        } else {
          // Refresh user from store
          await useAuthStore.getState().checkSession();
          verifiedUser = useAuthStore.getState().user;
        }
        
        // Check onboarding status and redirect accordingly
        if (verifiedUser) {
          const status = await checkAuthFlowStatus(verifiedUser);
          const redirectPath = getAuthRedirectPath(status);
          
          // Small delay to show success message
          setTimeout(() => {
            router.push(redirectPath);
          }, 1500);
        }
      } catch (error: any) {
        setStatus("error");
        setErrorMessage(error.message || "Failed to verify email. The link may have expired.");
        toast.error(error.message || "Failed to verify email");
      }
    };

    verifyEmail();
  }, [token, setUser]);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-white">
        {/* Status Bar Space */}
        <div className="h-6"></div>

        <Header title="Verifying Email" />

        <div className="max-w-md mx-auto px-4 py-8 md:max-w-lg md:px-8">
          <Card>
            <div className="flex flex-col items-center text-center py-8">
              <Loader2 className="w-12 h-12 text-green-600 animate-spin mb-4" />
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                Verifying Your Email
              </h2>
              <p className="text-sm text-gray-600">
                Please wait while we verify your email address...
              </p>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="min-h-screen bg-white">
        {/* Status Bar Space */}
        <div className="h-6"></div>

        <Header title="Email Verified" />

        <div className="max-w-md mx-auto px-4 py-8 md:max-w-lg md:px-8">
          <Card className="bg-green-50 border-green-200">
            <div className="flex flex-col items-center text-center py-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                Email Verified Successfully!
              </h2>
              <p className="text-sm text-gray-600 mb-6">
                Your email address has been verified. Redirecting...
              </p>
              <div className="w-full">
                <Button variant="primary" size="lg" fullWidth disabled>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Redirecting...
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Status Bar Space */}
      <div className="h-6"></div>

      <Header title="Verification Failed" />

      <div className="max-w-md mx-auto px-4 py-8 md:max-w-lg md:px-8">
        <Card className="bg-red-50 border-red-200">
          <div className="flex flex-col items-center text-center py-8">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <XCircle className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              Verification Failed
            </h2>
            <p className="text-sm text-gray-600 mb-6">{errorMessage}</p>
            <div className="flex flex-col gap-3 w-full">
              <Link href="/account/settings" className="w-full">
                <Button variant="primary" size="lg" fullWidth>
                  <Mail className="w-4 h-4 mr-2" />
                  Request New Verification Email
                </Button>
              </Link>
              <Link href="/account" className="w-full">
                <Button variant="outline" size="lg" fullWidth>
                  Go to Dashboard
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default function VerifyEmailConfirmPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-green-600" />
      </div>
    }>
      <VerifyEmailConfirmPageContent />
    </Suspense>
  );
}


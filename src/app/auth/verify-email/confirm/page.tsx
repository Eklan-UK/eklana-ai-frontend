"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { CheckCircle, XCircle, Loader2, Mail } from "lucide-react";
import Link from "next/link";
import { authService } from "@/services/auth.service";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth-store";

function VerifyEmailConfirmContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const { checkSession } = useAuthStore();

  useEffect(() => {
    const verifyEmail = async () => {
      if (!token) {
        setStatus("error");
        setErrorMessage("Verification token is missing");
        return;
      }

      try {
        // Verify email with token
        await authService.verifyEmail(token);
        
        // Clear pending verification email from sessionStorage
        sessionStorage.removeItem("pendingVerificationEmail");
        
        // Refresh session to get updated user data
        await checkSession();
        
        setStatus("success");
        toast.success("Email verified successfully!");
        
        // Redirect to onboarding after a short delay
        setTimeout(() => {
          router.push("/account/onboarding");
        }, 2000);
      } catch (error: any) {
        setStatus("error");
        setErrorMessage(
          error.message || "Failed to verify email. The link may have expired."
        );
        toast.error("Email verification failed");
      }
    };

    verifyEmail();
  }, [token, router, checkSession]);

  return (
    <div className="min-h-screen bg-white">
      <div className="h-6"></div>
      <Header title="Email Verification" />

      <div className="max-w-md mx-auto px-4 py-8 md:max-w-lg md:px-8">
        <Card className="p-8">
          {status === "loading" && (
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Verifying Your Email
              </h2>
              <p className="text-sm text-gray-600">
                Please wait while we verify your email address...
              </p>
            </div>
          )}

          {status === "success" && (
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Email Verified!
              </h2>
              <p className="text-sm text-gray-600 mb-6">
                Your email has been successfully verified. Redirecting to setup your profile...
              </p>
              <Button
                variant="primary"
                size="lg"
                fullWidth
                onClick={() => router.push("/account/onboarding")}
              >
                Continue to Profile Setup
              </Button>
            </div>
          )}

          {status === "error" && (
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <XCircle className="w-8 h-8 text-red-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Verification Failed
              </h2>
              <p className="text-sm text-gray-600 mb-6">
                {errorMessage || "Something went wrong. Please try again."}
              </p>
              <div className="space-y-3">
                <Button
                  variant="primary"
                  size="lg"
                  fullWidth
                  onClick={() => router.push("/auth/verify-email")}
                >
                  <Mail className="w-4 h-4 mr-2" />
                  Request New Verification Email
                </Button>
                <Link href="/auth/login">
                  <Button variant="outline" size="lg" fullWidth>
                    Back to Login
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

export default function VerifyEmailConfirmPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-green-600 mx-auto mb-4" />
          <p className="text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    }>
      <VerifyEmailConfirmContent />
    </Suspense>
  );
}

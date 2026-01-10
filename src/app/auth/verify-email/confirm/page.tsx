"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { CheckCircle, XCircle, Loader2, Mail, LogIn } from "lucide-react";
import Link from "next/link";
import { authService } from "@/services/auth.service";
import { toast } from "sonner";

function VerifyEmailConfirmContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    const verifyEmail = async () => {
      if (!token) {
        setStatus("error");
        setErrorMessage("Verification token is missing. Please check your email link.");
        return;
      }

      try {
        // Verify email with token
        await authService.verifyEmail(token);
        
        // Clear pending verification email from sessionStorage
        sessionStorage.removeItem("pendingVerificationEmail");
        
        setStatus("success");
        toast.success("Email verified successfully! You can now sign in.");
        
        // Redirect to login after a short delay
        setTimeout(() => {
          router.push("/auth/login");
        }, 3000);
      } catch (error: any) {
        setStatus("error");
        if (error.message?.includes("expired")) {
          setErrorMessage("This verification link has expired. Please request a new one.");
        } else if (error.message?.includes("Invalid") || error.message?.includes("invalid")) {
          setErrorMessage("This verification link is invalid. Please request a new one.");
        } else if (error.message?.includes("already verified") || error.message?.includes("Already")) {
          // Already verified is actually success
          setStatus("success");
          toast.success("Your email is already verified! You can sign in.");
          setTimeout(() => {
            router.push("/auth/login");
          }, 2000);
          return;
        } else {
          setErrorMessage(error.message || "Failed to verify email. Please try again.");
        }
        toast.error("Email verification failed");
      }
    };

    verifyEmail();
  }, [token, router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50">
      <div className="h-6"></div>
      <Header title="Email Verification" />

      <div className="max-w-md mx-auto px-4 py-8 md:max-w-lg md:px-8">
        <Card className="p-8 bg-white shadow-xl rounded-3xl">
          {status === "loading" && (
            <div className="text-center">
              <div className="relative w-20 h-20 mx-auto mb-6">
                <div className="absolute inset-0 bg-green-200 rounded-full animate-ping opacity-25"></div>
                <div className="relative w-20 h-20 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center shadow-lg">
                  <Loader2 className="w-10 h-10 text-white animate-spin" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Verifying Your Email
              </h2>
              <p className="text-gray-600">
                Please wait while we verify your email address...
              </p>
            </div>
          )}

          {status === "success" && (
            <div className="text-center">
              <div className="relative w-20 h-20 mx-auto mb-6">
                <div className="absolute inset-0 bg-green-200 rounded-full animate-ping opacity-25"></div>
                <div className="relative w-20 h-20 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center shadow-lg">
                  <CheckCircle className="w-10 h-10 text-white" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Email Verified! 🎉
              </h2>
              <p className="text-gray-600 mb-6">
                Your email has been successfully verified. Redirecting to login...
              </p>
              
              <Link href="/auth/login">
                <Button
                  variant="primary"
                  size="lg"
                  fullWidth
                  className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
                >
                  <LogIn className="w-5 h-5 mr-2" />
                  Sign In Now
                </Button>
              </Link>
            </div>
          )}

          {status === "error" && (
            <div className="text-center">
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <XCircle className="w-10 h-10 text-red-500" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Verification Failed
              </h2>
              <p className="text-gray-600 mb-6">
                {errorMessage}
              </p>
              <div className="space-y-3">
                <Link href="/auth/register">
                  <Button
                    variant="primary"
                    size="lg"
                    fullWidth
                    className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
                  >
                    <Mail className="w-4 h-4 mr-2" />
                    Sign Up Again
                  </Button>
                </Link>
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
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-green-600 mx-auto mb-4" />
          <p className="text-gray-600">Verifying your email...</p>
        </div>
      </div>
    }>
      <VerifyEmailConfirmContent />
    </Suspense>
  );
}

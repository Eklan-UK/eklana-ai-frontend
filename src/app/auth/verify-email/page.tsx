"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Mail, CheckCircle, Loader2, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { authService } from "@/services/auth.service";
import { toast } from "sonner";
import Link from "next/link";

export default function VerifyEmailPage() {
  const router = useRouter();
  const [isSending, setIsSending] = useState(false);
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    // Get email from sessionStorage (set during signup or failed login)
    const pendingEmail = sessionStorage.getItem("pendingVerificationEmail");
    if (pendingEmail) {
      setUserEmail(pendingEmail);
    }
  }, []);

  const handleResendEmail = async () => {
    if (!userEmail) {
      toast.error("No email address found. Please try signing up again.");
      router.push("/auth/register");
      return;
    }

    setIsSending(true);
    try {
      await authService.sendVerificationEmailByEmail(userEmail);
      toast.success("Verification email sent! Please check your inbox.");
    } catch (error: any) {
      if (error.message?.includes("Already") || error.message?.includes("already verified")) {
        toast.success("Your email is already verified! You can sign in now.");
        sessionStorage.removeItem("pendingVerificationEmail");
        router.push("/auth/login");
      } else if (error.message?.includes("Rate") || error.message?.includes("Too many")) {
        toast.error("Too many requests. Please wait a minute before trying again.");
      } else {
        toast.error(error.message || "Failed to send verification email. Please try again.");
      }
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50">
      {/* Status Bar Space */}
      <div className="h-6"></div>

      <Header title="Verify Your Email" />

      <div className="max-w-md mx-auto px-4 py-8 md:max-w-lg md:px-8">
        <Card className="p-8 bg-white shadow-xl rounded-3xl">
          <div className="text-center">
            {/* Animated Email Icon */}
            <div className="relative w-20 h-20 mx-auto mb-6">
              <div className="absolute inset-0 bg-green-200 rounded-full animate-ping opacity-25"></div>
              <div className="relative w-20 h-20 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center shadow-lg">
                <Mail className="w-10 h-10 text-white" />
              </div>
            </div>

            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Check Your Email
            </h2>
            
            {userEmail ? (
              <>
                <p className="text-gray-600 mb-2">
                  We've sent a verification link to
                </p>
                <p className="text-lg font-semibold text-green-600 mb-6 break-all">
                  {userEmail}
                </p>
              </>
            ) : (
              <p className="text-gray-600 mb-6">
                We've sent you a verification link. Please check your email.
              </p>
            )}

            {/* Instructions */}
            <div className="bg-gray-50 rounded-xl p-4 mb-6 text-left">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">
                What to do next:
              </h3>
              <ol className="text-sm text-gray-600 space-y-2">
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center text-green-600 text-xs font-bold flex-shrink-0 mt-0.5">1</span>
                  <span>Open your email inbox</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center text-green-600 text-xs font-bold flex-shrink-0 mt-0.5">2</span>
                  <span>Find the email from <strong>eklan</strong></span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center text-green-600 text-xs font-bold flex-shrink-0 mt-0.5">3</span>
                  <span>Click the verification link</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center text-green-600 text-xs font-bold flex-shrink-0 mt-0.5">4</span>
                  <span>Return here and sign in</span>
                </li>
              </ol>
            </div>

            {/* Resend Button */}
            <Button
              variant="outline"
              size="lg"
              fullWidth
              onClick={handleResendEmail}
              disabled={isSending || !userEmail}
              className="mb-4"
            >
              {isSending ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="w-5 h-5 mr-2" />
                  Resend Verification Email
                </>
              )}
            </Button>

            {/* Back to Login */}
            <Link href="/auth/login">
              <Button
                variant="primary"
                size="lg"
                fullWidth
                className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
              >
                <ArrowLeft className="w-5 h-5 mr-2" />
                Back to Login
              </Button>
            </Link>

            {/* Help text */}
            <p className="text-xs text-gray-500 mt-6">
              Didn't receive the email? Check your spam folder or click resend above.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}

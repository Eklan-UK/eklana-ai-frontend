"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Mail, CheckCircle, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { authService } from "@/services/auth.service";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth-store";
import { checkAuthFlowStatus, getAuthRedirectPath } from "@/utils/auth-flow";

export default function VerifyEmailPage() {
  const router = useRouter();
  const { user, checkSession } = useAuthStore();
  const [isSending, setIsSending] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    // Get user email from store or session
    if (user?.email) {
      setUserEmail(user.email);
    } else {
      // Try to refresh session to get user email
      checkSession().then(() => {
        const currentUser = useAuthStore.getState().user;
        if (currentUser?.email) {
          setUserEmail(currentUser.email);
        }
      });
    }
  }, [user, checkSession]);

  const handleSendVerificationEmail = async () => {
    // Check if user is logged in
    const { user: currentUser, isAuthenticated } = useAuthStore.getState();
    
    if (!isAuthenticated || !currentUser) {
      // Try to refresh session
      await checkSession();
      const refreshedUser = useAuthStore.getState().user;
      
      if (!refreshedUser || !useAuthStore.getState().isAuthenticated) {
        toast.error("Please log in first to resend verification email");
        router.push("/auth/login");
        return;
      }
    }

    setIsSending(true);
    try {
      await authService.sendVerificationEmail();
      setIsSent(true);
      toast.success("Verification email sent! Please check your inbox.");
    } catch (error: any) {
      // If 401 or 403, user might not be authenticated properly
      if (error.message?.includes("401") || error.message?.includes("403") || error.message?.includes("Unauthorized")) {
        toast.error("Please log in first to resend verification email");
        router.push("/auth/login");
      } else if (error.message?.includes("404") || error.message?.includes("Failed to send")) {
        toast.info("Verification email was sent when you registered. Please check your inbox or spam folder.");
        setIsSent(true);
      } else {
        toast.error(error.message || "Failed to send verification email");
      }
    } finally {
      setIsSending(false);
    }
  };

  // Check if user is already verified
  useEffect(() => {
    const checkVerification = async () => {
      // Wait a bit for auth to load, then check
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Try to get user from store
      let currentUser = user;
      if (!currentUser) {
        await checkSession();
        currentUser = useAuthStore.getState().user;
      }
      
      if (currentUser) {
        const status = await checkAuthFlowStatus(currentUser);
        if (status.isVerified) {
          // Already verified, redirect to appropriate page
          const redirectPath = getAuthRedirectPath(status);
          router.push(redirectPath);
        }
      }
    };

    checkVerification();
  }, [user, router, checkSession]);

  return (
    <div className="min-h-screen bg-white">
      {/* Status Bar Space */}
      <div className="h-6"></div>

      <Header showBack title="Verify Your Email" />

      <div className="max-w-md mx-auto px-4 py-8 md:max-w-lg md:px-8">
        <Card className="p-6">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Verify Your Email Address
            </h2>
            <p className="text-sm text-gray-600">
              We've sent a verification link to
            </p>
            {userEmail && (
              <p className="text-sm font-semibold text-gray-900 mt-1">
                {userEmail}
              </p>
            )}
          </div>

          {!isSent ? (
            <>
              <p className="text-sm text-gray-600 mb-6 text-center">
                Please check your email and click the verification link to
                activate your account. If you didn't receive the email, you can
                request a new one.
              </p>

              <Button
                variant="primary"
                size="lg"
                fullWidth
                onClick={handleSendVerificationEmail}
                disabled={isSending || !userEmail}
              >
                {isSending ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="w-5 h-5 mr-2" />
                    Send Verification Email
                  </>
                )}
              </Button>
            </>
          ) : (
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Verification email sent! Please check your inbox and click the
                link to verify your email.
              </p>
              <Button
                variant="outline"
                size="lg"
                fullWidth
                onClick={handleSendVerificationEmail}
                disabled={isSending}
              >
                {isSending ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  "Resend Verification Email"
                )}
              </Button>
            </div>
          )}

          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-500 text-center">
              Didn't receive the email? Check your spam folder or try resending.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}

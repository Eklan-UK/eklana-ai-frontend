"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Header } from "@/components/layout/Header";
import Link from "next/link";
import { useAuthStore } from "@/store/auth-store";
import { toast } from "sonner";
import { Loader2, Mail, Lock } from "lucide-react";
import { checkAuthFlowStatus, getAuthRedirectPath } from "@/utils/auth-flow";
import { authService } from "@/services/auth.service";

export default function LoginPage() {
  const router = useRouter();
  const { login, signInWithGoogle, signInWithApple, isLoading } =
    useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      toast.error("Please fill in all fields");
      return;
    }

    setIsSubmitting(true);
    try {
      // Pass rememberMe option to login function
      await login(email, password, rememberMe);

      // Small delay to ensure user is set in store
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Refresh session to get latest user data
      await useAuthStore.getState().checkSession();

      // Get updated user from store
      const { user } = useAuthStore.getState();

      if (!user) {
        throw new Error(
          "Login successful but user data not available. Please try again."
        );
      }

      // Check verification and onboarding status
      const status = await checkAuthFlowStatus(user);
      const redirectPath = getAuthRedirectPath(status);

      if (status.shouldVerify) {
        toast.info("Please verify your email to continue");
        router.push("/auth/verify-email");
      } else if (status.shouldOnboard) {
        toast.info("Please complete your profile setup");
        router.push("/account/onboarding");
      } else {
        toast.success("Welcome back! Redirecting...");
        router.push(redirectPath);
      }
    } catch (error: any) {
      // Handle EMAIL_NOT_VERIFIED error - resend verification email and redirect
      if (
        error.code === "EMAIL_NOT_VERIFIED" ||
        error.message?.toLowerCase().includes("email") && error.message?.toLowerCase().includes("verify")
      ) {
        // Try to get session anyway - user might still be logged in
        try {
          await useAuthStore.getState().checkSession();
          const { user } = useAuthStore.getState();
          if (user) {
            toast.info("Please verify your email to continue");
            router.push("/auth/verify-email");
            return;
          }
        } catch (sessionError) {
          // If we can't get session, continue to send verification email
        }
        
        // User is not logged in but email is not verified - send a new verification email
        try {
          await authService.sendVerificationEmailByEmail(email);
          toast.info("Verification email sent! Please check your inbox and verify your email.");
          // Store email in session storage for the verify-email page
          sessionStorage.setItem("pendingVerificationEmail", email);
          router.push("/auth/verify-email");
          return;
        } catch (resendError: any) {
          console.error("Failed to resend verification email:", resendError);
          toast.error("Please verify your email. Check your inbox or try signing up again.");
          sessionStorage.setItem("pendingVerificationEmail", email);
          router.push("/auth/verify-email");
          return;
        }
      }
      
      toast.error(
        error?.message || "Invalid email or password. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
      // OAuth redirect will happen automatically
      // Callback will be handled in middleware or callback page
    } catch (error: any) {
      toast.error(error?.message || "Failed to sign in with Google");
    }
  };

  const handleAppleSignIn = async () => {
    try {
      await signInWithApple();
      // OAuth redirect will happen automatically
      // Callback will be handled in middleware or callback page
    } catch (error: any) {
      toast.error(error?.message || "Failed to sign in with Apple");
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Status Bar Space */}
      <div className="h-6"></div>

      <Header showBack title="Login" />

      <div className="max-w-md mx-auto px-4 py-8 md:max-w-lg md:px-8">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
            Welcome back!
          </h1>
          <p className="text-base text-gray-600">
            Sign in to continue your learning journey
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Input
            type="email"
            label="Email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isSubmitting || isLoading}
            required
            icon={<Mail className="w-5 h-5 text-gray-400" />}
          />

          <Input
            type="password"
            label="Password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isSubmitting || isLoading}
            required
            icon={<Lock className="w-5 h-5 text-gray-400" />}
          />

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                disabled={isSubmitting || isLoading}
              />
              <span className="text-sm text-gray-600">Remember me</span>
            </label>
            <Link
              href="/auth/forgot-password"
              className="text-sm text-green-600 hover:text-green-700"
            >
              Forgot password?
            </Link>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            className="items-center justify-center flex"
            disabled={isSubmitting || isLoading}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Signing in...
              </>
            ) : (
              "Sign In"
            )}
          </Button>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">
                Or continue with
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <Button
              type="button"
              variant="outline"
              size="lg"
              fullWidth
              onClick={handleGoogleSignIn}
              disabled={isSubmitting || isLoading}
              className="flex items-center justify-center gap-3"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M10 2C5.58 2 2 5.58 2 10C2 14.42 5.58 18 10 18C14.42 18 18 14.42 18 10C18 5.58 14.42 2 10 2Z"
                  fill="currentColor"
                />
              </svg>
              Continue with Google
            </Button>

            <Button
              type="button"
              variant="secondary"
              size="lg"
              fullWidth
              onClick={handleAppleSignIn}
              disabled={isSubmitting || isLoading}
              className="flex items-center justify-center gap-3"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M15.5 10C15.5 13.59 12.59 16.5 9 16.5C5.41 16.5 2.5 13.59 2.5 10C2.5 6.41 5.41 3.5 9 3.5C12.59 3.5 15.5 6.41 15.5 10Z"
                  fill="currentColor"
                />
              </svg>
              Continue with Apple
            </Button>
          </div>

          <p className="text-center text-sm text-gray-600">
            Don&apos;t have an account?{" "}
            <Link
              href="/auth/register"
              className="text-green-600 font-semibold hover:text-green-700"
            >
              Sign up
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}

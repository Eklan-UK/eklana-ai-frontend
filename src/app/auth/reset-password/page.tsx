"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Lock, CheckCircle, XCircle, Loader2, Eye, EyeOff, AlertCircle } from "lucide-react";
import Link from "next/link";
import { authService } from "@/services/auth.service";
import { toast } from "sonner";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<"form" | "success" | "error">("form");
  const [errorMessage, setErrorMessage] = useState("");
  const [errors, setErrors] = useState<{
    newPassword?: string;
    confirmPassword?: string;
  }>({});

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMessage("Invalid reset link. Please request a new password reset.");
    }
  }, [token]);

  const validateForm = () => {
    const newErrors: typeof errors = {};

    if (!newPassword) {
      newErrors.newPassword = "New password is required";
    } else if (newPassword.length < 8) {
      newErrors.newPassword = "Password must be at least 8 characters";
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = "Please confirm your new password";
    } else if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    if (!token) {
      setStatus("error");
      setErrorMessage("Invalid reset link. Please request a new password reset.");
      return;
    }

    setIsSubmitting(true);
    try {
      await authService.resetPassword(token, newPassword);
      setStatus("success");
      toast.success("Password reset successfully!");
      
      // Redirect to login after a short delay
      setTimeout(() => {
        router.push("/auth/login");
      }, 3000);
    } catch (error: any) {
      if (error.message?.includes("expired")) {
        setStatus("error");
        setErrorMessage("This reset link has expired. Please request a new password reset.");
      } else if (error.message?.includes("invalid") || error.message?.includes("Invalid")) {
        setStatus("error");
        setErrorMessage("Invalid reset link. Please request a new password reset.");
      } else {
        toast.error(error.message || "Failed to reset password. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (status === "success") {
    return (
      <div className="min-h-screen bg-white">
        <div className="h-6"></div>
        <Header title="Password Reset" />

        <div className="max-w-md mx-auto px-4 py-8 md:max-w-lg md:px-8">
          <Card className="p-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Password Reset!
              </h2>
              <p className="text-sm text-gray-600 mb-6">
                Your password has been reset successfully. You will be redirected to the login page...
              </p>
              <Link href="/auth/login">
                <Button variant="primary" size="lg" fullWidth>
                  Sign In Now
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen bg-white">
        <div className="h-6"></div>
        <Header title="Password Reset" />

        <div className="max-w-md mx-auto px-4 py-8 md:max-w-lg md:px-8">
          <Card className="p-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <XCircle className="w-8 h-8 text-red-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Reset Link Invalid
              </h2>
              <p className="text-sm text-gray-600 mb-6">
                {errorMessage}
              </p>
              <div className="space-y-3">
                <Link href="/auth/forgot-password">
                  <Button variant="primary" size="lg" fullWidth>
                    Request New Reset Link
                  </Button>
                </Link>
                <Link href="/auth/login">
                  <Button variant="outline" size="lg" fullWidth>
                    Back to Login
                  </Button>
                </Link>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="h-6"></div>
      <Header showBack title="Reset Password" />

      <div className="max-w-md mx-auto px-4 py-8 md:max-w-lg md:px-8">
        <Card className="p-6">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Create New Password
            </h2>
            <p className="text-sm text-gray-600">
              Enter your new password below.
            </p>
          </div>

          <Card className="bg-yellow-50 border-yellow-200 mb-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-yellow-600 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-gray-900 mb-1">
                  Password Requirements
                </p>
                <ul className="text-xs text-gray-600 space-y-1 list-disc list-inside">
                  <li>At least 8 characters long</li>
                </ul>
              </div>
            </div>
          </Card>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Input
                type={showPassword ? "text" : "password"}
                label="New Password"
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  setErrors({ ...errors, newPassword: undefined });
                }}
                disabled={isSubmitting}
                required
                error={errors.newPassword}
                icon={<Lock className="w-5 h-5 text-gray-400" />}
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                }
              />
            </div>

            <div>
              <Input
                type={showConfirmPassword ? "text" : "password"}
                label="Confirm New Password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setErrors({ ...errors, confirmPassword: undefined });
                }}
                disabled={isSubmitting}
                required
                error={errors.confirmPassword}
                icon={<Lock className="w-5 h-5 text-gray-400" />}
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                }
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Resetting...
                </>
              ) : (
                "Reset Password"
              )}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-green-600 mx-auto mb-4" />
            <p className="text-sm text-gray-500">Loading...</p>
          </div>
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}

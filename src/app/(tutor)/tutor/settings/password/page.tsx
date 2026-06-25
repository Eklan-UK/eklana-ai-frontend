"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Lock, Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { authService } from "@/services/auth.service";
import { toast } from "sonner";

export default function TutorChangePasswordPage() {
  const router = useRouter();
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
  }>({});

  const isSetMode = hasPassword === false;
  const pageTitle = isSetMode ? "Set Password" : "Change Password";

  useEffect(() => {
    let cancelled = false;

    authService
      .getPasswordStatus()
      .then(({ hasPassword: hasExistingPassword }) => {
        if (!cancelled) setHasPassword(hasExistingPassword);
      })
      .catch(() => {
        if (!cancelled) setHasPassword(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const validateForm = () => {
    const newErrors: typeof errors = {};

    if (!isSetMode && !currentPassword) {
      newErrors.currentPassword = "Current password is required";
    }

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

    if (
      !isSetMode &&
      currentPassword &&
      newPassword &&
      currentPassword === newPassword
    ) {
      newErrors.newPassword =
        "New password must be different from current password";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    try {
      if (isSetMode) {
        await authService.setPassword(newPassword);
        toast.success("Password set successfully");
      } else {
        await authService.changePassword(currentPassword, newPassword);
        toast.success("Password changed successfully");
      }
      router.back();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to update password";
      toast.error(message);
      if (
        message.includes("current password") ||
        message.includes("incorrect")
      ) {
        setErrors({ currentPassword: "Current password is incorrect" });
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (hasPassword === null) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="h-6"></div>
        <Header showBack title="Password" />
        <div className="max-w-4xl mx-auto px-4 py-8 md:px-8 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="h-6"></div>

      <Header showBack title={pageTitle} />

      <div className="max-w-4xl mx-auto px-4 py-8 md:px-8">
        <form onSubmit={handleSubmit} className="space-y-6 max-w-md">
          <Card
            className={
              isSetMode
                ? "bg-blue-50 border-blue-200"
                : "bg-yellow-50 border-yellow-200"
            }
          >
            <div className="flex items-start gap-3">
              <AlertCircle
                className={`w-6 h-6 mt-0.5 ${
                  isSetMode ? "text-blue-600" : "text-yellow-600"
                }`}
              />
              <div>
                {isSetMode ? (
                  <>
                    <p className="text-sm font-semibold text-gray-900 mb-1">
                      Social login account
                    </p>
                    <p className="text-xs text-gray-600">
                      Your account was created with Google or Apple. Set a
                      password here to also sign in with your email and
                      password.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-gray-900 mb-1">
                      Password Requirements
                    </p>
                    <ul className="text-xs text-gray-600 space-y-1 list-disc list-inside">
                      <li>At least 8 characters long</li>
                      <li>Must be different from your current password</li>
                    </ul>
                  </>
                )}
              </div>
            </div>
          </Card>

          <div className="space-y-4">
            {!isSetMode ? (
              <Input
                type={showCurrentPassword ? "text" : "password"}
                label="Current Password *"
                value={currentPassword}
                onChange={(e) => {
                  setCurrentPassword(e.target.value);
                  setErrors({ ...errors, currentPassword: undefined });
                }}
                required
                disabled={isLoading}
                error={errors.currentPassword}
                icon={<Lock className="w-5 h-5" />}
                rightIcon={
                  <button
                    type="button"
                    onClick={() =>
                      setShowCurrentPassword(!showCurrentPassword)
                    }
                    className="text-gray-500 hover:text-gray-700"
                  >
                    {showCurrentPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                }
              />
            ) : null}

            <Input
              type={showNewPassword ? "text" : "password"}
              label={isSetMode ? "Password *" : "New Password *"}
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                setErrors({ ...errors, newPassword: undefined });
              }}
              required
              disabled={isLoading}
              error={errors.newPassword}
              icon={<Lock className="w-5 h-5" />}
              rightIcon={
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  {showNewPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              }
            />

            <Input
              type={showConfirmPassword ? "text" : "password"}
              label={isSetMode ? "Confirm Password *" : "Confirm New Password *"}
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                setErrors({ ...errors, confirmPassword: undefined });
              }}
              required
              disabled={isLoading}
              error={errors.confirmPassword}
              icon={<Lock className="w-5 h-5" />}
              rightIcon={
                <button
                  type="button"
                  onClick={() =>
                    setShowConfirmPassword(!showConfirmPassword)
                  }
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

          <div className="flex gap-4 pt-4">
            <Button
              type="button"
              variant="outline"
              size="lg"
              fullWidth
              onClick={() => router.back()}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  {isSetMode ? "Setting..." : "Changing..."}
                </>
              ) : isSetMode ? (
                "Set Password"
              ) : (
                "Change Password"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

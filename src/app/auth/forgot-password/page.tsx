"use client";

import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Mail, CheckCircle, Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { authService } from "@/services/auth.service";
import { toast } from "sonner";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isSent, setIsSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      toast.error("Please enter your email address");
      return;
    }

    setIsSending(true);
    try {
      await authService.forgotPassword(email);
      setIsSent(true);
      toast.success("Password reset email sent!");
    } catch (error: any) {
      // Don't reveal if email exists or not for security
      setIsSent(true);
      toast.success("If an account exists, a reset link has been sent.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Status Bar Space */}
      <div className="h-6"></div>

      <Header showBack title="Forgot Password" />

      <div className="max-w-md mx-auto px-4 py-8 md:max-w-lg md:px-8">
        <Card className="p-6">
          {!isSent ? (
            <>
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Mail className="w-8 h-8 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Forgot Your Password?
                </h2>
                <p className="text-sm text-gray-600">
                  Enter your email address and we'll send you a link to reset your password.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  type="email"
                  label="Email Address"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isSending}
                  required
                  icon={<Mail className="w-5 h-5 text-gray-400" />}
                />

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  fullWidth
                  disabled={isSending || !email}
                >
                  {isSending ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    "Send Reset Link"
                  )}
                </Button>
              </form>
            </>
          ) : (
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Check Your Email
              </h2>
              <p className="text-sm text-gray-600 mb-6">
                If an account exists with <strong>{email}</strong>, we've sent a password reset link. Please check your inbox and spam folder.
              </p>
              
              <div className="space-y-3">
                <Button
                  variant="outline"
                  size="lg"
                  fullWidth
                  onClick={() => {
                    setIsSent(false);
                    setEmail("");
                  }}
                >
                  Try Another Email
                </Button>
                
                <Link href="/auth/login">
                  <Button variant="primary" size="lg" fullWidth>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Login
                  </Button>
                </Link>
              </div>
            </div>
          )}

          {!isSent && (
            <div className="mt-6 pt-6 border-t border-gray-200 text-center">
              <p className="text-sm text-gray-600">
                Remember your password?{" "}
                <Link
                  href="/auth/login"
                  className="text-green-600 font-semibold hover:text-green-700"
                >
                  Sign in
                </Link>
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

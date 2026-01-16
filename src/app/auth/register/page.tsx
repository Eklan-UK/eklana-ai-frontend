"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Header } from "@/components/layout/Header";
import Link from "next/link";
import { useAuthStore } from "@/store/auth-store";
import { toast } from "sonner";
import { Loader2, Mail, Lock, User } from "lucide-react";
import { authService } from "@/services/auth.service";

export default function RegisterPage() {
  const router = useRouter();
  const { register, signInWithGoogle, signInWithApple, isLoading } = useAuthStore();
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.password) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (formData.password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (!acceptedTerms) {
      toast.error("Please accept the terms and conditions");
      return;
    }

    setIsSubmitting(true);
    try {
      await register({
        email: formData.email,
        password: formData.password,
        name: `${formData.firstName} ${formData.lastName}`, // Better Auth uses name field
        firstName: formData.firstName,
        lastName: formData.lastName,
        role: 'user', // Default role for student registration
      });

      // Better Auth should send verification email on signup (sendOnSignUp: true)
      // But let's also explicitly send one to be sure
      try {
        await authService.sendVerificationEmailByEmail(formData.email);
      } catch (emailError) {
        // Better Auth might have already sent it, so don't fail if this errors
        console.log("Additional verification email request:", emailError);
      }

      // Store email for the verify-email page
      sessionStorage.setItem("pendingVerificationEmail", formData.email);
      
      toast.success("Account created! Please check your email to verify your account.");
      // Redirect to email verification page
      router.push("/auth/verify-email");
    } catch (error: any) {
      toast.error(error?.message || "Registration failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
      // OAuth will redirect automatically, handle callback in middleware or callback page
    } catch (error: any) {
      toast.error(error?.message || "Failed to sign in with Google");
    }
  };

  const handleAppleSignIn = async () => {
    try {
      await signInWithApple();
      // OAuth will redirect automatically, handle callback in middleware or callback page
    } catch (error: any) {
      toast.error(error?.message || "Failed to sign in with Apple");
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Status Bar Space */}
      <div className="h-6"></div>

      <Header showBack title="Sign Up" />

      <div className="max-w-md mx-auto px-4 py-8 md:max-w-lg md:px-8">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
            Create your account
          </h1>
          <p className="text-base text-gray-600">
            Start your English learning journey today
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <Input
              type="text"
              name="firstName"
              label="First Name *"
              placeholder="Enter your first name"
              value={formData.firstName}
              onChange={handleChange}
              disabled={isSubmitting || isLoading}
              required
              icon={<User className="w-5 h-5 text-gray-400" />}
            />
            <Input
              type="text"
              name="lastName"
              label="Last Name *"
              placeholder="Enter your last name"
              value={formData.lastName}
              onChange={handleChange}
              disabled={isSubmitting || isLoading}
              required
              icon={<User className="w-5 h-5 text-gray-400" />}
            />
          </div>

          <Input
            type="email"
            name="email"
            label="Email *"
            placeholder="Enter your email"
            value={formData.email}
            onChange={handleChange}
            disabled={isSubmitting || isLoading}
            required
            icon={<Mail className="w-5 h-5 text-gray-400" />}
          />

          <Input
            type="password"
            name="password"
            label="Password *"
            placeholder="Create a password (min. 8 characters)"
            value={formData.password}
            onChange={handleChange}
            disabled={isSubmitting || isLoading}
            required
            minLength={8}
            icon={<Lock className="w-5 h-5 text-gray-400" />}
          />

          <Input
            type="password"
            name="confirmPassword"
            label="Confirm Password *"
            placeholder="Confirm your password"
            value={formData.confirmPassword}
            onChange={handleChange}
            disabled={isSubmitting || isLoading}
            required
            icon={<Lock className="w-5 h-5 text-gray-400" />}
          />

          <div className="flex items-start gap-2">
            <input
              type="checkbox"
              className="mt-1 w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              disabled={isSubmitting || isLoading}
            />
            <p className="text-sm text-gray-600">
              I agree to the{" "}
              <Link href="/terms" className="text-green-600 hover:text-green-700">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="text-green-600 hover:text-green-700">
                Privacy Policy
              </Link>
            </p>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            disabled={isSubmitting || isLoading}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Creating account...
              </>
            ) : (
              "Create Account"
            )}
          </Button>
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Or continue with</span>
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
              className="gap-3"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </Button>
          </div>

          <p className="text-center text-sm text-gray-600">
            Already have an account?{" "}
            <Link
              href="/auth/login"
              className="text-green-600 font-semibold hover:text-green-700"
            >
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}

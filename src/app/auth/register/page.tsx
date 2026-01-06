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
      });

      toast.success("Account created successfully! Please verify your email.");
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

"use client";

import { Button } from "@/components/ui/Button";
import Link from "next/link";
import Image from "next/image";

export default function WelcomePage() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Status Bar Space */}
      <div className="h-6"></div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        {/* Logo */}
        <div className="mb-8">
          <Image
            src="/logo2.png"
            alt="eklan Logo"
            width={56}
            height={56}
            className="rounded-xl shadow-lg"
          />
        </div>

        {/* Welcome Text */}
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
            Welcome to eklan AI
          </h1>
          <p className="text-base md:text-lg text-gray-700">
            Let&apos;s make English speaking feel natural.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="w-full max-w-sm space-y-4">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            className="gap-3"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M2.5 5L10 10L17.5 5M2.5 15H17.5V7.5H2.5V15Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Continue with Email
          </Button>

          <Button
            variant="outline"
            size="lg"
            fullWidth
            className="gap-3"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M10 2C5.58 2 2 5.58 2 10C2 14.42 5.58 18 10 18C14.42 18 18 14.42 18 10C18 5.58 14.42 2 10 2ZM10 15C8.9 15 8 14.1 8 13C8 11.9 8.9 11 10 11C11.1 11 12 11.9 12 13C12 14.1 11.1 15 10 15ZM10 9C9.45 9 9 8.55 9 8C9 7.45 9.45 7 10 7C10.55 7 11 7.45 11 8C11 8.55 10.55 9 10 9Z"
                fill="currentColor"
              />
            </svg>
            Continue with Google
          </Button>

          <Button
            variant="secondary"
            size="lg"
            fullWidth
            className="gap-3"
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

        {/* Privacy Note */}
        <p className="mt-8 text-sm text-gray-600 text-center max-w-sm">
          We&apos;ll never post or share anything without permission.
        </p>
      </div>

      {/* Home Indicator */}
      <div className="h-1 w-32 bg-black rounded-full mx-auto mb-2 opacity-30"></div>
    </div>
  );
}

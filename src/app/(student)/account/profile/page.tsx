"use client";

import { BottomNav } from "@/components/layout/BottomNav";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Header } from "@/components/layout/Header";
import { Settings, TrendingUp, Mic, Clock, Calendar, Flame, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useAuthStore } from "@/store/auth-store";
import { getUserInitials, getUserDisplayName } from "@/utils/user";
import Image from "next/image";

export default function ProfilePage() {
  const { user } = useAuthStore();
  const initials = getUserInitials(user);
  const displayName = getUserDisplayName(user);
  const userEmail = user?.email || "";

  return (
    <div className="min-h-screen bg-white pb-20 md:pb-0">
      {/* Status Bar Space */}
      <div className="h-6"></div>

      {/* Green Header Section */}
      <div className="bg-gradient-to-br from-green-600 to-green-700 text-white pt-4 pb-8 md:pt-8 md:pb-12">
        <div className="max-w-md mx-auto px-4 md:max-w-4xl md:px-8">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-xl md:text-2xl font-bold">Profile</h1>
            <Link href="/account/settings">
              <Settings className="w-6 h-6 text-white" />
            </Link>
          </div>

          {/* User Info */}
          <div className="flex items-center gap-4">
            {user?.avatar ? (
              <div className="w-20 h-20 md:w-24 md:h-24 rounded-full overflow-hidden border-4 border-white">
                <Image
                  src={user.avatar}
                  alt={displayName}
                  width={96}
                  height={96}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-gradient-to-br from-pink-400 via-purple-400 to-blue-400 flex items-center justify-center text-3xl md:text-4xl font-bold text-white">
                {initials}
              </div>
            )}
            <div>
              <h2 className="text-xl md:text-2xl font-bold mb-1">
                {displayName}
              </h2>
              <p className="text-green-100 text-sm md:text-base mb-2">
                {userEmail}
              </p>
              <span className="inline-block bg-orange-200 text-gray-800 px-3 py-1 rounded-full text-xs font-semibold">
                Freemium
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-md mx-auto px-4 py-6 md:max-w-4xl md:px-8 -mt-6 md:-mt-8">
        {/* Key Metrics */}
        <div className="grid grid-cols-3 gap-3 md:gap-4 mb-6">
          <Card className="text-center">
            <div className="flex justify-center mb-2">
              <TrendingUp className="w-8 h-8 text-yellow-600" />
            </div>
            <p className="text-2xl md:text-3xl font-bold text-gray-900">+12%</p>
            <p className="text-xs md:text-sm text-gray-500">Confidence</p>
          </Card>
          <Card className="text-center">
            <div className="flex justify-center mb-2">
              <Mic className="w-8 h-8 text-green-600" />
            </div>
            <p className="text-2xl md:text-3xl font-bold text-gray-900">+9%</p>
            <p className="text-xs md:text-sm text-gray-500">Pronunciation</p>
          </Card>
          <Card className="text-center">
            <div className="flex justify-center mb-2">
              <Clock className="w-8 h-8 text-blue-600" />
            </div>
            <p className="text-2xl md:text-3xl font-bold text-gray-900">145m</p>
            <p className="text-xs md:text-sm text-gray-500">Time Studied</p>
          </Card>
        </div>

        {/* Current Plan */}
        <Card className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <span className="bg-green-600 text-white px-3 py-1 rounded-full text-xs font-semibold">
              Current Plan
            </span>
            <ChevronRight className="w-5 h-5 text-green-600" />
          </div>
          <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">
            Freemium
          </h3>
          <p className="text-sm md:text-base text-gray-600">
            Your current subscription expires on{" "}
            <span className="text-green-600 font-semibold">03 Dec 2025</span>
          </p>
        </Card>

        {/* Streak Section */}
        <Card className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg md:text-xl font-bold text-gray-900">Streak</h3>
            <Link
              href="/streak"
              className="text-green-600 flex items-center gap-1 text-sm"
            >
              <Calendar className="w-4 h-4" />
              <span>calendar</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-base font-semibold text-gray-900">
                30 Days challenge
              </h4>
              <span className="text-sm text-gray-500">Day 22 of 30</span>
            </div>

            {/* Timeline */}
            <div className="flex items-center gap-2 mb-4">
              <div className="flex-1 flex items-center">
                <div className="w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center border-2 border-yellow-500">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M13 4L6 11L3 8"
                      stroke="white"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <div className="flex-1 h-1 bg-yellow-400"></div>
              </div>
              <div className="w-10 h-10 bg-yellow-400 rounded-full flex items-center justify-center border-4 border-yellow-500 shadow-lg">
                <span className="text-sm font-bold text-gray-900">22</span>
              </div>
              <div className="flex-1 flex items-center">
                <div className="flex-1 h-1 bg-gray-200"></div>
                <div className="w-8 h-8 bg-gray-200 rounded-full border-2 border-gray-300"></div>
              </div>
            </div>

            <div className="bg-yellow-50 rounded-lg p-4 mb-4">
              <p className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <Flame className="w-4 h-4 text-yellow-600" /> Just 4 days left!
              </p>
              <p className="text-xs md:text-sm text-gray-600">
                Keep your daily learning streak going and earn a badge when you
                practice or complete a lesson every day.
              </p>
            </div>

            <Button variant="primary" size="lg" fullWidth>
              Continue Practice
            </Button>
          </div>
        </Card>
      </div>

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
}


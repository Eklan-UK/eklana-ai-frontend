"use client";

import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { FileText, ChevronRight } from "lucide-react";
import Link from "next/link";

export default function SettingsTermsPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Status Bar Space */}
      <div className="h-6"></div>

      <Header showBack title="Terms of Use" />

      <div className="max-w-md mx-auto px-4 py-6 md:max-w-3xl md:px-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <FileText className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
                Terms of Use
              </h1>
              <p className="text-sm text-gray-500">Last updated: December 2024</p>
            </div>
          </div>
          <p className="text-base text-gray-600">
            Please read these terms carefully before using Eklan.
          </p>
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Link href="/terms">
            <Card className="hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-green-600" />
                  <span className="text-base font-medium text-gray-900">
                    Full Terms of Use
                  </span>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </div>
            </Card>
          </Link>
          <Link href="/contact">
            <Card className="hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-blue-600" />
                  <span className="text-base font-medium text-gray-900">
                    Questions?
                  </span>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </div>
            </Card>
          </Link>
        </div>

        {/* Key Points */}
        <Card className="bg-green-50 border-green-200 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Important Terms
          </h2>
          <ul className="space-y-3">
            <li className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  Account Responsibility
                </p>
                <p className="text-xs text-gray-600">
                  You are responsible for maintaining the security of your
                  account.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  Acceptable Use
                </p>
                <p className="text-xs text-gray-600">
                  Use the service in accordance with our guidelines and
                  applicable laws.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  Subscription Terms
                </p>
                <p className="text-xs text-gray-600">
                  Subscriptions auto-renew unless cancelled. You can cancel
                  anytime.
                </p>
              </div>
            </li>
          </ul>
        </Card>

        {/* Full Terms Link */}
        <Card className="bg-blue-50 border-blue-200">
          <div className="text-center py-4">
            <p className="text-sm font-semibold text-gray-900 mb-2">
              Read the full Terms of Use
            </p>
            <Link href="/terms">
              <button className="text-sm text-green-600 font-medium underline inline-flex items-center gap-1">
                View Complete Terms
                <ChevronRight className="w-4 h-4" />
              </button>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}


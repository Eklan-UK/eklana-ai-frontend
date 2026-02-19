"use client";

import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { FileText, ChevronRight } from "lucide-react";

export default function TermsPage() {
  const sections = [
    {
      title: "1. Acceptance of Terms",
      content:
        "By accessing and using Eklan, you accept and agree to be bound by the terms and provision of this agreement.",
    },
    {
      title: "2. Use License",
      content:
        "Permission is granted to temporarily use Eklan for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title, and under this license you may not: modify or copy the materials; use the materials for any commercial purpose; attempt to decompile or reverse engineer any software; remove any copyright or other proprietary notations from the materials.",
    },
    {
      title: "3. User Account",
      content:
        "You are responsible for maintaining the confidentiality of your account and password. You agree to accept responsibility for all activities that occur under your account or password.",
    },
    {
      title: "4. Privacy Policy",
      content:
        "Your use of Eklan is also governed by our Privacy Policy. Please review our Privacy Policy to understand our practices.",
    },
    {
      title: "5. Subscription and Payment",
      content:
        "If you purchase a subscription, you agree to pay the fees specified. Subscriptions automatically renew unless cancelled. You may cancel your subscription at any time through your account settings.",
    },
    {
      title: "6. Content and Intellectual Property",
      content:
        "All content, features, and functionality of Eklan are owned by Eklan and are protected by international copyright, trademark, and other intellectual property laws.",
    },
    {
      title: "7. User Conduct",
      content:
        "You agree not to use Eklan to: violate any laws; infringe upon the rights of others; transmit any harmful code; interfere with the service; or engage in any fraudulent activity.",
    },
    {
      title: "8. Limitation of Liability",
      content:
        "Eklan shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of or inability to use the service.",
    },
    {
      title: "9. Changes to Terms",
      content:
        "We reserve the right to modify these terms at any time. We will notify users of any changes by posting the new terms on this page.",
    },
    {
      title: "10. Contact Information",
      content:
        "If you have any questions about these Terms of Use, please contact us at hello@eklan.ai.ai.",
    },
  ];

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

        {/* Terms Sections */}
        <div className="space-y-4 mb-8">
          {sections.map((section, index) => (
            <Card key={index} className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">
                {section.title}
              </h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                {section.content}
              </p>
            </Card>
          ))}
        </div>

        {/* Agreement */}
        <Card className="bg-green-50 border-green-200 mb-6">
          <div className="flex items-start gap-3">
            <FileText className="w-6 h-6 text-green-600 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-gray-900 mb-1">
                Agreement to Terms
              </p>
              <p className="text-xs text-gray-600">
                By using Eklan, you acknowledge that you have read, understood, and agree to be bound by these Terms of Use.
              </p>
            </div>
          </div>
        </Card>

        {/* Contact */}
        <Card className="bg-blue-50 border-blue-200">
          <div className="text-center py-4">
            <p className="text-sm font-semibold text-gray-900 mb-2">
              Questions about our Terms?
            </p>
            <a
              href="/contact"
              className="text-sm text-green-600 font-medium underline inline-flex items-center gap-1"
            >
              Contact our support team
              <ChevronRight className="w-4 h-4" />
            </a>
          </div>
        </Card>
      </div>
    </div>
  );
}


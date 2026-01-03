"use client";

import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { Shield, ChevronRight } from "lucide-react";

export default function PrivacyPage() {
  const sections = [
    {
      title: "1. Information We Collect",
      content:
        "We collect information you provide directly to us, such as when you create an account, use our services, or contact us. This may include your name, email address, voice recordings, and learning progress data.",
    },
    {
      title: "2. How We Use Your Information",
      content:
        "We use the information we collect to provide, maintain, and improve our services, personalize your learning experience, process transactions, send you updates, and respond to your inquiries.",
    },
    {
      title: "3. Information Sharing",
      content:
        "We do not sell your personal information. We may share your information only with service providers who assist us in operating our platform, and only as necessary to provide our services.",
    },
    {
      title: "4. Data Security",
      content:
        "We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction.",
    },
    {
      title: "5. Your Rights",
      content:
        "You have the right to access, update, or delete your personal information at any time through your account settings. You may also request a copy of your data or object to certain processing activities.",
    },
    {
      title: "6. Cookies and Tracking",
      content:
        "We use cookies and similar tracking technologies to track activity on our service and hold certain information. You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent.",
    },
    {
      title: "7. Children's Privacy",
      content:
        "Our service is not intended for children under 13. We do not knowingly collect personal information from children under 13. If you are a parent or guardian, please contact us if you believe your child has provided us with personal information.",
    },
    {
      title: "8. Changes to This Policy",
      content:
        "We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the 'Last updated' date.",
    },
    {
      title: "9. Contact Us",
      content:
        "If you have any questions about this Privacy Policy, please contact us at privacy@eklan.ai.",
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Status Bar Space */}
      <div className="h-6"></div>

      <Header showBack title="Privacy Policy" />

      <div className="max-w-md mx-auto px-4 py-6 md:max-w-3xl md:px-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <Shield className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
                Privacy Policy
              </h1>
              <p className="text-sm text-gray-500">Last updated: December 2024</p>
            </div>
          </div>
          <p className="text-base text-gray-600">
            Your privacy is important to us. This policy explains how we collect, use, and protect your information.
          </p>
        </div>

        {/* Privacy Sections */}
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

        {/* Data Protection Notice */}
        <Card className="bg-blue-50 border-blue-200 mb-6">
          <div className="flex items-start gap-3">
            <Shield className="w-6 h-6 text-blue-600 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-gray-900 mb-1">
                Your Data is Protected
              </p>
              <p className="text-xs text-gray-600">
                We are committed to protecting your privacy and ensuring the security of your personal information.
              </p>
            </div>
          </div>
        </Card>

        {/* Contact */}
        <Card className="bg-green-50 border-green-200">
          <div className="text-center py-4">
            <p className="text-sm font-semibold text-gray-900 mb-2">
              Questions about Privacy?
            </p>
            <a
              href="/contact"
              className="text-sm text-green-600 font-medium underline inline-flex items-center gap-1"
            >
              Contact our privacy team
              <ChevronRight className="w-4 h-4" />
            </a>
          </div>
        </Card>
      </div>
    </div>
  );
}


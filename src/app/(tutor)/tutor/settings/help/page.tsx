"use client";

import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { HelpCircle, Mail, MessageCircle, ExternalLink } from "lucide-react";

export default function TutorHelpPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="h-6" />
      <Header showBack title="Help & Support" />

      <div className="max-w-4xl mx-auto px-4 py-6 md:px-8 space-y-4">
        <Card className="p-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
              <HelpCircle className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900 mb-1">
                Tutor resources
              </h2>
              <p className="text-sm text-gray-600">
                Manage classes, availability, drills, and students from the
                dashboard and sidebar. Connect Google Calendar under Settings so
                admins can schedule sessions for you.
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center shrink-0">
              <Mail className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900 mb-1">Contact</h2>
              <p className="text-sm text-gray-600 mb-3">
                Need help from our team? Send us a message.
              </p>
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 text-sm font-semibold text-green-600 hover:text-green-700"
              >
                <MessageCircle className="w-4 h-4" />
                Contact us
                <ExternalLink className="w-3 h-3 opacity-70" />
              </Link>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

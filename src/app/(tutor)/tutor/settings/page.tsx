"use client";

import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import {
  User,
  Bell,
  Shield,
  HelpCircle,
  LogOut,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";

export default function TutorSettingsPage() {
  const settingsSections = [
    {
      title: "Account",
      items: [
        {
          icon: User,
          label: "Profile Settings",
          href: "/tutor/settings/profile",
          description: "Update your personal information",
        },
      ],
    },
    {
      title: "Preferences",
      items: [
        {
          icon: Bell,
          label: "Notifications",
          href: "/tutor/settings/notifications",
          description: "Manage notification preferences",
        },
      ],
    },
    {
      title: "Support",
      items: [
        {
          icon: HelpCircle,
          label: "Help & Support",
          href: "/tutor/settings/help",
          description: "Get help and contact support",
        },
        {
          icon: Shield,
          label: "Privacy Policy",
          href: "/privacy",
          description: "Read our privacy policy",
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="h-6"></div>

      <Header title="Settings" />

      <div className="max-w-4xl mx-auto px-4 py-6 md:px-8">
        {settingsSections.map((section, sectionIndex) => (
          <div key={sectionIndex} className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">
              {section.title}
            </h2>
            <div className="space-y-2">
              {section.items.map((item, itemIndex) => {
                const Icon = item.icon;
                return (
                  <Link key={itemIndex} href={item.href}>
                    <Card className="hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                            <Icon className="w-5 h-5 text-gray-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900">
                              {item.label}
                            </h3>
                            <p className="text-sm text-gray-600">
                              {item.description}
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}

        {/* Logout */}
        <div className="mt-8">
          <Card className="border-red-200">
            <button className="w-full flex items-center justify-between p-4 hover:bg-red-50 transition">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                  <LogOut className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-red-600">Logout</h3>
                  <p className="text-sm text-gray-600">Sign out of your account</p>
                </div>
              </div>
            </button>
          </Card>
        </div>
      </div>
    </div>
  );
}


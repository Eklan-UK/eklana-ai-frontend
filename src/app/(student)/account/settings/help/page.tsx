"use client";

import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  HelpCircle,
  MessageCircle,
  Mail,
  Book,
  Video,
  FileText,
  ChevronRight,
  Search,
} from "lucide-react";
import Link from "next/link";

export default function HelpPage() {
  const [searchQuery, setSearchQuery] = useState("");

  const helpCategories = [
    {
      title: "Getting Started",
      icon: Book,
      items: [
        "How to create an account",
        "Setting up your profile",
        "Your first practice session",
        "Understanding your progress",
      ],
    },
    {
      title: "Practice & Lessons",
      icon: Video,
      items: [
        "How to practice pronunciation",
        "Using AI conversations",
        "Completing listening exercises",
        "Tracking your progress",
      ],
    },
    {
      title: "Account & Settings",
      icon: FileText,
      items: [
        "Managing your subscription",
        "Changing your password",
        "Updating your profile",
        "Privacy settings",
      ],
    },
  ];

  const quickLinks = [
    {
      title: "FAQ",
      description: "Frequently asked questions",
      href: "/faq",
      icon: HelpCircle,
    },
    {
      title: "Contact Support",
      description: "Get help from our team",
      href: "/contact",
      icon: MessageCircle,
    },
    {
      title: "Email Us",
      description: "support@eklan.ai",
      href: "mailto:support@eklan.ai",
      icon: Mail,
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Status Bar Space */}
      <div className="h-6"></div>

      <Header showBack title="Help & Support" />

      <div className="max-w-md mx-auto px-4 py-6 md:max-w-2xl md:px-8">
        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for help..."
              className="w-full pl-12 pr-4 py-3 rounded-xl border-2 border-gray-200 focus:outline-none focus:border-green-600"
            />
          </div>
        </div>

        {/* Quick Links */}
        <div className="mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Quick Links</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {quickLinks.map((link, index) => {
              const Icon = link.icon;
              return (
                <Link key={index} href={link.href}>
                  <Card className="hover:shadow-md transition-shadow h-full">
                    <div className="text-center py-4">
                      <div className="w-12 h-12 mx-auto bg-green-100 rounded-xl flex items-center justify-center mb-3">
                        <Icon className="w-6 h-6 text-green-600" />
                      </div>
                      <h3 className="text-sm font-semibold text-gray-900 mb-1">
                        {link.title}
                      </h3>
                      <p className="text-xs text-gray-500">{link.description}</p>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Help Categories */}
        <div className="mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">
            Help Topics
          </h2>
          <div className="space-y-4">
            {helpCategories.map((category, index) => {
              const Icon = category.icon;
              return (
                <Card key={index}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Icon className="w-5 h-5 text-blue-600" />
                    </div>
                    <h3 className="text-base font-semibold text-gray-900">
                      {category.title}
                    </h3>
                  </div>
                  <ul className="space-y-2">
                    {category.items.map((item, itemIndex) => (
                      <li key={itemIndex}>
                        <button className="w-full text-left flex items-center justify-between py-2 hover:bg-gray-50 rounded-lg px-2 -mx-2">
                          <span className="text-sm text-gray-600">{item}</span>
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Contact Card */}
        <Card className="bg-green-50 border-green-200">
          <div className="text-center py-4">
            <MessageCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-gray-900 mb-1">
              Still need help?
            </p>
            <p className="text-xs text-gray-600 mb-3">
              Our support team is here to assist you 24/7
            </p>
            <Link href="/contact">
              <Button variant="primary" size="sm">
                Contact Support
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}


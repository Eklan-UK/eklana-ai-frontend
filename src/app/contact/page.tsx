"use client";

import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Mail } from "lucide-react";

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  return (
    <div className="min-h-screen bg-white">
      {/* Status Bar Space */}
      <div className="h-6"></div>

      <Header showBack title="Contact Us" />

      <div className="max-w-md mx-auto px-4 py-8 md:max-w-2xl md:px-8">
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
            We&apos;d love to hear from you
          </h1>
          <p className="text-base text-gray-600">
            Have a question or feedback? Send us a message!
          </p>
        </div>

        <div className="space-y-6">
          <Input
            type="text"
            label="Your Name"
            placeholder="Enter your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <Input
            type="email"
            label="Email"
            placeholder="your.email@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Message
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Tell us what's on your mind..."
              rows={6}
              className="w-full rounded-xl border-2 border-[#22c55e] px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#22c55e] focus:ring-offset-2"
            />
          </div>

          <Card className="bg-blue-50 border-blue-200">
            <div className="flex items-start gap-3">
              <Mail className="w-6 h-6 text-blue-600 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-gray-900 mb-1">
                  Email Support
                </p>
                <p className="text-xs text-gray-600">
                  hello@eklan.ai
                </p>
              </div>
            </div>
          </Card>

          <Button variant="primary" size="lg" fullWidth>
            Send Message
          </Button>
        </div>
      </div>
    </div>
  );
}


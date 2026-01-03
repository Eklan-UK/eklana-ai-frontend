"use client";

import { BottomNav } from "@/components/layout/BottomNav";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  Mic,
  MessageCircle,
  Headphones,
  ChevronRight,
  Bot,
} from "lucide-react";
import Link from "next/link";

export default function PracticePage() {
  return (
    <div className="min-h-screen bg-white pb-20 md:pb-0">
      {/* Status Bar Space */}
      <div className="h-6"></div>

      <Header title="Practice" />

      <div className="max-w-md mx-auto px-4 py-6 md:max-w-4xl md:px-8">
        {/* Practice Categories */}
        <div className="space-y-4 mb-8">
          <Link href="/account/practice/pronunciation">
            <Card className="hover:shadow-md transition-shadow">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Mic className="w-8 h-8 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900 mb-1">
                    Pronunciation
                  </h3>
                  <p className="text-sm text-gray-600">
                    Practice your pronunciation skills
                  </p>
                </div>
                <ChevronRight className="w-6 h-6 text-gray-400" />
              </div>
            </Card>
          </Link>

          <Link href="/account/practice/speaking">
            <Card className="hover:shadow-md transition-shadow">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-green-100 rounded-xl flex items-center justify-center">
                  <MessageCircle className="w-8 h-8 text-green-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900 mb-1">
                    Speaking Scenarios
                  </h3>
                  <p className="text-sm text-gray-600">
                    Practice real-world conversations
                  </p>
                </div>
                <ChevronRight className="w-6 h-6 text-gray-400" />
              </div>
            </Card>
          </Link>

          <Link href="/account/practice/listening">
            <Card className="hover:shadow-md transition-shadow">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-purple-100 rounded-xl flex items-center justify-center">
                  <Headphones className="w-8 h-8 text-purple-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900 mb-1">
                    Listening Exercises
                  </h3>
                  <p className="text-sm text-gray-600">
                    Improve your listening comprehension
                  </p>
                </div>
                <ChevronRight className="w-6 h-6 text-gray-400" />
              </div>
            </Card>
          </Link>

          <Link href="/account/practice/ai">
            <Card className="hover:shadow-md transition-shadow border-2 border-green-200">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-gradient-to-br from-green-100 to-blue-100 rounded-xl flex items-center justify-center">
                  <Bot className="w-8 h-8 text-green-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900 mb-1">
                    AI Conversation
                  </h3>
                  <p className="text-sm text-gray-600">
                    Practice with AI-powered conversations
                  </p>
                </div>
                <ChevronRight className="w-6 h-6 text-gray-400" />
              </div>
            </Card>
          </Link>
        </div>

        {/* Note about drills */}
        <Card className="bg-blue-50 border-blue-200 mb-6">
          <p className="text-sm text-blue-800">
            💡 <strong>Tip:</strong> Check your assigned drills on the home page. Each drill has a unique interface designed for its specific practice type.
          </p>
        </Card>
      </div>

      <BottomNav />
    </div>
  );
}

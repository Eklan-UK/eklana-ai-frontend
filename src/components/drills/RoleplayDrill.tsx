"use client";

import { useState, useEffect, useRef } from "react";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TTSButton } from "@/components/ui/TTSButton";
import { CheckCircle, Loader2, MessageCircle, User, Bot, Send, Mic } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { drillAPI } from "@/lib/api";

interface RoleplayDrillProps {
  drill: any;
  assignmentId?: string;
}

interface Message {
  id: string;
  speaker: string;
  text: string;
  translation?: string;
  timestamp: Date;
}

export default function RoleplayDrill({ drill, assignmentId }: RoleplayDrillProps) {
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [userInput, setUserInput] = useState("");
  const [currentDialogueIndex, setCurrentDialogueIndex] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [startTime] = useState(Date.now());
  const [isRecording, setIsRecording] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scenes = drill.roleplay_scenes || (drill.roleplay_dialogue ? [{ dialogue: drill.roleplay_dialogue }] : []);
  const currentScene = scenes[currentSceneIndex];
  const dialogue = currentScene?.dialogue || [];
  const studentCharacter = drill.student_character_name || "You";
  const aiCharacters = drill.ai_character_names || ["AI"];

  useEffect(() => {
    // Initialize with first AI message if available
    if (dialogue.length > 0 && dialogue[0].speaker !== "student") {
      const firstMessage = dialogue[0];
      setMessages([{
        id: `msg-0`,
        speaker: firstMessage.speaker,
        text: firstMessage.text,
        translation: firstMessage.translation,
        timestamp: new Date(),
      }]);
      setCurrentDialogueIndex(1);
    }
  }, [dialogue]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const getSpeakerName = (speaker: string) => {
    if (speaker === "student") return studentCharacter;
    const aiIndex = parseInt(speaker.replace("ai_", "")) || 0;
    return aiCharacters[aiIndex] || "AI";
  };

  const handleSendMessage = () => {
    if (!userInput.trim()) {
      toast.error("Please enter a message");
      return;
    }

    // Add user message
    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      speaker: "student",
      text: userInput,
      timestamp: new Date(),
    };
    setMessages([...messages, userMessage]);
    setUserInput("");

    // Find next AI response
    const nextDialogue = dialogue[currentDialogueIndex];
    if (nextDialogue && nextDialogue.speaker !== "student") {
      setTimeout(() => {
        const aiMessage: Message = {
          id: `msg-${Date.now() + 1}`,
          speaker: nextDialogue.speaker,
          text: nextDialogue.text,
          translation: nextDialogue.translation,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, aiMessage]);
        setCurrentDialogueIndex(prev => prev + 1);
      }, 1000);
    } else {
      // Check if conversation is complete
      if (currentDialogueIndex >= dialogue.length - 1) {
        setTimeout(() => {
          toast.success("Great conversation! You can review and submit.");
        }, 500);
      } else {
        setCurrentDialogueIndex(prev => prev + 1);
      }
    }
  };

  const handleSubmit = async () => {
    if (!assignmentId) {
      toast.error("Assignment ID is missing. Cannot submit drill.");
      return;
    }

    if (messages.length < 2) {
      toast.error("Please have at least a brief conversation before submitting");
      return;
    }

    setIsSubmitting(true);
    try {
      const timeSpent = Math.floor((Date.now() - startTime) / 1000);
      // Score based on participation (basic scoring)
      const userMessages = messages.filter(m => m.speaker === "student").length;
      const score = Math.min(100, Math.round((userMessages / dialogue.length) * 100));

      await drillAPI.complete(drill._id, {
        drillAssignmentId: assignmentId,
        score,
        timeSpent,
        roleplayResults: {
          scene: currentSceneIndex,
          messages: messages.map(m => ({
            speaker: m.speaker,
            text: m.text,
            timestamp: m.timestamp.toISOString(),
          })),
          totalMessages: messages.length,
        },
        platform: 'web',
      });

      setIsCompleted(true);
      toast.success("Drill completed! Great job!");

      try {
        await fetch('/api/v1/activities/recent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            type: 'drill',
            resourceId: drill._id,
            action: 'completed',
            metadata: { title: drill.title, type: drill.type, score },
          }),
        });
      } catch (error) {
        console.error('Failed to track activity:', error);
      }
    } catch (error: any) {
      toast.error("Failed to submit drill: " + (error.message || "Unknown error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isCompleted) {
    return (
      <div className="min-h-screen bg-white pb-20 md:pb-0">
        <div className="h-6"></div>
        <Header title="Drill Completed" />
        <div className="max-w-md mx-auto px-4 py-6">
          <Card className="text-center py-8">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Great Job!</h2>
            <p className="text-gray-600 mb-6">You've completed the roleplay drill.</p>
            <Link href="/account">
              <Button variant="primary" size="lg" fullWidth>Continue Learning</Button>
            </Link>
          </Card>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 pb-20 md:pb-0">
      <div className="h-6"></div>
      <Header title={drill.title} />
      
      <div className="max-w-2xl mx-auto px-4 py-6 h-[calc(100vh-120px)] flex flex-col">
        {/* Context */}
        {drill.context && (
          <Card className="mb-4 bg-green-50 border-green-200">
            <div className="flex items-start gap-2">
              <MessageCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-green-900 mb-1">Scenario</p>
                <p className="text-sm text-green-800">{drill.context}</p>
              </div>
            </div>
          </Card>
        )}

        {/* Scene Info */}
        {currentScene?.scene_name && (
          <Card className="mb-4 bg-white/80 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 mb-1">Current Scene</p>
                <p className="text-sm font-semibold text-gray-900">{currentScene.scene_name}</p>
              </div>
              <div className="text-xs text-gray-500">
                Scene {currentSceneIndex + 1} of {scenes.length}
              </div>
            </div>
          </Card>
        )}

        {/* Chat Messages */}
        <Card className="flex-1 mb-4 bg-white/90 backdrop-blur-sm shadow-lg overflow-hidden flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-green-500" />
              Conversation
            </h3>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <MessageCircle className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                <p>Start the conversation by sending a message!</p>
              </div>
            ) : (
              messages.map((message) => {
                const isUser = message.speaker === "student";
                return (
                  <div
                    key={message.id}
                    className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl p-4 ${
                        isUser
                          ? "bg-gradient-to-r from-green-500 to-emerald-500 text-white"
                          : "bg-gray-100 text-gray-900"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {isUser ? (
                          <User className="w-4 h-4" />
                        ) : (
                          <Bot className="w-4 h-4" />
                        )}
                        <span className="text-xs font-semibold opacity-90">
                          {getSpeakerName(message.speaker)}
                        </span>
                      </div>
                      <p className="text-sm">{message.text}</p>
                      {message.translation && (
                        <p className={`text-xs mt-2 opacity-75 ${isUser ? "text-green-100" : "text-gray-600"}`}>
                          {message.translation}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>
        </Card>

        {/* Input Area */}
        <Card className="bg-white/90 backdrop-blur-sm shadow-lg">
          <div className="flex gap-2">
            <div className="flex-1">
              <textarea
                className="w-full p-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all resize-none"
                rows={2}
                placeholder="Type your message..."
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Button
                variant="primary"
                size="md"
                onClick={handleSendMessage}
                disabled={!userInput.trim()}
                className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 h-full"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
          
          {/* Submit Button */}
          {messages.length >= 2 && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <Button
                variant="primary"
                size="md"
                fullWidth
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Complete Conversation"
                )}
              </Button>
            </div>
          )}
        </Card>
      </div>
      
      <BottomNav />
    </div>
  );
}

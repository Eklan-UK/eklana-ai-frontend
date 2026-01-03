"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Bot, MessageSquare, Mic, Send, Sparkles, Loader2, Volume2, VolumeX } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTTS } from "@/hooks/useTTS";
import { aiService } from "@/services/ai.service";
import { toast } from "sonner";
import { MarkdownText } from "@/components/ui/MarkdownText";

export default function AIPracticePage() {
  const [isRecording, setIsRecording] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [messages, setMessages] = useState<Array<{ type: "ai" | "user"; text: string; audioUrl?: string | null }>>([
    {
      type: "ai",
      text: "Hello! I'm your AI conversation partner. I'm here to help you practice English naturally. What would you like to talk about today?",
      audioUrl: null,
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [autoPlayAudio, setAutoPlayAudio] = useState(true);
  const [playingMessageIndex, setPlayingMessageIndex] = useState<number | null>(null);
  const router = useRouter();

  // TTS hook for AI responses
  const { playAudio, isGenerating: isGeneratingAudio, isPlaying, stopAudio } = useTTS({
    autoPlay: false, // We'll control playback manually
    onPlayStart: () => {
      // Audio started playing
    },
    onPlayEnd: () => {
      setPlayingMessageIndex(null);
    },
    onError: (error) => {
      console.error("TTS Error:", error);
      setPlayingMessageIndex(null);
    },
  });

  // Play initial greeting on mount
  useEffect(() => {
    if (messages[0]?.type === "ai" && autoPlayAudio) {
      setTimeout(() => {
        playAudio(messages[0].text);
        setPlayingMessageIndex(0);
      }, 300);
    }
  }, []); // Only on mount

  const handleSend = async () => {
    if (inputText.trim() && !isThinking) {
      const userMessage = { type: "user" as const, text: inputText, audioUrl: null };
      setMessages((prev) => [...prev, userMessage]);
      const currentInput = inputText;
      setInputText("");
      setIsThinking(true);

      try {
        // Convert messages to Gemini format
        const conversationHistory = messages.map((msg) => ({
          role: msg.type === "user" ? ("user" as const) : ("model" as const),
          content: msg.text,
        }));

        // Add current user message
        conversationHistory.push({
          role: "user" as const,
          content: currentInput,
        });

        // Get AI response
        const aiResponse = await aiService.sendConversationMessage({
          messages: conversationHistory,
          temperature: 0.7,
          maxTokens: 1000,
        });

        const aiMessage = {
          type: "ai" as const,
          text: aiResponse,
          audioUrl: null,
        };

        setMessages((prev) => {
          const newMessages = [...prev, aiMessage];
          // Auto-play the new AI response if enabled
          if (autoPlayAudio) {
            setTimeout(() => {
              playAudio(aiResponse);
              setPlayingMessageIndex(newMessages.length - 1);
            }, 300);
          }
          return newMessages;
        });
        setIsThinking(false);
      } catch (error: any) {
        console.error("Error getting AI response:", error);
        toast.error(error.message || "Failed to get AI response");
        setIsThinking(false);
        // Remove the user message if request failed
        setMessages((prev) => prev.slice(0, -1));
        setInputText(currentInput);
      }
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Status Bar Space */}
      <div className="h-6"></div>

      <Header showBack title="AI Conversation Practice" />

      <div className="max-w-md mx-auto px-4 py-6 md:max-w-2xl md:px-8">
        {/* AI Info Card */}
        <Card className="mb-6 bg-gradient-to-br from-green-50 to-blue-50">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <Bot className="w-6 h-6 text-green-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-semibold text-gray-900">
                AI Conversation Partner
              </h3>
              <p className="text-xs text-gray-600">
                Practice natural conversations with AI
              </p>
            </div>
            <div className="flex items-center gap-1 text-yellow-600">
              <Sparkles className="w-4 h-4" />
              <span className="text-xs font-semibold">AI</span>
            </div>
          </div>
        </Card>

        {/* Conversation Area */}
        <Card className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Conversation
            </h3>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <MessageSquare className="w-4 h-4" />
              <span>{messages.length} messages</span>
            </div>
          </div>

          {/* Messages */}
          <div className="space-y-4 mb-4 max-h-96 overflow-y-auto">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${
                  message.type === "ai" ? "justify-start" : "justify-end"
                }`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                    message.type === "ai"
                      ? "bg-gray-100 text-gray-900"
                      : "bg-green-600 text-white"
                  }`}
                >
                  {message.type === "ai" && (
                    <>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Bot className="w-4 h-4 text-green-600" />
                          <span className="text-xs font-semibold text-gray-500">
                            AI Partner
                          </span>
                        </div>
                        <button
                          onClick={() => {
                            if (playingMessageIndex === index && isPlaying) {
                              stopAudio();
                              setPlayingMessageIndex(null);
                            } else {
                              playAudio(message.text);
                              setPlayingMessageIndex(index);
                            }
                          }}
                          disabled={isGeneratingAudio}
                          className={`p-1 rounded transition disabled:opacity-50 ${
                            playingMessageIndex === index && isPlaying
                              ? "bg-red-100 hover:bg-red-200"
                              : "hover:bg-gray-200"
                          }`}
                          title={
                            playingMessageIndex === index && isPlaying
                              ? "Stop audio"
                              : "Play audio"
                          }
                        >
                          {isGeneratingAudio && playingMessageIndex === index ? (
                            <Loader2 className="w-3 h-3 text-gray-600 animate-spin" />
                          ) : playingMessageIndex === index && isPlaying ? (
                            <VolumeX className="w-3 h-3 text-red-600" />
                          ) : (
                            <Volume2 className="w-3 h-3 text-gray-600" />
                          )}
                        </button>
                      </div>
                      <div className="relative">
                        <MarkdownText className="text-sm leading-relaxed">
                          {message.text}
                        </MarkdownText>
                        {/* Visual indicator when this message is playing */}
                        {playingMessageIndex === index && isPlaying && (
                          <div className="mt-2 flex items-center gap-2 text-xs text-green-600">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                            <span>Speaking...</span>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                  {message.type === "user" && (
                    <p className="text-sm leading-relaxed">{message.text}</p>
                  )}
                </div>
              </div>
            ))}

            {/* Thinking Indicator */}
            {isThinking && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-2xl px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                    <span className="text-xs text-gray-500">AI is thinking...</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Recording Indicator */}
          {isRecording && (
            <div className="mb-4 flex items-center justify-center gap-2 bg-red-50 rounded-lg py-3">
              <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse"></div>
              <span className="text-sm font-semibold text-red-600">
                Recording your voice...
              </span>
            </div>
          )}

          {/* Input Area */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSend()}
              placeholder="Type your message..."
              className="flex-1 rounded-xl border-2 border-gray-200 px-4 py-2 focus:outline-none focus:border-green-600"
            />
            <button
              onClick={() => setIsRecording(!isRecording)}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                isRecording
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              <Mic className="w-6 h-6 text-white" />
            </button>
            <button
              onClick={handleSend}
              disabled={!inputText.trim() || isThinking}
              className="w-12 h-12 rounded-full bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
            >
              <Send className="w-6 h-6 text-white" />
            </button>
          </div>
        </Card>

        {/* Audio Settings */}
        <Card className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-gray-600" />
              <span className="text-sm font-medium text-gray-900">
                Auto-play AI responses
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={autoPlayAudio}
                onChange={(e) => setAutoPlayAudio(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
            </label>
          </div>
          {isGeneratingAudio && (
            <div className="mt-2 flex items-center gap-2 text-xs text-gray-600">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Generating audio...</span>
            </div>
          )}
        </Card>

        {/* Tips */}
        <Card className="mb-6 bg-blue-50 border-blue-200">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-gray-900 mb-1">
                AI Practice Tips
              </p>
              <ul className="text-xs text-gray-600 space-y-1">
                <li>• Speak naturally and at your own pace</li>
                <li>• Ask questions to keep the conversation going</li>
                <li>• The AI adapts to your level automatically</li>
                <li>• Toggle audio to hear AI responses</li>
              </ul>
            </div>
          </div>
        </Card>

        {/* Actions */}
        <div className="space-y-3">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={() => router.push("/account/practice/ai/completed")}
          >
            End Session
          </Button>
          <Button
            variant="outline"
            size="lg"
            fullWidth
            onClick={() => router.back()}
          >
            Back to Practice
          </Button>
        </div>
      </div>
    </div>
  );
}


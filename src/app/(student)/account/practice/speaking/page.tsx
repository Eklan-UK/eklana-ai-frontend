"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TTSButton } from "@/components/ui/TTSButton";
import { MarkdownText } from "@/components/ui/MarkdownText";
import { Mic, MessageSquare, Bot, User, Send, Pause, Briefcase, Utensils, ShoppingBag, Plane, Loader2, Volume2, VolumeX } from "lucide-react";
import { useRouter } from "next/navigation";
import { aiService } from "@/services/ai.service";
import { toast } from "sonner";
import { useTTS } from "@/hooks/useTTS";

export default function SpeakingPracticePage() {
  const [isRecording, setIsRecording] = useState(false);
  const [autoPlayAudio, setAutoPlayAudio] = useState(true);
  const [isThinking, setIsThinking] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);
  const [messages, setMessages] = useState<Array<{ type: "ai" | "user"; text: string }>>([]);
  const [inputText, setInputText] = useState("");
  const [playingMessageIndex, setPlayingMessageIndex] = useState<number | null>(null);
  const router = useRouter();

  // TTS hook for AI responses
  const { playAudio, isGenerating: isGeneratingAudio, isPlaying, stopAudio } = useTTS({
    autoPlay: true, // Enable auto-play so audio plays when playAudio is called
    onPlayStart: () => {
      // Audio started
      console.log("Audio playback started");
    },
    onPlayEnd: () => {
      console.log("Audio playback ended");
      setPlayingMessageIndex(null);
    },
    onError: (error) => {
      console.error("TTS Error:", error);
      setPlayingMessageIndex(null);
    },
  });

  // Load scenario greeting when scenario is selected
  useEffect(() => {
    if (selectedScenario && messages.length === 0) {
      loadScenarioGreeting(selectedScenario);
    }
  }, [selectedScenario]);

  const loadScenarioGreeting = async (scenario: string) => {
    try {
      setIsThinking(true);
      const greeting = await aiService.getScenarioGreeting(scenario);
      setMessages([{ type: "ai", text: greeting }]);
      
      // Auto-play greeting if enabled
      if (autoPlayAudio) {
        setTimeout(() => {
          playAudio(greeting);
          setPlayingMessageIndex(0);
        }, 300); // Small delay to ensure message is rendered
      }
    } catch (error: any) {
      console.error("Error loading scenario greeting:", error);
      toast.error(error.message || "Failed to load scenario");
      // Fallback greeting
      const fallbackGreeting = `Hello! Welcome to the ${scenario} scenario. Let's begin practicing!`;
      setMessages([
        {
          type: "ai",
          text: fallbackGreeting,
        },
      ]);
      
      if (autoPlayAudio) {
        setTimeout(() => {
          playAudio(fallbackGreeting);
          setPlayingMessageIndex(0);
        }, 300);
      }
    } finally {
      setIsThinking(false);
    }
  };

  const handleSend = async () => {
    if (inputText.trim() && !isThinking && selectedScenario) {
      const userMessage = { type: "user" as const, text: inputText };
      setMessages((prev) => [...prev, userMessage]);
      const currentInput = inputText;
      setInputText("");
      setIsThinking(true);

      try {
        // Convert messages to conversation history format
        const conversationHistory = messages.map((msg) => ({
          role: msg.type === "user" ? ("user" as const) : ("model" as const),
          content: msg.text,
        }));

        // Get AI response for scenario
        const aiResponse = await aiService.sendScenarioMessage({
          scenario: selectedScenario,
          userMessage: currentInput,
          conversationHistory,
          temperature: 0.8,
        });

        const aiMessage = {
          type: "ai" as const,
          text: aiResponse,
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

  const scenarios = [
    {
      title: "Job Interview",
      description: "Practice answering common interview questions",
      icon: Briefcase,
    },
    {
      title: "Restaurant Order",
      description: "Order food and interact with waiters",
      icon: Utensils,
    },
    {
      title: "Shopping",
      description: "Practice shopping conversations",
      icon: ShoppingBag,
    },
    {
      title: "Travel",
      description: "Ask for directions and book hotels",
      icon: Plane,
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Status Bar Space */}
      <div className="h-6"></div>

      <Header showBack title="Speaking Practice" />

      <div className="max-w-md mx-auto px-4 py-6 md:max-w-2xl md:px-8">
        {/* Scenario Selection */}
        <div className="mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">
            Choose a Scenario
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {scenarios.map((scenario, index) => (
              <Card
                key={index}
                onClick={() => {
                  if (selectedScenario !== scenario.title) {
                    // Stop any playing audio
                    stopAudio();
                    setPlayingMessageIndex(null);
                    // Reset and select new scenario
                    setSelectedScenario(scenario.title);
                    setMessages([]);
                    setInputText("");
                  }
                }}
                className={`hover:shadow-md transition-all ${
                  selectedScenario === scenario.title
                    ? "border-2 border-green-600 bg-green-50"
                    : ""
                }`}
              >
                <div className="text-center py-4">
                  <scenario.icon className="w-8 h-8 mx-auto mb-2 text-green-600" />
                  <h3 className="text-sm font-semibold text-gray-900 mb-1">
                    {scenario.title}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {scenario.description}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Active Scenario Indicator */}
        {selectedScenario && (
          <Card className="mb-4 bg-green-50 border-green-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-sm font-semibold text-gray-900">
                  Active Scenario: {selectedScenario}
                </span>
              </div>
              <button
                onClick={() => {
                  stopAudio();
                  setPlayingMessageIndex(null);
                  setSelectedScenario(null);
                  setMessages([]);
                  setInputText("");
                }}
                className="text-xs text-gray-600 hover:text-gray-900 underline"
              >
                Change Scenario
              </button>
            </div>
          </Card>
        )}

        {/* Active Conversation */}
        <Card className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Conversation Practice
            </h3>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-green-600" />
                <span className="text-sm text-gray-500">AI Partner</span>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={autoPlayAudio}
                  onChange={(e) => setAutoPlayAudio(e.target.checked)}
                  className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                />
                <span>Auto-play</span>
              </label>
            </div>
          </div>

          {/* Messages */}
          <div className="space-y-4 mb-4 max-h-96 overflow-y-auto">
            {messages.length === 0 && !selectedScenario && (
              <div className="text-center py-8 text-gray-500">
                <p className="text-sm">Select a scenario above to begin practicing</p>
              </div>
            )}
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${
                  message.type === "ai" ? "justify-start" : "justify-end"
                }`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    message.type === "ai"
                      ? "bg-gray-100 text-gray-900"
                      : "bg-green-600 text-white"
                  }`}
                >
                  {message.type === "ai" ? (
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
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
                      <div className="flex-shrink-0">
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
                          className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors disabled:opacity-50 ${
                            playingMessageIndex === index && isPlaying
                              ? "bg-red-100 text-red-600 hover:bg-red-200"
                              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          }`}
                          title={
                            playingMessageIndex === index && isPlaying
                              ? "Stop audio"
                              : "Play audio"
                          }
                        >
                          {isGeneratingAudio && playingMessageIndex === index ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : playingMessageIndex === index && isPlaying ? (
                            <VolumeX className="w-4 h-4" />
                          ) : (
                            <Volume2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm">{message.text}</p>
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
                Recording...
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
              placeholder="Type your response..."
              className="flex-1 rounded-xl border-2 border-gray-200 px-4 py-2 focus:outline-none focus:border-green-600"
              disabled={isThinking || !selectedScenario}
            />
            <button
              onClick={() => setIsRecording(!isRecording)}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                isRecording
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-green-600 hover:bg-green-700"
              }`}
            >
              {isRecording ? (
                <Pause className="w-6 h-6 text-white" />
              ) : (
                <Mic className="w-6 h-6 text-white" />
              )}
            </button>
            <button
              onClick={handleSend}
              disabled={!inputText.trim() || isThinking || !selectedScenario}
              className="w-12 h-12 rounded-full bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
            >
              <Send className="w-6 h-6 text-white" />
            </button>
          </div>
        </Card>

        {/* Actions */}
        <div className="space-y-3">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={() => router.push("/practice/speaking/completed")}
          >
            End Conversation
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


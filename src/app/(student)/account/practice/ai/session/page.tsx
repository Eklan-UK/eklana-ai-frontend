"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Mic,
  MicOff,
  Send,
  Loader2,
  Volume2,
  ChevronLeft,
  MoreVertical,
  X,
  RotateCcw,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTTS } from "@/hooks/useTTS";
import { aiService } from "@/services/ai.service";
import { toast } from "sonner";
import { MarkdownText } from "@/components/ui/MarkdownText";
import { useAuthStore } from "@/store/auth-store";
import { getUserInitials } from "@/utils/user";
import Image from "next/image";

/* ─── Gemini native audio playback ─────────────────────────────────────────── */

function playBase64Audio(
  base64Data: string,
  mimeType: string = "audio/wav",
  onEnd?: () => void,
  onError?: (err: Error) => void
): HTMLAudioElement | null {
  let settled = false;
  const fail = (err: Error) => {
    if (settled) return;
    settled = true;
    onError?.(err);
  };
  try {
    if (!base64Data || base64Data.length < 100) {
      fail(new Error("Empty audio data"));
      return null;
    }
    const audio = new Audio(`data:${mimeType};base64,${base64Data}`);
    audio.onended = () => { settled = true; onEnd?.(); };
    audio.onerror = () => fail(new Error("Browser could not decode audio"));
    audio.play().catch((err) => fail(err));
    return audio;
  } catch (err: any) {
    fail(err);
    return null;
  }
}

/* ─── Types ────────────────────────────────────────────────────────────────── */

interface ChatMessage {
  type: "ai" | "user";
  text: string;
  audioBase64?: string | null;
  audioMimeType?: string | null;
}

const DRILL_TYPE_LABELS: Record<string, string> = {
  roleplay: "Roleplay",
  vocabulary: "Vocabulary",
  grammar: "Grammar",
  matching: "Matching",
  definition: "Definition",
  sentence_writing: "Sentence Building",
  fill_blank: "Fill-in-the-Blank",
  summary: "Reading Discussion",
  listening: "Listening",
  sentence: "Sentence",
};

/* ─── Session cache helpers ────────────────────────────────────────────────── */

function getSessionKey(drillId: string | null, topic: string | null): string {
  if (drillId) return `ai-session-drill-${drillId}`;
  if (topic) return `ai-session-topic-${topic}`;
  return "ai-session-free";
}

interface CachedSession {
  messages: Array<{ type: "ai" | "user"; text: string }>;
  conversationHistory: Array<{ role: "user" | "model"; content: string }>;
  drillInfo?: { drillType: string; drillTitle: string } | null;
  timestamp: number;
}

function getCachedSession(key: string): CachedSession | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const cached = JSON.parse(raw) as CachedSession;
    // Expire after 30 minutes
    if (Date.now() - cached.timestamp > 30 * 60 * 1000) {
      sessionStorage.removeItem(key);
      return null;
    }
    return cached;
  } catch {
    return null;
  }
}

function saveCachedSession(key: string, session: CachedSession) {
  try {
    sessionStorage.setItem(key, JSON.stringify(session));
  } catch {
    // Ignore storage errors
  }
}

function clearCachedSession(key: string) {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // Ignore
  }
}

/* ─── Page ─────────────────────────────────────────────────────────────────── */

export default function AISessionPage() {
  const searchParams = useSearchParams();
  const drillId = searchParams.get("drillId");
  const topic = searchParams.get("topic");
  const isDrillPractice = !!drillId;
  const router = useRouter();
  const { user } = useAuthStore();
  const initials = getUserInitials(user);

  const sessionKey = getSessionKey(drillId, topic);
  const cachedSession = useRef(getCachedSession(sessionKey));

  // --- Resume prompt state ---
  const [showResumePrompt, setShowResumePrompt] = useState(!!cachedSession.current);

  const [isRecording, setIsRecording] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [drillInfo, setDrillInfo] = useState<{ drillType: string; drillTitle: string } | null>(
    cachedSession.current?.drillInfo ?? null
  );

  const topicGreeting = topic
    ? `Hey! Let's talk about **${topic.replace(/-/g, " ")}**. What's on your mind?`
    : "Hey! I'm here to help you practice English. What would you like to talk about?";

  const freshMessages: ChatMessage[] = isDrillPractice
    ? []
    : [{ type: "ai", text: topicGreeting, audioBase64: null, audioMimeType: null }];

  const [messages, setMessages] = useState<ChatMessage[]>(
    cachedSession.current
      ? cachedSession.current.messages.map((m) => ({ ...m, audioBase64: null, audioMimeType: null }))
      : freshMessages
  );
  const [conversationHistory, setConversationHistory] = useState<
    Array<{ role: "user" | "model"; content: string }>
  >(cachedSession.current?.conversationHistory ?? []);
  const [inputText, setInputText] = useState("");
  const [autoPlayAudio, setAutoPlayAudio] = useState(true);
  const [playingMessageIndex, setPlayingMessageIndex] = useState<number | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Voice recording
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);

  // ElevenLabs TTS (fallback for non-drill mode)
  const {
    playAudio: playTTSAudio,
    isGenerating: isGeneratingTTS,
    isPlaying: isPlayingTTS,
    stopAudio: stopTTSAudio,
  } = useTTS({
    autoPlay: false,
    onPlayStart: () => {},
    onPlayEnd: () => { setPlayingMessageIndex(null); setIsPlayingAudio(false); },
    onError: () => { setPlayingMessageIndex(null); setIsPlayingAudio(false); },
  });

  const isPlaying = isPlayingAudio || isPlayingTTS;

  /* ─── Audio playback ───────────────────────────────────────────────────── */

  const playMessageAudio = useCallback(
    (message: ChatMessage, messageIndex: number) => {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
      stopTTSAudio();
      setPlayingMessageIndex(messageIndex);
      setIsPlayingAudio(true);

      if (message.audioBase64) {
        const audio = playBase64Audio(
          message.audioBase64,
          message.audioMimeType || "audio/wav",
          () => { setPlayingMessageIndex(null); setIsPlayingAudio(false); currentAudioRef.current = null; },
          () => { setPlayingMessageIndex(null); setIsPlayingAudio(false); currentAudioRef.current = null; }
        );
        currentAudioRef.current = audio;
      } else {
        setIsPlayingAudio(false);
        playTTSAudio(message.text);
      }
    },
    [stopTTSAudio, playTTSAudio]
  );

  const stopAllAudio = useCallback(() => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    stopTTSAudio();
    setPlayingMessageIndex(null);
    setIsPlayingAudio(false);
  }, [stopTTSAudio]);

  /* ─── Lifecycle ────────────────────────────────────────────────────────── */

  const drillInitRef = useRef(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Initialize drill session (only if no cached session being resumed)
  useEffect(() => {
    if (isDrillPractice && drillId && !drillInitRef.current && !showResumePrompt) {
      drillInitRef.current = true;
      initializeDrillPractice();
    }
  }, [drillId, showResumePrompt]);

  useEffect(() => {
    if (!isDrillPractice && !showResumePrompt && messages[0]?.type === "ai" && autoPlayAudio) {
      setTimeout(() => {
        playTTSAudio(messages[0].text);
        setPlayingMessageIndex(0);
      }, 300);
    }
  }, [showResumePrompt]);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
      if (mediaStreamRef.current) mediaStreamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Save session to cache whenever messages change
  useEffect(() => {
    if (messages.length > 0 && !showResumePrompt) {
      saveCachedSession(sessionKey, {
        messages: messages.map((m) => ({ type: m.type, text: m.text })),
        conversationHistory,
        drillInfo,
        timestamp: Date.now(),
      });
    }
  }, [messages, conversationHistory, drillInfo, sessionKey, showResumePrompt]);

  /* ─── Resume / New session handlers ────────────────────────────────────── */

  const handleResumeSession = () => {
    setShowResumePrompt(false);
    // Messages already loaded from cache
  };

  const handleNewSession = () => {
    clearCachedSession(sessionKey);
    cachedSession.current = null;
    setShowResumePrompt(false);
    setMessages(freshMessages);
    setConversationHistory([]);
    setDrillInfo(null);
    drillInitRef.current = false;
    if (isDrillPractice) {
      initializeDrillPractice();
    }
  };

  /* ─── Drill init ───────────────────────────────────────────────────────── */

  const initializeDrillPractice = async () => {
    setIsInitializing(true);
    try {
      const data = await aiService.getDrillPracticeGreeting(drillId!);
      setDrillInfo({ drillType: data.drillType, drillTitle: data.drillTitle });

      const greetingMessage: ChatMessage = {
        type: "ai",
        text: data.greeting,
        audioBase64: data.audioBase64,
        audioMimeType: data.audioMimeType,
      };
      setMessages([greetingMessage]);
      setConversationHistory([{ role: "model", content: data.greeting }]);

      if (autoPlayAudio) {
        setTimeout(() => playMessageAudio(greetingMessage, 0), 500);
      }
    } catch {
      const fallback: ChatMessage = {
        type: "ai",
        text: "Alright! Let's get started with your practice. I've got exercises ready for you!",
        audioBase64: null,
        audioMimeType: null,
      };
      setMessages([fallback]);
      setConversationHistory([{ role: "model", content: fallback.text }]);
    } finally {
      setIsInitializing(false);
    }
  };

  /* ─── Send message ─────────────────────────────────────────────────────── */

  const handleSendText = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isThinking) return;

    const userMessage: ChatMessage = { type: "user", text: trimmed, audioBase64: null, audioMimeType: null };
    setMessages((prev) => [...prev, userMessage]);
    setInputText("");
    setIsThinking(true);

    try {
      let aiMessage: ChatMessage;

      if (isDrillPractice && drillId) {
        const newHistory = [...conversationHistory, { role: "user" as const, content: trimmed }];
        const data = await aiService.sendDrillPracticeMessage({
          drillId,
          userMessage: trimmed,
          conversationHistory: newHistory,
        });
        aiMessage = {
          type: "ai",
          text: data.response,
          audioBase64: data.audioBase64,
          audioMimeType: data.audioMimeType,
        };
        if (!drillInfo && data.drillType) {
          setDrillInfo({ drillType: data.drillType, drillTitle: data.drillTitle });
        }
        setConversationHistory([...newHistory, { role: "model", content: data.response }]);
      } else {
        const conversationMessages = messages.map((msg) => ({
          role: msg.type === "user" ? ("user" as const) : ("model" as const),
          content: msg.text,
        }));
        conversationMessages.push({ role: "user" as const, content: trimmed });
        const aiResponseText = await aiService.sendConversationMessage({
          messages: conversationMessages,
          temperature: 0.7,
          maxTokens: 1000,
        });
        aiMessage = { type: "ai", text: aiResponseText, audioBase64: null, audioMimeType: null };
      }

      const messageToPlay = aiMessage;
      setMessages((prev) => {
        const newMessages = [...prev, messageToPlay];
        if (autoPlayAudio) {
          setTimeout(() => playMessageAudio(messageToPlay, newMessages.length - 1), 300);
        }
        return newMessages;
      });
      setIsThinking(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to get AI response");
      setIsThinking(false);
      setMessages((prev) => prev.slice(0, -1));
      setInputText(trimmed);
    }
  };

  const handleSend = () => handleSendText(inputText);

  /* ─── Voice recording ──────────────────────────────────────────────────── */

  const startVoiceRecording = useCallback(async () => {
    try {
      stopAllAudio();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      audioChunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;

        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });

        if (audioBlob.size < 1000) {
          toast.error("Recording too short. Please try again.");
          setIsRecording(false);
          return;
        }

        setIsTranscribing(true);
        setIsRecording(false);
        try {
          const transcription = await aiService.transcribeAudio(audioBlob);
          if (!transcription.trim()) {
            toast.error("Couldn't hear anything. Please speak louder and try again.");
            setIsTranscribing(false);
            return;
          }
          setInputText(transcription);
          setIsTranscribing(false);
          setTimeout(() => handleSendText(transcription), 200);
        } catch (err: any) {
          toast.error(err.message || "Failed to transcribe. Try using the keyboard instead.");
          setIsTranscribing(false);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error: any) {
      if (error.name === "NotAllowedError") {
        toast.error("Microphone access denied. Please allow microphone permissions.");
      } else {
        toast.error("Failed to access microphone: " + error.message);
      }
    }
  }, [stopAllAudio, handleSendText]);

  const stopVoiceRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
  }, []);

  const toggleVoiceRecording = useCallback(() => {
    if (isRecording) stopVoiceRecording();
    else startVoiceRecording();
  }, [isRecording, startVoiceRecording, stopVoiceRecording]);

  /* ─── Helpers ──────────────────────────────────────────────────────────── */

  const subtitle = isDrillPractice && drillInfo
    ? `${DRILL_TYPE_LABELS[drillInfo.drillType] || "Practice"} · ${drillInfo.drillTitle}`
    : "English conversation practice";

  /* ─── Resume Prompt ────────────────────────────────────────────────────── */

  if (showResumePrompt) {
    const cachedMsgCount = cachedSession.current?.messages.length ?? 0;

    return (
      <div className="flex flex-col h-[100dvh] bg-gray-50 items-center justify-center px-6">
        <div className="bg-white rounded-3xl shadow-lg p-6 max-w-sm w-full text-center">
          {/* Icon */}
          <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Image src="/logo2.svg" alt="Eklan" width={32} height={32} />
          </div>

          <h2 className="text-lg font-bold font-nunito text-gray-900 mb-1">
            Continue previous session?
          </h2>
          <p className="text-sm font-satoshi text-gray-500 mb-6">
            You have {cachedMsgCount} message{cachedMsgCount !== 1 ? "s" : ""} from an earlier conversation.
          </p>

          <div className="space-y-3">
            <button
              onClick={handleResumeSession}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 rounded-2xl transition-colors"
            >
              Continue session
            </button>
            <button
              onClick={handleNewSession}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 rounded-2xl transition-colors flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Start fresh
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ─── Render ───────────────────────────────────────────────────────────── */

  return (
    <div className="flex flex-col h-[100dvh] bg-gray-50">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 bg-white border-b border-gray-100">
        <div className="flex items-center px-4 py-3 max-w-2xl mx-auto">
          <button
            onClick={() => router.push("/account/practice/ai")}
            className="p-1.5 -ml-1.5 rounded-full hover:bg-gray-100 transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>

          <div className="flex items-center flex-1 ml-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
              <Image src="/logo2.svg" alt="Eklan" width={24} height={24} />
            </div>
            <div className="ml-3 min-w-0">
              <h1 className="text-sm font-semibold text-gray-900 truncate">
                {isDrillPractice ? "Eklan" : "AI Partner"}
              </h1>
              <p className="text-xs text-gray-500 truncate">{subtitle}</p>
            </div>
          </div>

          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1.5 rounded-full hover:bg-gray-100 transition-colors"
            >
              <MoreVertical className="w-5 h-5 text-gray-500" />
            </button>

            {showMenu && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 top-10 z-40 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-1 animate-in fade-in slide-in-from-top-1 duration-150">
                  <button
                    onClick={() => { setAutoPlayAudio(!autoPlayAudio); setShowMenu(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <Volume2 className="w-4 h-4" />
                    <span>Auto-play {autoPlayAudio ? "on" : "off"}</span>
                    <div className={`ml-auto w-8 h-5 rounded-full flex items-center transition-colors ${autoPlayAudio ? "bg-emerald-500 justify-end" : "bg-gray-300 justify-start"}`}>
                      <div className="w-4 h-4 bg-white rounded-full shadow mx-0.5" />
                    </div>
                  </button>
                  <div className="h-px bg-gray-100 mx-2" />
                  <button
                    onClick={() => {
                      clearCachedSession(sessionKey);
                      router.push("/account/practice/ai");
                      setShowMenu(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <X className="w-4 h-4" />
                    <span>End session</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── Messages ───────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">
          {/* Date pill */}
          <div className="flex justify-center">
            <span className="text-[11px] text-gray-400 bg-white/80 backdrop-blur-sm px-3 py-1 rounded-full shadow-sm">
              Today
            </span>
          </div>

          {/* Loading state */}
          {isInitializing && (
            <div className="flex justify-center py-8">
              <div className="flex items-center gap-2 text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Setting up your session...</span>
              </div>
            </div>
          )}

          {messages.map((message, index) => {
            const isAI = message.type === "ai";
            const isCurrentlyPlaying = playingMessageIndex === index && isPlaying;

            return isAI ? (
              <div key={index} className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden">
                  <Image src="/logo2.svg" alt="Eklan" width={28} height={28} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[85%]">
                    <MarkdownText className="text-sm text-gray-900 leading-relaxed">
                      {message.text}
                    </MarkdownText>
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 ml-1">
                    <button
                      onClick={() => {
                        if (isCurrentlyPlaying) stopAllAudio();
                        else playMessageAudio(message, index);
                      }}
                      className="flex items-center gap-1.5 text-sm hover:opacity-70 transition-opacity"
                    >
                      {isCurrentlyPlaying ? (
                        <>
                          <Volume2 className="w-4 h-4 text-emerald-600" />
                          <span className="text-emerald-600 text-xs font-medium">Playing...</span>
                        </>
                      ) : (
                        <>
                          <Volume2 className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-400 text-xs">Replay</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div key={index} className="flex items-start justify-end gap-3 mb-4">
                <div className="max-w-[85%]">
                  <div className="bg-emerald-600 rounded-2xl rounded-tr-sm px-4 py-3">
                    <p className="text-sm text-white leading-relaxed">{message.text}</p>
                  </div>
                </div>
                <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {user?.avatar ? (
                    <Image src={user.avatar} alt="You" width={40} height={40} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-white text-sm font-bold">{initials}</span>
                  )}
                </div>
              </div>
            );
          })}

          {/* Thinking indicator */}
          {isThinking && (
            <div className="flex justify-start">
              <div className="bg-white shadow-sm border border-gray-100 rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* ── Recording overlay ──────────────────────────────────────────── */}
      {isRecording && (
        <div className="bg-red-50 border-t border-red-100 px-4 py-2">
          <div className="max-w-2xl mx-auto flex items-center justify-center gap-2">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-sm font-medium text-red-600">Recording...</span>
            <div className="flex gap-0.5 ml-2">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="w-0.5 bg-red-400 rounded-full animate-pulse"
                  style={{ height: `${8 + Math.random() * 12}px`, animationDelay: `${i * 0.1}s` }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {isTranscribing && (
        <div className="bg-blue-50 border-t border-blue-100 px-4 py-2">
          <div className="max-w-2xl mx-auto flex items-center justify-center gap-2">
            <Loader2 className="w-3.5 h-3.5 text-blue-600 animate-spin" />
            <span className="text-sm font-medium text-blue-600">Transcribing...</span>
          </div>
        </div>
      )}

      {/* ── Input bar ──────────────────────────────────────────────────── */}
      <footer className="sticky bottom-0 bg-white border-t border-gray-100">
        <div className="max-w-2xl mx-auto px-3 py-2.5 flex items-end gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder={
              isRecording
                ? "Recording..."
                : isTranscribing
                  ? "Transcribing..."
                  : "Type a message..."
            }
            disabled={isInitializing || isRecording || isTranscribing}
            className="flex-1 bg-gray-100 rounded-full px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:bg-white transition-all disabled:opacity-50"
          />

          {inputText.trim() ? (
            <button
              onClick={handleSend}
              disabled={isThinking || isInitializing}
              className="w-10 h-10 rounded-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center transition-colors flex-shrink-0"
            >
              <Send className="w-4.5 h-4.5 text-white ml-0.5" />
            </button>
          ) : (
            <button
              onClick={toggleVoiceRecording}
              disabled={isThinking || isInitializing || isTranscribing}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed ${
                isRecording
                  ? "bg-red-500 hover:bg-red-600 animate-pulse"
                  : "bg-emerald-600 hover:bg-emerald-700"
              }`}
            >
              {isRecording ? (
                <MicOff className="w-4.5 h-4.5 text-white" />
              ) : (
                <Mic className="w-4.5 h-4.5 text-white" />
              )}
            </button>
          )}
        </div>

        {/* Safe area for mobile */}
        <div className="h-[env(safe-area-inset-bottom)]" />
      </footer>
    </div>
  );
}

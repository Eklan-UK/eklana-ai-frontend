"use client";

import React, { useState, useRef, useEffect } from "react";
import { X, Send, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface AIChatSidebarProps {
  open: boolean;
  onClose: () => void;
  drillType: string;
  currentDrill: Record<string, unknown>;
  onDrillUpdated: (updated: Record<string, unknown>) => void;
}

export const AIChatSidebar: React.FC<AIChatSidebarProps> = ({
  open,
  onClose,
  drillType,
  currentDrill,
  onDrillUpdated,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [latestDrill, setLatestDrill] = useState<Record<string, unknown>>(currentDrill);
  const [isMinimised, setIsMinimised] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || sending) return;

    const userMessage: ChatMessage = { role: "user", content: trimmed };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setSending(true);

    try {
      const res = await fetch("/api/v1/drills/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          drillType,
          currentDrill: latestDrill,
          messages: nextMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!res.ok) {
        if (res.status === 404) {
          toast.error("Refine with AI is not available yet");
        } else {
          const json = await res.json().catch(() => ({}));
          toast.error(json.message || "Failed to refine drill");
        }
        setMessages(messages);
        return;
      }

      const json = await res.json();
      console.log("ai-chat raw response:", json);
      const updatedDrill = json.data?.drill ?? null;
      const assistantText =
        json.data?.message ??
        json.message ??
        "Drill content updated.";

      if (
        updatedDrill &&
        typeof updatedDrill === "object" &&
        Object.keys(updatedDrill).some((k) => (updatedDrill as Record<string, unknown>)[k] !== null && (updatedDrill as Record<string, unknown>)[k] !== undefined && (updatedDrill as Record<string, unknown>)[k] !== "")
      ) {
        setLatestDrill(updatedDrill as Record<string, unknown>);
        onDrillUpdated(updatedDrill as Record<string, unknown>);
      }

      const drillWasUpdated =
        updatedDrill &&
        typeof updatedDrill === "object" &&
        Object.keys(updatedDrill).some((k) => (updatedDrill as Record<string, unknown>)[k] !== null && (updatedDrill as Record<string, unknown>)[k] !== undefined && (updatedDrill as Record<string, unknown>)[k] !== "");

      setMessages([
        ...nextMessages,
        { role: "assistant", content: assistantText },
      ]);
      if (drillWasUpdated) toast.success("Drill updated");
    } catch {
      toast.error("Refine with AI is not available yet");
      setMessages(messages);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/20 z-40 lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}
      <div
        className={`fixed top-0 right-0 ${isMinimised ? "h-auto" : "h-full"} w-full sm:w-[380px] bg-white border-l border-gray-200 shadow-xl z-50 flex flex-col transition-transform duration-300 ease-in-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-base font-bold text-gray-900">Refine with AI</h3>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setIsMinimised((v) => !v)}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
              aria-label={isMinimised ? "Expand chat" : "Minimise chat"}
            >
              {isMinimised ? (
                <ChevronDown className="w-5 h-5" />
              ) : (
                <ChevronUp className="w-5 h-5" />
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
              aria-label="Close chat"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {!isMinimised && (
        <>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {messages.length === 0 && !sending ? (
            <p className="text-sm text-gray-500 text-center py-8">
              Ask AI to refine the generated drill content. For example: &quot;Make
              Scene 2 more clinical&quot;
            </p>
          ) : (
            messages.map((msg, i) => (
              <div
                key={i}
                className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
              >
                <span className="text-xs font-bold text-gray-400 mb-1">
                  {msg.role === "user" ? "You" : "AI"}
                </span>
                <div
                  className={`max-w-[90%] rounded-2xl px-4 py-2.5 text-sm ${
                    msg.role === "user"
                      ? "bg-emerald-600 text-white"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))
          )}
          {sending && (
            <div className="flex flex-col items-start">
              <span className="text-xs font-bold text-gray-400 mb-1">AI</span>
              <div className="bg-gray-100 rounded-2xl px-4 py-3 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce [animation-delay:-0.3s]" />
                <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce [animation-delay:-0.15s]" />
                <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="border-t border-gray-100 p-4">
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={2}
              placeholder="Describe changes…"
              disabled={sending}
              className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={sending || !input.trim()}
              className="self-end p-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Send message"
            >
              {sending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
        </>
        )}
      </div>
    </>
  );
};

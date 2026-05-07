// Use relative path for Next.js API routes
const API_BASE_URL = "/api/v1";

interface ConversationMessage {
  role: "user" | "model";
  content: string;
}

interface ConversationOptions {
  messages: ConversationMessage[];
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  systemInstruction?: string;
}


/**
 * AI service for conversations and drill practice
 */
export const aiService = {
  /**
   * Send a message in a conversation
   */
  async sendConversationMessage(options: ConversationOptions): Promise<string> {
    const response = await fetch(`${API_BASE_URL}/ai/conversation`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(options),
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ message: "Failed to get AI response" }));
      throw new Error(error.message || "Failed to get AI response");
    }

    const data = await response.json();
    return data.data.response;
  },

  /**
   * Stream a message in a non-drill text conversation (SSE).
   */
  async streamConversationMessage(
    options: ConversationOptions,
    onChunk: (chunk: { type: string; data: unknown }) => void
  ): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/ai/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      signal: options.signal,
      body: JSON.stringify({
        messages: options.messages,
        temperature: options.temperature,
        maxTokens: options.maxTokens,
        ...(options.systemInstruction
          ? { systemInstruction: options.systemInstruction }
          : {}),
      }),
    });

    if (!response.ok) {
      if (response.headers.get("content-type")?.includes("application/json")) {
        const error = await response.json().catch(() => ({}));
        throw new Error(
          typeof error.message === "string" ? error.message : "Failed to get chat stream"
        );
      }
      throw new Error(`Failed to get chat stream: ${response.status}`);
    }

    await this._processSSEStream(response, onChunk, options.signal);
  },

  /**
   * Process Server-Sent Events (SSE) stream
   */
  async _processSSEStream(
    response: Response,
    onChunk: (chunk: { type: string; data: any }) => void,
    signal?: AbortSignal
  ): Promise<void> {
    if (!response.body) throw new Error("No response body");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    const onAbort = () => {
      void reader.cancel();
    };
    if (signal) {
      signal.addEventListener("abort", onAbort);
    }

    try {
      while (true) {
        if (signal?.aborted) break;

        let readResult: ReadableStreamReadResult<Uint8Array>;
        try {
          readResult = await reader.read();
        } catch (e) {
          if (signal?.aborted) break;
          throw e;
        }

        const { value, done } = readResult;
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE messages (separated by \n\n)
        let eventEndIndex;
        while ((eventEndIndex = buffer.indexOf("\n\n")) !== -1) {
          const eventString = buffer.slice(0, eventEndIndex);
          buffer = buffer.slice(eventEndIndex + 2); // remove processed event + \n\n

          if (eventString.startsWith("data: ")) {
            const dataString = eventString.slice(6); // remove 'data: '
            try {
              const chunk = JSON.parse(dataString) as { type: string; data: unknown };
              if (chunk.type === "error") {
                const msg =
                  typeof chunk.data === "object" &&
                  chunk.data !== null &&
                  "message" in chunk.data &&
                  typeof (chunk.data as { message?: string }).message === "string"
                    ? (chunk.data as { message: string }).message
                    : "Stream error";
                throw new Error(msg);
              }
              onChunk(chunk);
            } catch (err) {
              if (err instanceof SyntaxError) {
                console.error("Error parsing SSE chunk:", err, dataString);
              } else {
                throw err;
              }
            }
          }
        }
      }
    } finally {
      if (signal) {
        signal.removeEventListener("abort", onAbort);
      }
      try {
        reader.releaseLock();
      } catch {
        /* ignore */
      }
    }
  },

  /**
   * Send a message in a drill-aware conversation (Streaming)
   */
  async streamDrillPracticeMessage(
    options: {
      drillId: string;
      userMessage: string;
      conversationHistory?: Array<{ role: "user" | "model"; content: string }>;
      temperature?: number;
      signal?: AbortSignal;
      freeTalkContext?: { scenarioId: string; vocabularyList: string[]; reversed?: boolean };
    },
    onChunk: (chunk: { type: string; data: any }) => void
  ): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/ai/drill-practice`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      signal: options.signal,
      body: JSON.stringify({
        drillId: options.drillId,
        userMessage: options.userMessage,
        conversationHistory: options.conversationHistory || [],
        temperature: options.temperature,
        ...(options.freeTalkContext
          ? { freeTalkContext: options.freeTalkContext }
          : {}),
      }),
    });

    if (!response.ok) {
      if (response.headers.get("content-type")?.includes("application/json")) {
        const error = await response.json();
        throw new Error(error.message || "Failed to get drill practice stream");
      }
      throw new Error(`Failed to get drill practice stream: ${response.status}`);
    }

    await this._processSSEStream(response, onChunk, options.signal);
  },

  /**
   * Get initial greeting for drill-aware conversation (Streaming)
   */
  async streamDrillPracticeGreeting(
    drillId: string,
    onChunk: (chunk: { type: string; data: any }) => void,
    signal?: AbortSignal,
    freeTalkContext?: { scenarioId: string; vocabularyList: string[]; reversed?: boolean }
  ): Promise<void> {
    const qs = new URLSearchParams();
    qs.set("drillId", drillId);
    if (freeTalkContext?.scenarioId != null && freeTalkContext.scenarioId !== "") {
      qs.set("scenarioId", freeTalkContext.scenarioId);
    }
    if (freeTalkContext?.vocabularyList?.length) {
      qs.set("vocab", JSON.stringify(freeTalkContext.vocabularyList));
    }
    if (freeTalkContext?.reversed) {
      qs.set("reversed", "1");
    }
    const response = await fetch(
      `${API_BASE_URL}/ai/drill-practice/greeting?${qs.toString()}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        signal,
      }
    );

    if (!response.ok) {
      if (response.headers.get("content-type")?.includes("application/json")) {
        const error = await response.json();
        throw new Error(error.message || "Failed to get drill greeting stream");
      }
      throw new Error(`Failed to get drill greeting stream: ${response.status}`);
    }

    await this._processSSEStream(response, onChunk, signal);
  },

  /**
   * Voice conversation via Gemini Live: built-in transcription + audio streaming.
   */
  async streamVoiceConversationMessage(
    options: {
      audioBlob: Blob;
      conversationHistory?: Array<{ role: "user" | "model"; content: string }>;
      context?: string;
      signal?: AbortSignal;
    },
    onChunk: (chunk: { type: string; data: any }) => void
  ): Promise<void> {
    const formData = new FormData();
    formData.append("audio", options.audioBlob, "recording.webm");
    formData.append(
      "conversationHistory",
      JSON.stringify(options.conversationHistory || [])
    );
    if (options.context) formData.append("context", options.context);

    const response = await fetch(`${API_BASE_URL}/ai/voice/conversation`, {
      method: "POST",
      credentials: "include",
      body: formData,
      signal: options.signal,
    });

    if (!response.ok) {
      if (response.headers.get("content-type")?.includes("application/json")) {
        const error = await response.json();
        const msg = error.message || "Failed to get voice conversation stream";
        throw new Error(
          response.status === 503
            ? "The service is temporarily unavailable. Please try again in a moment."
            : response.status === 401
            ? "Session expired. Please refresh the page and try again."
            : msg
        );
      }
      throw new Error(`Failed to get voice conversation stream: ${response.status}`);
    }

    await this._processSSEStream(response, onChunk, options.signal);
  },

  /**
   * Drill practice voice via Gemini Live: built-in transcription + audio streaming.
   */
  async streamDrillPracticeVoiceMessage(
    options: {
      drillId: string;
      audioBlob: Blob;
      conversationHistory?: Array<{ role: "user" | "model"; content: string }>;
      temperature?: number;
      signal?: AbortSignal;
      freeTalkContext?: { scenarioId: string; vocabularyList: string[]; reversed?: boolean };
    },
    onChunk: (chunk: { type: string; data: any }) => void
  ): Promise<void> {
    const formData = new FormData();
    formData.append("drillId", options.drillId);
    formData.append("audio", options.audioBlob, "recording.webm");
    formData.append(
      "conversationHistory",
      JSON.stringify(options.conversationHistory || [])
    );
    if (options.temperature !== undefined) {
      formData.append("temperature", String(options.temperature));
    }
    if (options.freeTalkContext) {
      formData.append("freeTalkContext", JSON.stringify(options.freeTalkContext));
    }

    const response = await fetch(`${API_BASE_URL}/ai/drill-practice/voice`, {
      method: "POST",
      credentials: "include",
      body: formData,
      signal: options.signal,
    });

    if (!response.ok) {
      if (response.headers.get("content-type")?.includes("application/json")) {
        const error = await response.json();
        const msg = error.message || "Failed to get drill voice stream";
        throw new Error(
          response.status === 503
            ? "The service is temporarily unavailable. Please try again in a moment."
            : response.status === 401
            ? "Session expired. Please refresh the page and try again."
            : msg
        );
      }
      throw new Error(`Failed to get drill voice stream: ${response.status}`);
    }

    await this._processSSEStream(response, onChunk, options.signal);
  },

  /**
   * Transcribe audio to text using Gemini
   */
  async transcribeAudio(audioBlob: Blob): Promise<string> {
    const formData = new FormData();
    formData.append("audio", audioBlob, "recording.webm");

    const response = await fetch(`${API_BASE_URL}/ai/transcribe`, {
      method: "POST",
      credentials: "include",
      body: formData,
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ message: "Failed to transcribe audio" }));
      throw new Error(error.message || "Failed to transcribe audio");
    }

    const data = await response.json();
    return data.data.transcription;
  },
};

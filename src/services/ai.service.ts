import { normalizeFreeTalkScenarioStringList } from "@/lib/free-talk-scenario-lists";
import type { FreeTalkAttemptApiRow, FreeTalkGradeResult } from "@/lib/free-talk-history";
import type { BadgeUnlockCelebration } from "@/lib/badges/badge-unlock";

const API_BASE_URL = "/api/v1";

/**
 * AI service — Eklan Free Talk (grading) and shared SSE stream helper.
 */
export const aiService = {
  /**
   * Internal: consume an SSE stream and call onChunk for each event.
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

        let eventEndIndex;
        while ((eventEndIndex = buffer.indexOf("\n\n")) !== -1) {
          const eventString = buffer.slice(0, eventEndIndex);
          buffer = buffer.slice(eventEndIndex + 2);

          if (eventString.startsWith("data: ")) {
            const dataString = eventString.slice(6);
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
   * ICU Free Talk — ordered scenario ids for the student flow (GET /api/v1/ai/free-talk/scenarios).
   */
  async fetchFreeTalkScenarioSummaries(signal?: AbortSignal): Promise<
    { id: string; title: string; scenarioType: string; completionDate?: string | null }[]
  > {
    const response = await fetch(`${API_BASE_URL}/ai/free-talk/scenarios`, {
      method: "GET",
      credentials: "include",
      signal,
    });

    if (!response.ok) {
      if (response.status === 402) {
        throw new Error("Subscription required");
      }
      const error = await response.json().catch(() => ({}));
      throw new Error(
        typeof error.message === "string" ? error.message : "Failed to load scenario list"
      );
    }

    const data = await response.json();
    if (!data.success || !Array.isArray(data.scenarios)) {
      throw new Error(typeof data.message === "string" ? data.message : "Failed to load scenario list");
    }
    return data.scenarios;
  },

  /**
   * ICU Free Talk — fetch one scenario (JSON). GET /api/v1/ai/free-talk/greeting
   * Pass scenarioId to load a specific document; omit for a random scenario (legacy callers).
   */
  async fetchFreeTalkScenario(
    options?: { scenarioId?: string; signal?: AbortSignal }
  ): Promise<{
    id: string;
    title: string;
    situation: string;
    hint: string;
    usefulPhrases: string[];
    include: string[];
    scenarioType: string;
  }> {
    const signal = options?.signal;
    const scenarioId = options?.scenarioId?.trim();
    const qs = scenarioId ? `?scenarioId=${encodeURIComponent(scenarioId)}` : "";
    const response = await fetch(`${API_BASE_URL}/ai/free-talk/greeting${qs}`, {
      method: "GET",
      credentials: "include",
      signal,
    });

    if (!response.ok) {
      if (response.status === 402) {
        throw new Error("Subscription required");
      }
      const error = await response.json().catch(() => ({}));
      throw new Error(
        typeof error.message === "string" ? error.message : "Failed to load scenario"
      );
    }

    const data = await response.json();
    if (!data.success || !data.scenario?.id) {
      throw new Error(typeof data.message === "string" ? data.message : "Failed to load scenario");
    }
    const sc = data.scenario as {
      id: string;
      title: string;
      situation: string;
      hint: string;
      usefulPhrases?: unknown;
      include?: unknown;
      scenarioType: string;
    };
    return {
      id: sc.id,
      title: sc.title,
      situation: sc.situation,
      hint: sc.hint,
      usefulPhrases: normalizeFreeTalkScenarioStringList(sc.usefulPhrases),
      include: normalizeFreeTalkScenarioStringList(sc.include),
      scenarioType: sc.scenarioType,
    };
  },

  /**
   * ICU Free Talk — grade the student's single response (SSE).
   * POST /api/v1/ai/free-talk
   * Streams narrative feedback text + ends with a metadata chunk containing the grade.
   */
  async streamFreeTalkGrading(
    options: {
      userResponse: string;
      scenarioId: string;
      signal?: AbortSignal;
    },
    onChunk: (chunk: { type: string; data: unknown }) => void
  ): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/ai/free-talk`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      credentials: "include",
      signal: options.signal,
      body: JSON.stringify({
        userResponse: options.userResponse,
        scenarioId: options.scenarioId,
      }),
    });

    if (!response.ok) {
      if (response.status === 402) {
        throw new Error("Subscription required");
      }
      if (response.headers.get("content-type")?.includes("application/json")) {
        const error = await response.json().catch(() => ({}));
        throw new Error(
          typeof error.message === "string" ? error.message : "Failed to grade Free Talk response"
        );
      }
      throw new Error(`Failed to grade Free Talk response: ${response.status}`);
    }

    await this._processSSEStream(response, onChunk, options.signal);
  },

  /**
   * Transcribe audio to text using Gemini (browser recordings, e.g. webm).
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

  /**
   * List persisted Free Talk attempts for the signed-in learner (Pro).
   * GET /api/v1/ai/free-talk/attempts
   */
  async fetchFreeTalkAttempts(options?: {
    limit?: number;
    cursor?: string | null;
    signal?: AbortSignal;
  }): Promise<{ attempts: FreeTalkAttemptApiRow[]; nextCursor: string | null }> {
    const sp = new URLSearchParams();
    if (options?.limit != null) sp.set("limit", String(options.limit));
    if (options?.cursor) sp.set("cursor", options.cursor);
    const qs = sp.toString();
    const response = await fetch(
      `${API_BASE_URL}/ai/free-talk/attempts${qs ? `?${qs}` : ""}`,
      {
        method: "GET",
        credentials: "include",
        signal: options?.signal,
      }
    );

    if (!response.ok) {
      if (response.status === 402) {
        throw new Error("Subscription required");
      }
      const error = await response.json().catch(() => ({}));
      throw new Error(
        typeof error.message === "string" ? error.message : "Failed to load Free Talk history"
      );
    }

    const data = await response.json();
    if (!data.success || !Array.isArray(data.attempts)) {
      throw new Error(typeof data.message === "string" ? data.message : "Failed to load Free Talk history");
    }
    return {
      attempts: data.attempts as FreeTalkAttemptApiRow[],
      nextCursor: typeof data.nextCursor === "string" ? data.nextCursor : null,
    };
  },

  /**
   * Persist a graded Free Talk attempt (optional voice recording as multipart).
   * POST /api/v1/ai/free-talk/attempts
   */
  async saveFreeTalkAttempt(
    body: {
      scenarioId: string;
      scenarioTitle: string;
      scenarioType: string;
      feedbackText: string;
      gradeResult: FreeTalkGradeResult | null;
      durationMs?: number;
      usedVoice: boolean;
    },
    audioBlob?: Blob | null,
    signal?: AbortSignal
  ): Promise<{ attempt: FreeTalkAttemptApiRow; badgesUnlocked: BadgeUnlockCelebration[] }> {
    const formData = new FormData();
    formData.append("payload", JSON.stringify(body));
    if (audioBlob && audioBlob.size > 0) {
      const name = audioBlob.type.includes("webm") ? "recording.webm" : "recording.bin";
      formData.append("audio", audioBlob, name);
    }

    const response = await fetch(`${API_BASE_URL}/ai/free-talk/attempts`, {
      method: "POST",
      credentials: "include",
      signal,
      body: formData,
    });

    if (!response.ok) {
      if (response.status === 402) {
        throw new Error("Subscription required");
      }
      const error = await response.json().catch(() => ({}));
      throw new Error(
        typeof error.message === "string" ? error.message : "Failed to save Free Talk attempt"
      );
    }

    const data = await response.json();
    if (!data.success || !data.attempt?.id) {
      throw new Error(typeof data.message === "string" ? data.message : "Failed to save Free Talk attempt");
    }
    return {
      attempt: data.attempt as FreeTalkAttemptApiRow,
      badgesUnlocked: Array.isArray(data.badgesUnlocked) ? data.badgesUnlocked : [],
    };
  },
};

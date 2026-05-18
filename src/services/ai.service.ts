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
   * ICU Free Talk — fetch next scenario (JSON). GET /api/v1/ai/free-talk/greeting
   */
  async fetchFreeTalkScenario(signal?: AbortSignal): Promise<{
    title: string;
    situation: string;
    hint: string;
    usefulPhrases: string[];
    scenarioType: string;
  }> {
    const response = await fetch(`${API_BASE_URL}/ai/free-talk/greeting`, {
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
    return data.scenario;
  },

  /**
   * ICU Free Talk — grade the student's single response (SSE).
   * POST /api/v1/ai/free-talk
   * Streams narrative feedback text + ends with a metadata chunk containing the grade.
   */
  async streamFreeTalkGrading(
    options: {
      userResponse: string;
      scenarioTitle: string;
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
        scenarioTitle: options.scenarioTitle,
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
};

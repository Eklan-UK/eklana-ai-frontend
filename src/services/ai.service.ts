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
   * Process Server-Sent Events (SSE) stream
   */
  async _processSSEStream(
    response: Response,
    onChunk: (chunk: { type: string; data: any }) => void
  ): Promise<void> {
    if (!response.body) throw new Error("No response body");
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        
        // Process complete SSE messages (separated by \n\n)
        let eventEndIndex;
        while ((eventEndIndex = buffer.indexOf('\n\n')) !== -1) {
          const eventString = buffer.slice(0, eventEndIndex);
          buffer = buffer.slice(eventEndIndex + 2); // remove processed event + \n\n

          if (eventString.startsWith('data: ')) {
            const dataString = eventString.slice(6); // remove 'data: '
            try {
              const chunk = JSON.parse(dataString);
              onChunk(chunk);
            } catch (err) {
              console.error("Error parsing SSE chunk:", err, dataString);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
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
    },
    onChunk: (chunk: { type: string; data: any }) => void
  ): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/ai/drill-practice`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        drillId: options.drillId,
        userMessage: options.userMessage,
        conversationHistory: options.conversationHistory || [],
        temperature: options.temperature,
      }),
    });

    if (!response.ok) {
      if (response.headers.get("content-type")?.includes("application/json")) {
        const error = await response.json();
        throw new Error(error.message || "Failed to get drill practice stream");
      }
      throw new Error(`Failed to get drill practice stream: ${response.status}`);
    }

    await this._processSSEStream(response, onChunk);
  },

  /**
   * Get initial greeting for drill-aware conversation (Streaming)
   */
  async streamDrillPracticeGreeting(
    drillId: string,
    onChunk: (chunk: { type: string; data: any }) => void
  ): Promise<void> {
    const response = await fetch(
      `${API_BASE_URL}/ai/drill-practice/greeting?drillId=${encodeURIComponent(
        drillId
      )}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      }
    );

    if (!response.ok) {
      if (response.headers.get("content-type")?.includes("application/json")) {
        const error = await response.json();
        throw new Error(error.message || "Failed to get drill greeting stream");
      }
      throw new Error(`Failed to get drill greeting stream: ${response.status}`);
    }

    await this._processSSEStream(response, onChunk);
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

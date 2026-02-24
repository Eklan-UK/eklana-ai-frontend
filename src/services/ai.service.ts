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
   * Send a message in a drill-aware conversation
   */
  async sendDrillPracticeMessage(options: {
    drillId: string;
    userMessage: string;
    conversationHistory?: Array<{ role: "user" | "model"; content: string }>;
    temperature?: number;
  }): Promise<{
    response: string;
    audioBase64: string | null;
    audioMimeType: string | null;
    drillType: string;
    drillTitle: string;
  }> {
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
      const error = await response
        .json()
        .catch(() => ({ message: "Failed to get drill practice response" }));
      throw new Error(error.message || "Failed to get drill practice response");
    }

    const data = await response.json();
    return data.data;
  },

  /**
   * Get initial greeting for drill-aware conversation
   */
  async getDrillPracticeGreeting(
    drillId: string
  ): Promise<{
    greeting: string;
    audioBase64: string | null;
    audioMimeType: string | null;
    drillType: string;
    drillTitle: string;
  }> {
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
      const error = await response
        .json()
        .catch(() => ({ message: "Failed to get drill practice greeting" }));
      throw new Error(
        error.message || "Failed to get drill practice greeting"
      );
    }

    const data = await response.json();
    return data.data;
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

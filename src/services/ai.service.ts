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

interface ScenarioOptions {
  scenario: string;
  userMessage: string;
  conversationHistory?: ConversationMessage[];
  temperature?: number;
}

/**
 * AI service for conversations and scenarios
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
   * Send a message in a scenario-based conversation
   */
  async sendScenarioMessage(options: ScenarioOptions): Promise<string> {
    const response = await fetch(`${API_BASE_URL}/ai/scenario`, {
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
        .catch(() => ({ message: "Failed to get scenario response" }));
      throw new Error(error.message || "Failed to get scenario response");
    }

    const data = await response.json();
    return data.data.response;
  },

  /**
   * Get initial greeting for a scenario
   */
  async getScenarioGreeting(scenario: string): Promise<string> {
    const response = await fetch(
      `${API_BASE_URL}/ai/scenario/greeting?scenario=${encodeURIComponent(
        scenario
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
        .catch(() => ({ message: "Failed to get scenario greeting" }));
      throw new Error(error.message || "Failed to get scenario greeting");
    }

    const data = await response.json();
    return data.data.greeting;
  },
};

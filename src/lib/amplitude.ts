import { init as initEngagement } from "@amplitude/engagement-browser";
import type { InitOptions as EngagementInitOptions } from "@amplitude/engagement-browser";
import type { Event } from "@amplitude/analytics-types";

const AMPLITUDE_PROXY_PATH = "/api/v1/analytics/amplitude";
const DEVICE_ID_STORAGE_KEY = "eklan_amplitude_device_id";

let engagementBootPromise: Promise<void> | null = null;
let engagementBootStarted = false;
let cachedUserId: string | undefined;

function getApiKey(): string | undefined {
  const apiKey = process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY?.trim();
  return apiKey || undefined;
}

function getAnalyticsServerUrl(): string {
  return `${window.location.origin}${AMPLITUDE_PROXY_PATH}`;
}

function getServerZone(): "US" | "EU" {
  const zone = process.env.NEXT_PUBLIC_AMPLITUDE_SERVER_ZONE?.trim().toUpperCase();
  return zone === "EU" ? "EU" : "US";
}

function shouldLoadEngagement(): boolean {
  const flag = process.env.NEXT_PUBLIC_AMPLITUDE_ENGAGEMENT?.trim().toLowerCase();
  if (flag === "false") return false;
  return Boolean(getApiKey());
}

function getEngagementOptions(): EngagementInitOptions {
  return {
    serverZone: getServerZone(),
    useEngagementDomain: true,
  };
}

function getOrCreateDeviceId(): string {
  const existing = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
  if (existing) return existing;

  const deviceId = crypto.randomUUID();
  localStorage.setItem(DEVICE_ID_STORAGE_KEY, deviceId);
  return deviceId;
}

export function setAmplitudeUserId(userId: string | undefined): void {
  cachedUserId = userId?.trim() || undefined;
}

async function sendAnalyticsEvent(
  eventType: string,
  eventProperties?: Record<string, unknown>,
): Promise<void> {
  const apiKey = getApiKey();
  if (!apiKey || typeof window === "undefined") return;

  const event: Record<string, unknown> = {
    event_type: eventType,
    device_id: getOrCreateDeviceId(),
    time: Date.now(),
  };

  if (cachedUserId) {
    event.user_id = cachedUserId;
  }

  if (eventProperties && Object.keys(eventProperties).length > 0) {
    event.event_properties = eventProperties;
  }

  try {
    await fetch(getAnalyticsServerUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        events: [event],
      }),
      keepalive: true,
    });
  } catch {
    // Analytics must never break the app.
  }
}

function forwardEngagementTrackEvent(event: Event | string): void {
  if (typeof event === "string") {
    void sendAnalyticsEvent(event);
    return;
  }

  const eventType = event.event_type;
  if (typeof eventType !== "string" || !eventType) return;

  const props = event.event_properties as Record<string, unknown> | undefined;
  void sendAnalyticsEvent(eventType, props);
}

function forwardToEngagement(
  eventType: string,
  eventProperties?: Record<string, unknown>,
): void {
  window.engagement?.forwardEvent({
    event_type: eventType,
    event_properties: eventProperties,
  });
}

async function ensureEngagementInitialized(): Promise<void> {
  if (typeof window === "undefined") return;
  if (!shouldLoadEngagement() || engagementBootStarted) return;

  const apiKey = getApiKey();
  if (!apiKey) return;

  if (!engagementBootPromise) {
    engagementBootStarted = true;

    engagementBootPromise = (async () => {
      // Standalone Guides & Surveys — no @amplitude/analytics-browser.
      // The analytics-browser BrowserConfig object was being passed into the
      // engagement CDN bundle and triggered React #31 on React 19.
      initEngagement(apiKey, getEngagementOptions());

      if (!window.engagement) {
        throw new Error("Guides & Surveys stub missing on window.engagement");
      }

      await window.engagement.boot({
        user: () => ({
          user_id: cachedUserId,
          device_id: getOrCreateDeviceId(),
        }),
        integrations: [{ track: forwardEngagementTrackEvent }],
      });
    })().catch((error) => {
      engagementBootStarted = false;
      engagementBootPromise = null;
      if (process.env.NODE_ENV === "development") {
        console.warn(
          "[Amplitude] Guides & Surveys failed to load. Allowlist cdn.amplitude.com / amplitudeengagement.com or disable ad blockers.",
          error,
        );
      }
    });
  }

  await engagementBootPromise;
}

export async function startAmplitude(): Promise<void> {
  await ensureEngagementInitialized();
}

export async function tellAmplitudeScreenChanged(
  screenName: string,
): Promise<void> {
  if (typeof window === "undefined") return;
  if (!getApiKey()) return;

  const eventType = "[Amplitude] Screen Viewed";
  const eventProperties = {
    screen_name: screenName,
    device_platform: "Web",
  };

  await startAmplitude();

  void sendAnalyticsEvent(eventType, eventProperties);
  forwardToEngagement(eventType, eventProperties);
}

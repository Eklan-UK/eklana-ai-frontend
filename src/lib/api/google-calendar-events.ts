import crypto from "crypto";
import config from "./config";

type RuntimeRequire = (name: string) => unknown;

interface GoogleApisRuntime {
  auth: {
    OAuth2: new (clientId: string, clientSecret: string) => {
      setCredentials: (credentials: { refresh_token: string }) => void;
    };
  };
  calendar: (options: {
    version: "v3";
    auth: unknown;
  }) => {
    events: {
      insert: (options: {
        calendarId: string;
        conferenceDataVersion: number;
        requestBody: {
          summary: string;
          description?: string;
          start: { dateTime: string; timeZone: string };
          end: { dateTime: string; timeZone: string };
          attendees: Array<{ email: string }>;
          conferenceData: {
            createRequest: {
              requestId: string;
              conferenceSolutionKey: { type: "hangoutsMeet" };
            };
          };
        };
      }) => Promise<{
        data: {
          id?: string;
          hangoutLink?: string;
          conferenceData?: {
            entryPoints?: Array<{ entryPointType?: string; uri?: string }>;
          };
        };
      }>;
    };
  };
}

export interface CreateGoogleMeetEventInput {
  refreshToken: string;
  summary: string;
  description?: string;
  startIsoUtc: string;
  endIsoUtc: string;
  timezone: string;
  attendees?: string[];
}

export async function createGoogleCalendarEventWithMeetLink(
  input: CreateGoogleMeetEventInput,
): Promise<{ meetingUrl: string; eventId: string }> {
  // Load at runtime so this file still type-checks if package installation is pending.
  let google: GoogleApisRuntime | null = null;
  try {
    const runtimeRequire = eval("require") as RuntimeRequire;
    const googleapisModule = runtimeRequire("googleapis") as
      | { google?: GoogleApisRuntime }
      | undefined;
    google = googleapisModule?.google ?? null;
  } catch {
    google = null;
  }
  if (!google) {
    throw new Error(
      "googleapis package is required for Calendar event creation. Install with: npm install googleapis",
    );
  }

  const clientId = config.GOOGLE_CALENDAR_CLIENT_ID?.trim();
  const clientSecret = config.GOOGLE_CALENDAR_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error(
      "Google Calendar OAuth client is not configured (GOOGLE_CALENDAR_CLIENT_ID/SECRET)",
    );
  }

  const refreshToken = input.refreshToken.trim();
  if (!refreshToken) {
    throw new Error("Google Calendar refresh token is missing for this tutor");
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  const calendar = google.calendar({ version: "v3", auth: oauth2Client });
  const requestId = crypto.randomUUID();
  const attendees =
    input.attendees?.filter((email) => !!email && email.includes("@")).map((email) => ({ email })) ??
    [];

  const response = await calendar.events.insert({
    calendarId: "primary",
    conferenceDataVersion: 1,
    requestBody: {
      summary: input.summary,
      description: input.description,
      start: {
        dateTime: input.startIsoUtc,
        timeZone: input.timezone,
      },
      end: {
        dateTime: input.endIsoUtc,
        timeZone: input.timezone,
      },
      attendees,
      conferenceData: {
        createRequest: {
          requestId,
          conferenceSolutionKey: {
            type: "hangoutsMeet",
          },
        },
      },
    },
  });

  const event = response.data;
  const meetingUrl =
    event.hangoutLink?.trim() ||
    event.conferenceData?.entryPoints?.find((entry) => entry.entryPointType === "video")?.uri?.trim() ||
    "";

  if (!event.id) {
    throw new Error("Google Calendar event created without event id");
  }
  if (!meetingUrl) {
    throw new Error("Google Calendar event created without Meet link");
  }

  return {
    meetingUrl,
    eventId: event.id,
  };
}

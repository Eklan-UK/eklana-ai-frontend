import crypto from "crypto";
import { google as googleApis } from "googleapis";
import config from "./config";

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

  const oauth2Client = new googleApis.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  const calendar = googleApis.calendar({ version: "v3", auth: oauth2Client });
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

/**
 * Remove a primary-calendar event (e.g. before replacing on reschedule). Non-fatal if already removed.
 */
export async function deleteGoogleCalendarEvent(
  refreshToken: string,
  eventId: string,
): Promise<void> {
  const clientId = config.GOOGLE_CALENDAR_CLIENT_ID?.trim();
  const clientSecret = config.GOOGLE_CALENDAR_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error(
      'Google Calendar OAuth client is not configured (GOOGLE_CALENDAR_CLIENT_ID/SECRET)',
    );
  }
  const token = refreshToken.trim();
  if (!token) {
    throw new Error('Google Calendar refresh token is missing for this tutor');
  }
  const id = eventId?.trim();
  if (!id) {
    return;
  }
  const oauth2Client = new googleApis.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: token });
  const calendar = googleApis.calendar({ version: 'v3', auth: oauth2Client });
  await calendar.events.delete({
    calendarId: 'primary',
    eventId: id,
  });
}

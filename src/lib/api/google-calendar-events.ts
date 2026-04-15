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
  // #region agent log
  const _clientId = config.GOOGLE_CALENDAR_CLIENT_ID?.trim();
  const _clientSecret = config.GOOGLE_CALENDAR_CLIENT_SECRET?.trim();
  fetch('http://127.0.0.1:7490/ingest/eeb056aa-00bc-4885-ab3b-35bd1102faa1',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'3e4a0a'},body:JSON.stringify({sessionId:'3e4a0a',location:'google-calendar-events.ts:entry',message:'createGoogleCalendarEventWithMeetLink entry',data:{hasClientId:!!_clientId,hasClientSecret:!!_clientSecret,clientIdPrefix:_clientId?_clientId.substring(0,8):'MISSING',hasRefreshToken:!!input.refreshToken},timestamp:Date.now(),hypothesisId:'H-A,H-B',runId:'post-fix'})}).catch(()=>{});
  // #endregion

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
  // #region agent log
  fetch('http://127.0.0.1:7490/ingest/eeb056aa-00bc-4885-ab3b-35bd1102faa1',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'3e4a0a'},body:JSON.stringify({sessionId:'3e4a0a',location:'google-calendar-events.ts:post-insert',message:'Google Calendar event insert response',data:{hasEventId:!!event.id,hasHangoutLink:!!event.hangoutLink,hasMeetingUrl:!!meetingUrl,conferenceEntryPointCount:event.conferenceData?.entryPoints?.length??0},timestamp:Date.now(),hypothesisId:'H-D'})}).catch(()=>{});
  // #endregion

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

export interface TutorAvailabilityResponse {
  timezone: string;
  weeklyRules: { weekday: number; startMin: number; endMin: number }[];
  exceptions: { date: string; kind: 'block' | 'open' }[];
  bufferMinutes: number;
}

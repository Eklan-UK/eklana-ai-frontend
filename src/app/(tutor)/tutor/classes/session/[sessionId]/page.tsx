import { TutorSessionAttendanceClient } from "./tutor-session-attendance-client";

export const metadata = {
  title: "Session attendance | Tutor",
};

export default async function TutorSessionAttendancePage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return (
    <div className="min-h-screen bg-gray-50 pb-24 pt-6">
      <div className="mx-auto max-w-3xl px-4 md:px-8">
        <TutorSessionAttendanceClient sessionId={sessionId} />
      </div>
    </div>
  );
}

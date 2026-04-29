import { TutorSessionRescheduleClient } from "./tutor-session-reschedule-client";

export const metadata = {
  title: "Reschedule session | Tutor",
};

export default async function TutorRescheduleSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return (
    <div className="min-h-screen bg-gray-50 pb-24 pt-6">
      <div className="mx-auto max-w-3xl px-4 md:px-8">
        <TutorSessionRescheduleClient sessionId={sessionId} />
      </div>
    </div>
  );
}

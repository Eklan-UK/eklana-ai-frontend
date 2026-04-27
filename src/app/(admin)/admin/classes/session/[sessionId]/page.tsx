import { AdminSessionRescheduleClient } from "./admin-session-reschedule-client";

export const metadata = {
  title: "Reschedule session | Eklan",
};

export default async function AdminRescheduleSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return (
    <div className="min-h-screen bg-gray-50 pb-12 pt-6">
      <div className="mx-auto max-w-md px-4 md:max-w-2xl md:px-8">
        <AdminSessionRescheduleClient sessionId={sessionId} />
      </div>
    </div>
  );
}

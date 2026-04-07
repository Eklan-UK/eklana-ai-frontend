import { LearnerSessionClient } from "./learner-session-client";

export const metadata = {
  title: "Class session | Eklan",
};

export default async function LearnerSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return (
    <div className="min-h-screen bg-gray-50 pb-24 pt-6">
      <div className="mx-auto max-w-md px-4 md:max-w-2xl md:px-8">
        <LearnerSessionClient sessionId={sessionId} />
      </div>
    </div>
  );
}

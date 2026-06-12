import { redirect } from "next/navigation";

export default async function LearnerAnalyticsRedirectPage({
  params,
}: {
  params: Promise<{ learnerId: string }>;
}) {
  const { learnerId } = await params;
  redirect(`/admin/analytics?learners=${encodeURIComponent(learnerId)}`);
}

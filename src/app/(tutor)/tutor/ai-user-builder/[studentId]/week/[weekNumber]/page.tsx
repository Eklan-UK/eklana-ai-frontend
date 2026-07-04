import { redirect } from "next/navigation";

export default async function TutorAiUserBuilderWeekRedirectPage({
  params,
}: {
  params: Promise<{ studentId: string; weekNumber: string }>;
}) {
  const { studentId, weekNumber } = await params;
  redirect(`/tutor/ai-drill-builder/${studentId}/week/${weekNumber}`);
}

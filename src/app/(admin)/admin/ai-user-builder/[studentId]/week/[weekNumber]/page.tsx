import { redirect } from "next/navigation";

export default async function AdminAiUserBuilderWeekRedirectPage({
  params,
}: {
  params: Promise<{ studentId: string; weekNumber: string }>;
}) {
  const { studentId, weekNumber } = await params;
  redirect(`/admin/ai-drill-builder/${studentId}/week/${weekNumber}`);
}

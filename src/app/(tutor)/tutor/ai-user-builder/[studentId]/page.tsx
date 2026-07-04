import { redirect } from "next/navigation";

export default async function TutorAiUserBuilderRedirectPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  redirect(`/tutor/ai-drill-builder/${studentId}`);
}

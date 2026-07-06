import { redirect } from "next/navigation";

export default async function AdminAiUserBuilderRedirectPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  redirect(`/admin/ai-drill-builder/${studentId}`);
}

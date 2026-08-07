import { ClinicDetailClient } from "@/components/precision-clinic/ClinicDetailClient";

export default async function PrecisionClinicDrillDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ClinicDetailClient drillId={id} />;
}

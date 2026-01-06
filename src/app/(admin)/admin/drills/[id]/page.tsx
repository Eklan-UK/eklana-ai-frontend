// Server Component - Admin Drill Detail Page
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  ArrowLeft,
  Edit,
  Trash2,
  Users,
  Clock,
  BookOpen,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { getDrillById } from "./get-drill";
import { DrillDetailClient } from "./drill-detail-client";

// Revalidate every 60 seconds (ISR)
export const revalidate = 60;

export default async function AdminDrillDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const drill = await getDrillById(id);

  if (!drill) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Drill not found</h2>
          <Link href="/admin/drill">
            <Button variant="primary">Back to Drills</Button>
          </Link>
        </div>
      </div>
    );
  }

  return <DrillDetailClient drill={drill} drillId={id} />;
}


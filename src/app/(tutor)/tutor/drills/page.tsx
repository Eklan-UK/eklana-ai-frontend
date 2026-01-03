// Server Component with ISR - Drills List Page
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  Plus,
  Search,
  BookOpen,
  Users,
  Clock,
  ChevronRight,
  Edit,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { DrillsListClient } from "./drills-list-client";

// Revalidate every 60 seconds (ISR)
export const revalidate = 60;

import { authenticatedFetch } from '@/lib/api/server-helpers';

async function getDrills() {
  try {
    const response = await authenticatedFetch('/api/v1/tutor/drills', {
      method: 'GET',
    });

    if (!response.ok) {
      return { drills: [], total: 0, limit: 20, offset: 0 };
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to fetch drills:', error);
    return { drills: [], total: 0, limit: 20, offset: 0 };
  }
}

export default async function DrillsPage() {
  const initialData = await getDrills();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Status Bar Space */}
      <div className="h-6"></div>

      <Header title="My Drills" />

      <div className="max-w-7xl mx-auto px-4 py-6 md:px-8">
        {/* Create Button */}
        <div className="mb-6">
          <Link href="/tutor/drills/create">
            <Button variant="primary" size="lg" fullWidth>
              <Plus className="w-5 h-5 mr-2" />
              Create New Drill
            </Button>
          </Link>
        </div>

        {/* Client Component for Interactive Features */}
        <DrillsListClient initialDrills={initialData.drills || []} />
      </div>
    </div>
  );
}

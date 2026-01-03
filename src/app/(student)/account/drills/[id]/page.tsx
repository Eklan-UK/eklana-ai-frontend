import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import DrillPracticeInterface from "@/components/drills/DrillPracticeInterface";

async function getDrill(drillId: string) {
  try {
    const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.toString();

    const response = await fetch(`${baseURL}/api/v1/drills/${drillId}`, {
      credentials: 'include',
      headers: {
        Cookie: cookieHeader,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.drill;
  } catch (error) {
    console.error('Failed to fetch drill:', error);
    return null;
  }
}

export default async function DrillDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const drill = await getDrill(id);

  if (!drill) {
    notFound();
  }

  return <DrillPracticeInterface drill={drill} />;
}


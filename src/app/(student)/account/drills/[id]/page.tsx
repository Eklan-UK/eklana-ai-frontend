import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import DrillPracticeInterface from "@/components/drills/DrillPracticeInterface";

async function getDrill(drillId: string) {
  try {
    // Validate drill ID format (MongoDB ObjectId)
    if (!drillId || typeof drillId !== 'string') {
      console.error('Invalid drill ID:', drillId);
      return null;
    }

    const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.toString();

    console.log(`Fetching drill: ${drillId} from ${baseURL}/api/v1/drills/${drillId}`);

    const response = await fetch(`${baseURL}/api/v1/drills/${drillId}`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Cookie': cookieHeader,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
      // Add timeout for slow connections
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.error(`Failed to fetch drill ${drillId}: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.error('Error response:', errorText);
      return null;
    }

    const data = await response.json();
    
    if (!data || !data.drill) {
      console.error('No drill data in response:', data);
      return null;
    }

    console.log('Successfully fetched drill:', data.drill._id);
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
  
  console.log('DrillDetailPage - ID:', id);

  if (!id) {
    return notFound();
  }

  const drill = await getDrill(id);

  if (!drill) {
    console.error(`Drill not found for ID: ${id}`);
    return notFound();
  }

  return <DrillPracticeInterface drill={drill} />;
}


import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import DrillPracticeInterface from "@/components/drills/DrillPracticeInterface";

async function getDrill(drillId: string, assignmentId?: string) {
  try {
    // Validate drill ID format (MongoDB ObjectId)
    if (!drillId || typeof drillId !== "string") {
      console.error("Invalid drill ID:", drillId);
      return null;
    }

    const baseURL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.toString();

    // Build URL with optional assignmentId query parameter
    const url = assignmentId
      ? `${baseURL}/api/v1/drills/${drillId}?assignmentId=${assignmentId}`
      : `${baseURL}/api/v1/drills/${drillId}`;

    console.log(
      `Fetching drill: ${drillId}${
        assignmentId ? ` with assignment ${assignmentId}` : ""
      }`
    );

    const response = await fetch(url, {
      method: "GET",
      credentials: "include",
      headers: {
        Cookie: cookieHeader,
        "Content-Type": "application/json",
      },
      cache: "no-store",
      // Increased timeout to 30 seconds for slow connections
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      console.error(
        `Failed to fetch drill ${drillId}: ${response.status} ${response.statusText}`
      );
      const errorText = await response.text();
      console.error("Error response:", errorText);
      return null;
    }

    const data = await response.json();

    if (!data || !data.drill) {
      console.error("No drill data in response:", data);
      return null;
    }

    console.log("Successfully fetched drill:", data.drill._id);
    // Return full response including assignment info if available
    return data;
  } catch (error: any) {
    // Handle timeout specifically
    if (error.name === "TimeoutError" || error.name === "AbortError") {
      console.error("Request timed out while fetching drill:", drillId);
    } else {
      console.error("Failed to fetch drill:", error);
    }
    return null;
  }
}

export default async function DrillDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ assignmentId?: string }>;
}) {
  const { id } = await params;
  const { assignmentId } = await searchParams;

  console.log("DrillDetailPage - ID:", id, "AssignmentId:", assignmentId);

  if (!id) {
    return notFound();
  }

  const drillData = await getDrill(id, assignmentId);

  if (!drillData) {
    console.error(`Drill not found for ID: ${id}`);
    return notFound();
  }

  // Extract assignment info if provided in response
  const drill = drillData.drill || drillData;
  const assignmentInfo = drillData.assignment;

  return (
    <DrillPracticeInterface
      drill={drill}
      assignmentId={assignmentId || assignmentInfo?.assignmentId}
    />
  );
}

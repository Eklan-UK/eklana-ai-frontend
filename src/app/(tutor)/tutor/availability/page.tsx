import { Header } from "@/components/layout/Header";
import { TutorAvailabilityClient } from "./tutor-availability-client";

export default function TutorAvailabilityPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="h-6" />
      <Header title="Teaching hours" />
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-8">
        <TutorAvailabilityClient />
      </div>
    </div>
  );
}

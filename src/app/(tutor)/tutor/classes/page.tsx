import { Header } from "@/components/layout/Header";
import { TutorClassesClient } from "./tutor-classes-client";

export default function TutorClassesPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="h-6" />
      <Header title="Classes" />
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-8">
        <TutorClassesClient />
      </div>
    </div>
  );
}

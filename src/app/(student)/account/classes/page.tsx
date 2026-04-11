import { LearnerClassesClient } from "./learner-classes-client";

export const metadata = {
  title: "My Sessions | Eklan",
  description: "Your scheduled sessions, join links, and recordings",
};

export default function LearnerClassesPage() {
  return (
    <div className="min-h-screen bg-white pb-24 pt-6">
      <div className="mx-auto max-w-md px-4 md:max-w-2xl md:px-8">
        <LearnerClassesClient />
      </div>
    </div>
  );
}

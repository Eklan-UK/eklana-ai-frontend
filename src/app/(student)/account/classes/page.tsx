import { LearnerClassesClient } from "./learner-classes-client";

export const metadata = {
  title: "Classes | Eklan",
  description: "Your scheduled classes and join links",
};

export default function LearnerClassesPage() {
  return (
    <div className="min-h-screen bg-gray-50 pb-24 pt-6">
      <div className="mx-auto max-w-2xl px-4 md:px-8">
        <LearnerClassesClient />
      </div>
    </div>
  );
}

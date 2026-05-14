import { redirect } from "next/navigation";
import { LearnerClassesClient } from "./learner-classes-client";
import { getCurrentUser } from "@/app/(student)/account/get-user";
import { isUserSubscribed } from "@/lib/api/user-subscription";

export const metadata = {
  title: "My Sessions | Eklan",
  description: "Your scheduled sessions, join links, and recordings",
};

export default async function LearnerClassesPage() {
  const userData = await getCurrentUser();
  if (!isUserSubscribed(userData?.user)) {
    redirect("/account/settings/subscriptions");
  }

  return (
    <div className="min-h-screen bg-background pb-24 pt-6">
      <div className="mx-auto max-w-md px-4 md:max-w-2xl md:px-8">
        <LearnerClassesClient />
      </div>
    </div>
  );
}

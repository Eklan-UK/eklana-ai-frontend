import type { Metadata } from "next";
import "../globals.css";
import { VerificationGuard } from "@/components/guards/VerificationGuard";
import { OnboardingGuard } from "@/components/guards/OnboardingGuard";
import { RoleGuard } from "@/components/guards/RoleGuard";
import { SubscriptionGuard } from "@/components/guards/SubscriptionGuard";
import { StreakActivityPing } from "@/components/streak/StreakActivityPing";
import { StudentIntlProvider } from "@/components/providers/StudentIntlProvider";

export const metadata: Metadata = {
  title: "Eklan - Create Your Future",
  description: "Make English speaking feel natural with AI-powered practice",
};

export default function StudentLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <RoleGuard allowedRoles={['user']}>
      <VerificationGuard>
        <OnboardingGuard>
          <SubscriptionGuard>
            <StreakActivityPing />
            <StudentIntlProvider>{children}</StudentIntlProvider>
          </SubscriptionGuard>
        </OnboardingGuard>
      </VerificationGuard>
    </RoleGuard>
  );
}

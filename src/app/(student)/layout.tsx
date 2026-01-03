import type { Metadata } from "next";
import "../globals.css";
import { VerificationGuard } from "@/components/guards/VerificationGuard";
import { OnboardingGuard } from "@/components/guards/OnboardingGuard";
import { RoleGuard } from "@/components/guards/RoleGuard";

export const metadata: Metadata = {
  title: "eklan AI - English Learning Platform",
  description: "Make English speaking feel natural with AI-powered practice",
};

export default function StudentLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <RoleGuard allowedRoles={['learner']}>
      <VerificationGuard>
        <OnboardingGuard>{children}</OnboardingGuard>
      </VerificationGuard>
    </RoleGuard>
  );
}

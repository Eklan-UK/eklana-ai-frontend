import type { Metadata } from "next";
import "../../globals.css";
import { TutorNav } from "@/components/layout/TutorNav";
import { RoleGuard } from "@/components/guards/RoleGuard";

export const metadata: Metadata = {
  title: "Tutor Dashboard - eklan AI",
  description: "Manage your students and create drills",
};

export default function TutorLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <RoleGuard allowedRoles={['tutor']}>
      <div className="min-h-screen bg-gray-50 flex">
        <TutorNav />
        <main className="flex-1 md:ml-0">{children}</main>
      </div>
    </RoleGuard>
  );
}


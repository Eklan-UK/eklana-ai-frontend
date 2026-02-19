import type { Metadata } from "next";
import Layout from "@/components/admin/Layout";
import { RoleGuard } from "@/components/guards/RoleGuard";

export const metadata: Metadata = {
  title: "Admin Dashboard - Eklan",
  description: "Admin dashboard for managing learners, drills, and analytics",
};

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <RoleGuard allowedRoles={['admin']}>
      <Layout>{children}</Layout>
    </RoleGuard>
  );
}


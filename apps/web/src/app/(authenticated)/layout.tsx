"use client";

import AppSidebar from "@/components/app-sidebar";
import AuthGuard from "@/components/auth-guard";

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <AppSidebar>{children}</AppSidebar>
    </AuthGuard>
  );
}

import type { ReactNode } from "react";
import { AdminAuthGate } from "@/components/admin/shell/AdminAuthGate";
import { AppShell } from "@/components/admin/shell/AppShell";

export default function WebsiteModuleLayout({ children }: { children: ReactNode }) {
  return (
    <AdminAuthGate>
      <AppShell module="website">{children}</AppShell>
    </AdminAuthGate>
  );
}

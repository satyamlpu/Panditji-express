import type { ReactNode } from "react";
import { AdminAuthGate } from "@/components/admin/shell/AdminAuthGate";
import { CenterChrome } from "@/components/admin/shell/CenterChrome";

export default function CenterLayout({ children }: { children: ReactNode }) {
  return (
    <AdminAuthGate>
      <CenterChrome>{children}</CenterChrome>
    </AdminAuthGate>
  );
}

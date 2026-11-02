"use client";

import type { ReactNode } from "react";
import type { ModuleId } from "@/config/admin-nav";
import { useAuth } from "@/hooks/useAuth";
import { SidebarProvider } from "./SidebarContext";
import { ToastProvider } from "../toast";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

/** Full-width responsive admin shell for one module (Website or App & CRM). */
export function AppShell({ module, children }: { module: ModuleId; children: ReactNode }) {
  const { data: me } = useAuth();
  return (
    <SidebarProvider>
      <ToastProvider>
        <div className="admin-ui flex min-h-screen w-full bg-surface-2">
          <Sidebar module={module} email={me?.email} />
          <div className="flex min-w-0 flex-1 flex-col">
            <Topbar module={module} email={me?.email} />
            <main className="min-w-0 flex-1 p-5 md:p-8">{children}</main>
          </div>
        </div>
      </ToastProvider>
    </SidebarProvider>
  );
}

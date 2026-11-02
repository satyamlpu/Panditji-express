"use client";

import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

interface SidebarState {
  collapsed: boolean;
  toggleCollapsed: () => void;
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
}

const Ctx = createContext<SidebarState>({
  collapsed: false,
  toggleCollapsed: () => {},
  drawerOpen: false,
  setDrawerOpen: () => {},
});

const KEY = "admin:sidebar:collapsed";

export function SidebarProvider({ children }: { children: ReactNode }) {
  // Default on the server; reconcile with localStorage after mount to avoid a
  // hydration mismatch.
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    try {
      const v = localStorage.getItem(KEY);
      if (v === "1") setCollapsed(true);
    } catch {
      /* storage unavailable */
    }
  }, []);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  return (
    <Ctx.Provider value={{ collapsed, toggleCollapsed, drawerOpen, setDrawerOpen }}>
      {children}
    </Ctx.Provider>
  );
}

export const useSidebar = () => useContext(Ctx);

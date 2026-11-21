import { api } from "@/lib/api";

export type StaffRole = "ops" | "verification" | "finance" | "support" | "marketing" | "admin";
export type StaffStatus = "active" | "disabled";

export interface Staff {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  status: string;
  created_at: string;
}

const BASE = "/api/v1/admin/staff";

export const staffApi = {
  list: () => api.get<Staff[]>(BASE),
  update: (id: string, data: { role?: StaffRole; status?: StaffStatus }) =>
    api.patch<Staff>(`${BASE}/${id}`, data),
};

export const ROLE_OPTIONS: StaffRole[] = [
  "admin",
  "ops",
  "verification",
  "finance",
  "support",
  "marketing",
];

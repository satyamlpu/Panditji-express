"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  DataTable,
  EmptyState,
  LoadingSkeleton,
  PageHeader,
  StatusBadge,
  Td,
  Th,
  selectClass,
} from "@/components/admin/kit";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { ROLE_OPTIONS, staffApi, type Staff, type StaffRole } from "@/features/staff/api";

export default function StaffPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["staff"], queryFn: staffApi.list });

  const update = useMutation({
    mutationFn: ({ id, ...data }: { id: string; role?: StaffRole; status?: "active" | "disabled" }) =>
      staffApi.update(id, data),
    onSuccess: () => {
      toast.success("Staff updated");
      qc.invalidateQueries({ queryKey: ["staff"] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Failed"),
  });

  return (
    <div>
      <PageHeader
        title="Staff & Roles"
        description="Assign roles and enable/disable staff accounts. Roles are enforced on every admin and marketplace endpoint. (Account creation is managed separately.)"
      />

      {isLoading ? (
        <LoadingSkeleton rows={3} />
      ) : !data?.length ? (
        <EmptyState icon="security" title="No staff accounts" description="Staff accounts appear here once created." />
      ) : (
        <DataTable>
          <thead>
            <tr>
              <Th>Email</Th>
              <Th>Name</Th>
              <Th>Role</Th>
              <Th>Status</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {data.map((u: Staff) => (
              <tr key={u.id}>
                <Td>{u.email}</Td>
                <Td>{u.full_name ?? "—"}</Td>
                <Td>
                  <select
                    className={selectClass}
                    value={u.role}
                    disabled={update.isPending}
                    onChange={(e) =>
                      update.mutate({ id: u.id, role: e.target.value as StaffRole })
                    }
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </Td>
                <Td>
                  <StatusBadge status={u.status} />
                </Td>
                <Td className="text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={update.isPending}
                    onClick={() =>
                      update.mutate({
                        id: u.id,
                        status: u.status === "active" ? "disabled" : "active",
                      })
                    }
                  >
                    {u.status === "active" ? "Disable" : "Enable"}
                  </Button>
                </Td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      )}
    </div>
  );
}

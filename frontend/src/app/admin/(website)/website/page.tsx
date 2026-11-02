"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { servicesApi } from "@/features/services/api";
import { enquiriesApi } from "@/features/enquiries/api";
import { Icon } from "@/components/admin/icons";
import { MetricCard, PageHeader, StatusBadge } from "@/components/admin/kit";

export default function WebsiteDashboard() {
  const services = useQuery({
    queryKey: ["admin", "services", "all"],
    queryFn: () => servicesApi.list({}),
  });
  const enquiries = useQuery({
    queryKey: ["admin", "enquiries", "recent"],
    queryFn: () => enquiriesApi.list({}),
  });

  const items = services.data?.items ?? [];
  const published = items.filter((s) => s.status === "published").length;
  const drafts = items.filter((s) => s.status === "draft").length;
  const newEnquiries = enquiries.data?.items.filter((e) => e.status === "new").length ?? 0;

  return (
    <div>
      <PageHeader
        title="Website Dashboard"
        description="Overview of your public-site content and booking enquiries."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Published pujas" value={published} loading={services.isLoading} icon="services" tone="forest" />
        <MetricCard label="Drafts" value={drafts} loading={services.isLoading} icon="pages" />
        <MetricCard label="New enquiries" value={newEnquiries} loading={enquiries.isLoading} icon="enquiries" tone="gold" />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Link
          href="/admin/services"
          className="group flex items-center justify-between rounded-card border border-line bg-surface p-5 shadow-soft hover:shadow-soft-lg"
        >
          <span className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-forest/10 text-forest">
              <Icon name="services" size={20} />
            </span>
            <span>
              <span className="block font-semibold text-ink">Manage services</span>
              <span className="text-sm text-muted">Create, edit, price and publish pujas</span>
            </span>
          </span>
          <Icon name="arrowRight" size={18} className="text-muted transition-transform group-hover:translate-x-0.5" />
        </Link>

        <Link
          href="/admin/enquiries"
          className="group flex items-center justify-between rounded-card border border-line bg-surface p-5 shadow-soft hover:shadow-soft-lg"
        >
          <span className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-sunshine/20 text-[#7a5a00]">
              <Icon name="enquiries" size={20} />
            </span>
            <span>
              <span className="block font-semibold text-ink">Booking enquiries</span>
              <span className="text-sm text-muted">Review and manage customer requests</span>
            </span>
          </span>
          <Icon name="arrowRight" size={18} className="text-muted transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

      <div className="mt-4 rounded-card border border-line bg-surface p-5 shadow-soft">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-ink">Recent enquiries</h2>
          <Link href="/admin/enquiries" className="text-sm font-medium text-forest hover:underline">
            View all
          </Link>
        </div>
        {enquiries.isLoading ? (
          <div className="space-y-2 pt-3">
            <div className="h-10 animate-pulse rounded-lg bg-surface-2" />
            <div className="h-10 animate-pulse rounded-lg bg-surface-2" />
          </div>
        ) : enquiries.data?.items.length ? (
          <ul className="mt-3 divide-y divide-line">
            {enquiries.data.items.slice(0, 5).map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">
                    {e.name} · {e.phone}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {e.service_title_snapshot ?? "General enquiry"}
                  </p>
                </div>
                <StatusBadge status={e.status} tone={e.status === "new" ? "gold" : "neutral"} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-6 text-center text-sm text-muted">No enquiries yet.</p>
        )}
      </div>
    </div>
  );
}

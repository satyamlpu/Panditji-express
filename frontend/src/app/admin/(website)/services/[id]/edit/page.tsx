"use client";

import Link from "next/link";
import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { ServiceForm } from "@/features/services/ServiceForm";
import { servicesApi } from "@/features/services/api";
import { Spinner } from "@/components/ui/spinner";

export default function EditServicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin", "service", id],
    queryFn: () => servicesApi.get(id),
  });

  return (
    <div>
      <Link
        href="/admin/services"
        className="inline-flex items-center gap-1 text-sm font-medium text-forest hover:underline"
      >
        <ArrowLeft size={15} /> Services
      </Link>
      <h1 className="mt-2 font-display text-2xl font-bold text-ink">Edit service</h1>
      <p className="mb-6 mt-1 text-sm text-muted">
        Changes to a published puja appear on the public site automatically.
      </p>

      {isLoading ? (
        <div className="py-16 text-center">
          <Spinner className="text-forest" />
        </div>
      ) : isError || !data ? (
        <p className="rounded-card border border-line bg-surface p-6 text-sm text-tomato">
          Could not load this service. It may have been deleted.
        </p>
      ) : (
        <ServiceForm initial={data} />
      )}
    </div>
  );
}

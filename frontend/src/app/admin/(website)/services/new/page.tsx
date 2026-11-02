"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ServiceForm } from "@/features/services/ServiceForm";

export default function NewServicePage() {
  return (
    <div>
      <Link
        href="/admin/services"
        className="inline-flex items-center gap-1 text-sm font-medium text-forest hover:underline"
      >
        <ArrowLeft size={15} /> Services
      </Link>
      <h1 className="mt-2 font-display text-2xl font-bold text-ink">New service</h1>
      <p className="mb-6 mt-1 text-sm text-muted">
        Create a puja. Save as a draft first, then publish when ready.
      </p>
      <ServiceForm />
    </div>
  );
}

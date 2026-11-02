"use client";

import { EmptyState, PageHeader } from "@/components/admin/kit";

export default function CustomersPage() {
  return (
    <div>
      <PageHeader
        title="Customers"
        description="Customer directory, profiles, booking and support history."
      />
      <EmptyState
        icon="customers"
        title="Customer CRM arrives in the next phase"
        description="A full customer directory with profiles, booking and payment history, support history and internal notes is planned next. Customer details are visible today within each booking under Bookings."
      />
    </div>
  );
}

"use client";

import { EmptyState, PageHeader } from "@/components/admin/kit";

export default function MediaLibraryPage() {
  return (
    <div>
      <PageHeader
        title="Media Library"
        description="Centralized images and media for the public website."
      />
      <EmptyState
        icon="media"
        title="Media Library arrives in the next phase"
        description="Centralized uploads with alt text, image search, usage checks before deletion, and WebP/AVIF optimization backed by object storage are planned next. For now, images are uploaded inline on each page (Services, Homepage, Testimonials)."
      />
    </div>
  );
}

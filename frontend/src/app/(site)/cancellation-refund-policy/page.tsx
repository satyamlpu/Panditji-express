import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MarkdownPage } from "@/components/site/MarkdownPage";
import { fetchPage } from "@/lib/serverApi";

export const revalidate = 3600;
const SLUG = "cancellation-refund-policy";

export async function generateMetadata(): Promise<Metadata> {
  const page = await fetchPage(SLUG);
  if (!page) return { title: "Cancellation & Refund Policy" };
  return {
    title: page.seo.title,
    description: page.seo.description ?? undefined,
    alternates: { canonical: page.seo.canonical_path },
  };
}

export default async function CancellationRefundPage() {
  const page = await fetchPage(SLUG);
  if (!page) notFound();
  return <MarkdownPage page={page} eyebrow="Policy" />;
}

import { PageHero } from "@/components/site/PageHero";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { renderMarkdown } from "@/lib/markdown";
import type { PageContent } from "@/lib/types";

/** Renders a DB-backed Markdown page (about, contact, policies) with a hero,
 * breadcrumbs and sanitised prose. */
export function MarkdownPage({
  page,
  eyebrow,
}: {
  page: PageContent;
  eyebrow?: string;
}) {
  const html = renderMarkdown(page.body);
  return (
    <>
      <PageHero eyebrow={eyebrow} title={page.title} />
      <div className="container-pad py-8">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: page.title, href: `/${page.slug}` },
          ]}
        />
        <article
          className="prose mt-6 max-w-2xl"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </>
  );
}

import type { ReactNode } from "react";

/** A restrained page header used across section pages (catalog, locations,
 * policies). Kept distinct from the homepage hero so pages don't look identical. */
export function PageHero({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="border-b border-line bg-surface-2">
      <div className="container-pad py-10 md:py-14">
        {eyebrow && (
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-kiwi">
            {eyebrow}
          </p>
        )}
        <h1 className="max-w-2xl font-display text-3xl font-bold text-ink md:text-4xl">
          {title}
        </h1>
        {description && (
          <p className="mt-3 max-w-2xl text-base text-muted">{description}</p>
        )}
        {children && <div className="mt-6">{children}</div>}
      </div>
    </div>
  );
}

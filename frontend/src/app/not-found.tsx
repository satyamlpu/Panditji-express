import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col">
      <div className="brand-rule" aria-hidden />
      <header className="border-b border-line">
        <div className="container-pad flex h-16 items-center">
          <Link href="/" className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-full.svg" alt="Pandit Ji Express" className="h-9 w-auto" />
          </Link>
        </div>
      </header>

      <main className="container-pad flex flex-1 flex-col items-center justify-center py-24 text-center">
        <p className="font-display text-6xl font-bold text-forest/30">404</p>
        <h1 className="mt-4 font-display text-2xl font-bold text-ink">
          This page could not be found
        </h1>
        <p className="mt-2 max-w-md text-muted">
          The page you&rsquo;re looking for may have moved or no longer exists.
          Let&rsquo;s get you back on track.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link href="/" className={buttonClasses("primary", "md")}>
            Go home
          </Link>
          <Link href="/puja-services" className={buttonClasses("outline", "md")}>
            Browse pujas
          </Link>
        </div>
      </main>
    </div>
  );
}

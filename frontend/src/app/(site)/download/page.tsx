import type { Metadata } from "next";
import Link from "next/link";
import QRCode from "qrcode";
import { Smartphone, Apple, Download, ShieldCheck } from "lucide-react";
import { PageHero } from "@/components/site/PageHero";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { buttonClasses } from "@/components/ui/button";
import { fetchAppReleases, type AppReleasePublic } from "@/lib/serverApi";

export const revalidate = 300;

/** Server-side QR SVG for a (trusted, server-known) download URL. Returns null
 *  if generation fails, so a bad URL never breaks the page. */
async function qrSvg(url: string): Promise<string | null> {
  try {
    return await QRCode.toString(url, {
      type: "svg",
      margin: 0,
      width: 104,
      color: { dark: "#1f2937", light: "#ffffff" },
    });
  } catch {
    return null;
  }
}

export const metadata: Metadata = {
  title: "Download the apps",
  description:
    "Download the Pandit Ji Express Customer and Panditji Partner apps for Android and iOS.",
  alternates: { canonical: "/download" },
};

type AppType = "customer" | "partner";
type Platform = "android" | "ios";

// How a given (platform, channel) is presented. Production → store listing;
// beta → APK (Android) / TestFlight (iOS). Labels are presentational only.
function optionLabel(platform: Platform, channel: string): string {
  if (channel === "production") return platform === "android" ? "Google Play" : "App Store";
  return platform === "android" ? "Android beta (APK)" : "iOS TestFlight";
}

function pick(
  releases: AppReleasePublic[],
  app: AppType,
  platform: Platform,
): AppReleasePublic[] {
  return releases
    .filter((r) => r.app_type === app && r.platform === platform && r.download_url)
    .sort((a, b) => (a.channel < b.channel ? 1 : -1)); // production before beta
}

async function PlatformBlock({
  releases,
  app,
  platform,
}: {
  releases: AppReleasePublic[];
  app: AppType;
  platform: Platform;
}) {
  const options = pick(releases, app, platform);
  const Icon = platform === "android" ? Smartphone : Apple;
  const name = platform === "android" ? "Android" : "iOS";
  const qrs = await Promise.all(options.map((r) => qrSvg(r.download_url as string)));
  return (
    <div className="rounded-xl border border-line bg-surface-2 p-4">
      <div className="flex items-center gap-2 text-ink">
        <Icon size={18} />
        <span className="font-semibold">{name}</span>
      </div>
      {options.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Coming soon — not yet available.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {options.map((r, i) => (
            <li key={`${r.channel}-${r.version}`}>
              <a
                href={r.download_url as string}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonClasses("primary", "sm", "w-full justify-center")}
              >
                <Download size={15} /> {optionLabel(platform, r.channel)}
              </a>
              <p className="mt-1 text-center text-xs text-muted">
                v{r.version}
                {r.build_number != null ? ` (build ${r.build_number})` : ""}
                {r.checksum_sha256 ? " · SHA-256 verified" : ""}
              </p>
              {qrs[i] && (
                <div className="mt-2 hidden flex-col items-center sm:flex">
                  <div
                    className="rounded-lg border border-line bg-white p-2"
                    aria-hidden
                    // Trusted: SVG generated server-side from our own release URL.
                    dangerouslySetInnerHTML={{ __html: qrs[i] as string }}
                  />
                  <p className="mt-1 text-center text-[11px] text-muted">
                    Scan to open on your phone
                  </p>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AppCard({
  releases,
  app,
  title,
  blurb,
}: {
  releases: AppReleasePublic[];
  app: AppType;
  title: string;
  blurb: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm">
      <h2 className="font-display text-xl font-bold text-ink">{title}</h2>
      <p className="mt-1 text-sm text-muted">{blurb}</p>
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <PlatformBlock releases={releases} app={app} platform="android" />
        <PlatformBlock releases={releases} app={app} platform="ios" />
      </div>
    </div>
  );
}

const FAQS = [
  {
    q: "Is the app free to download?",
    a: "Yes. Both the Customer and Panditji Partner apps are free to download. You only pay for the pujas you book.",
  },
  {
    q: "The app isn't available for my platform yet — what do I do?",
    a: "We're rolling out in stages. Where a build shows 'Coming soon', it isn't released yet. You can book from this website in the meantime.",
  },
  {
    q: "How do I install the Android beta (APK)?",
    a: "Tap the APK download, then open the file. You may need to allow installs from your browser in Android settings. Only install builds linked from this official page.",
  },
  {
    q: "How do I join the iOS TestFlight beta?",
    a: "Tap the TestFlight link, install Apple's TestFlight app if prompted, and accept the invite to install the beta.",
  },
];

export default async function DownloadPage() {
  const releases = await fetchAppReleases();

  return (
    <>
      <PageHero
        eyebrow="Get the app"
        title="Download Pandit Ji Express"
        description="Book verified Panditjis on the go, or manage your bookings as a partner — on Android and iOS."
      />
      <div className="container-pad py-8">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Download", href: "/download" },
          ]}
        />

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <AppCard
            releases={releases}
            app="customer"
            title="Customer app"
            blurb="Discover nearby Panditjis, book pujas, track your booking and pay securely."
          />
          <AppCard
            releases={releases}
            app="partner"
            title="Panditji Partner app"
            blurb="Receive booking requests, manage availability, complete pujas and track earnings."
          />
        </div>

        <section className="mt-10">
          <h2 className="font-display text-lg font-bold text-ink">Installation help</h2>
          <p className="mt-2 flex items-center gap-2 text-sm text-muted">
            <ShieldCheck size={16} className="text-forest" />
            Only download from this official page. Where a build shows a SHA-256, verify it
            after download.
          </p>
        </section>

        <section className="mt-8">
          <h2 className="font-display text-lg font-bold text-ink">FAQs</h2>
          <dl className="mt-3 space-y-4">
            {FAQS.map((f) => (
              <div key={f.q}>
                <dt className="font-medium text-ink">{f.q}</dt>
                <dd className="mt-1 text-sm text-muted">{f.a}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-8 flex flex-wrap gap-4 text-sm">
          <Link href="/privacy-policy" className="text-forest underline underline-offset-2">
            Privacy policy
          </Link>
          <Link href="/contact-us" className="text-forest underline underline-offset-2">
            Support &amp; contact
          </Link>
          <Link href="/terms-and-conditions" className="text-forest underline underline-offset-2">
            Terms
          </Link>
        </section>
      </div>
    </>
  );
}

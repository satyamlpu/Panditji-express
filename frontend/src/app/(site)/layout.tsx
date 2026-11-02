import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { fetchSettings } from "@/lib/serverApi";

export default async function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const settings = await fetchSettings();
  const siteName = settings.site?.name ?? "Pandit Ji Express";

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader siteName={siteName} nav={settings.nav} />
      <main className="flex-1">{children}</main>
      <SiteFooter settings={settings} />
    </div>
  );
}

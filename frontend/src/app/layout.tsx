import type { Metadata } from "next";
import { Archivo, Inter, Noto_Sans_Devanagari } from "next/font/google";
import { Providers } from "@/lib/providers";
import { SITE_URL } from "@/lib/config";
import "./globals.css";

const display = Archivo({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["500", "600", "700", "800"],
});

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const deva = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  variable: "--font-deva",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Pandit Ji Express — Book pandits for authentic pujas",
    template: "%s | Pandit Ji Express",
  },
  description:
    "Book verified, experienced pandits for authentic pujas with transparent pricing and samagri included.",
  openGraph: {
    type: "website",
    siteName: "Pandit Ji Express",
    locale: "en_IN",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${sans.variable} ${deva.variable}`}
    >
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

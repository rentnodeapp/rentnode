import type { Metadata, Viewport } from "next";
import { Newsreader, JetBrains_Mono } from "next/font/google";
import { Providers } from "./providers.tsx";
import "./globals.css";

/* An editorial serif for display and body, a technical mono for every label -
   the pairing the reference uses, and the reason the page reads as a datasheet
   rather than a product site. */
const display = Newsreader({ subsets: ["latin"], weight: ["400", "500", "600"], style: ["normal", "italic"], variable: "--font-display", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono", display: "swap" });

const TITLE = "Rent compute, metered by the second";
const DESCRIPTION =
  "List a GPU, CPU, disk or database and get paid per second. Renters escrow USDG and can stop any time - every unspent cent comes back. Settled on RH Chain.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  applicationName: "Compute Market",
  openGraph: { type: "website", title: TITLE, description: DESCRIPTION, url: "/" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export const viewport: Viewport = { themeColor: "#efeee6", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${mono.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import { Providers } from "./providers.tsx";
import "./globals.css";

/* Manrope carries the references' look: geometric, very tight at display sizes,
   and it ships a 800 weight for the headline. */
const sans = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
  display: "swap",
});

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

export const viewport: Viewport = { themeColor: "#dcf94f", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={sans.variable}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

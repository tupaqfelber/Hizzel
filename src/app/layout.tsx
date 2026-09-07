import type { Metadata, Viewport } from "next";
import { DM_Serif_Display, Playfair_Display, DM_Sans } from "next/font/google";
import { AppProviders } from "@/components/providers/app-providers";
import "./globals.css";

const dmSerifDisplay = DM_Serif_Display({
  variable: "--font-dm-serif-display",
  subsets: ["latin"],
  weight: "400",
});

const playfairDisplay = Playfair_Display({
  variable: "--font-playfair-display",
  subsets: ["latin"],
  style: ["italic"],
  weight: "400",
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
});

export const metadata: Metadata = {
  title: "Hizzel",
  description: "Your things. Your homes. Your moves, made simple.",
  // "capable" is what actually gets iOS Safari to launch the home-screen
  // icon standalone (no address bar/browser chrome) instead of opening a
  // normal Safari tab — the icon itself and this title come from the same
  // apple-icon.png / appleWebApp block regardless. Only Safari honors
  // this; Chrome on iOS has no standalone-launch mode at all (an Apple
  // platform restriction — "Add to Home Screen" there just bookmarks back
  // into Chrome's own UI, no web config changes that). Android Chrome
  // (and desktop Chrome's "Install app") get their own standalone launch
  // from manifest.ts instead, which Chrome actually does honor.
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Hizzel",
  },
  // Next.js's own appleWebApp.capable only emits the newer, unprefixed
  // "mobile-web-app-capable" tag — inconsistently honored on older iOS
  // versions, which look for the legacy "apple-" prefixed name
  // specifically. Adding both costs nothing and covers more devices.
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
};

// No user-scalable pinch/double-tap-zoom — this is an app-like canvas with
// its own gestures (drag, double-tap-to-jump); the browser's native zoom
// would fight those, and double-tap-to-zoom was swallowing the second tap
// of the double-tap-to-jump gesture entirely.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  // Matches manifest.ts's background_color/theme_color (--color-linen) —
  // colors the browser's own UI (Android's toolbar, a standalone launch's
  // brief blank frame before the app paints) instead of defaulting to
  // white/black.
  themeColor: "#f5f2ec",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${dmSerifDisplay.variable} ${playfairDisplay.variable} ${dmSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}

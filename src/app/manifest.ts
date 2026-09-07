import type { MetadataRoute } from "next";

// Next.js's own file-based convention — this is auto-linked as
// <link rel="manifest"> on every page, no manual tag needed (same
// mechanism as icon.png / apple-icon.png being auto-linked).
//
// This is what Android Chrome (and desktop Chrome's "Install app") reads
// to decide how a home-screen/installed shortcut launches. iOS Safari
// ignores this file entirely — its own standalone-launch behavior comes
// from the apple-mobile-web-app-* meta tags in layout.tsx instead. iOS
// Chrome honors neither: Apple only grants standalone-app launching to
// Safari itself, a platform restriction no web config can work around.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hizzel",
    short_name: "Hizzel",
    description: "Your things. Your homes. Your moves, made simple.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f2ec",
    theme_color: "#f5f2ec",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

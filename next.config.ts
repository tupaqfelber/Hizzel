import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets the dev server accept requests (and hot-reload websocket connections)
  // from other devices/origins, e.g. testing on a phone via LAN IP or through
  // an ngrok tunnel (needed whenever the phone can't reach the Mac's LAN IP
  // directly, e.g. hotel wifi with client isolation). Without the tunnel's
  // hostname listed here, Next.js blocks its hot-reload websocket, which
  // makes the dev client repeatedly retry/reload the page — breaking any
  // in-progress interaction (a typed email getting wiped mid-submit, etc.)
  // even though the app itself is otherwise working fine.
  allowedDevOrigins: ["172.20.13.69", "*.ngrok-free.dev", "*.ngrok-free.app"],
};

export default nextConfig;

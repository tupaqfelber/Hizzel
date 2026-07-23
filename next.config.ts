import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets the dev server accept requests (and hot-reload websocket connections)
  // from other devices on the same Wi-Fi, e.g. testing on a phone via LAN IP.
  allowedDevOrigins: ["192.168.1.225"],
};

export default nextConfig;

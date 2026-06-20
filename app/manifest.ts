import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "慢慢说",
    short_name: "慢慢说",
    description: "陪老人把手机问题看懂、说清楚",
    start_url: "/",
    display: "standalone",
    background_color: "#fbfaf6",
    theme_color: "#0f4f41",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" }
    ]
  };
}

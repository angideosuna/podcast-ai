import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PodCast.ai",
    short_name: "PodCast.ai",
    description: "Podcasts diarios personalizados con IA",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#F5F0EB",
    theme_color: "#1A3C34",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}

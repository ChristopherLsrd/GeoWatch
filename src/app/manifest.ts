// Manifeste PWA : installation sur l'écran d'accueil d'Android et entrée « GeoWatch » dans le menu Partager.

import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GeoWatch",
    short_name: "GeoWatch",
    description: "Où regarder un film ou une série, dans quels pays et dans quelles langues.",
    lang: "fr",
    start_url: "/",
    display: "standalone",
    background_color: "#0d1015",
    theme_color: "#0d1015",
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png" },
      { src: "/icons/512", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    share_target: {
      action: "/partage",
      method: "GET",
      params: { title: "title", text: "text", url: "url" },
    },
  };
}

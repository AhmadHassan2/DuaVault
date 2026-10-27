import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DuaVault",
    short_name: "DuaVault",
    description: "Your personal library of duas, verses and reminders — saved, understood, remembered, practiced.",
    start_url: "/home",
    scope: "/",
    display: "standalone",
    background_color: "#f6f2ea",
    theme_color: "#2f5f48",
    orientation: "portrait",
    categories: ["lifestyle", "education", "books"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
    // Web Share Target (Chromium on Android, once installed). Not supported by iOS Safari.
    share_target: {
      action: "/share-target",
      method: "POST",
      enctype: "multipart/form-data",
      params: { title: "title", text: "text", url: "url", files: [{ name: "images", accept: ["image/*"] }] },
    },
  };
}

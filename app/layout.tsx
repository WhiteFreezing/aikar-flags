import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aikar Flags Generator · aikar.wfrz.eu",
  description:
    "Generate optimized JVM flags, Pterodactyl egg JSON and docker run commands for Minecraft servers. PaperMC's Aikar-tuned G1GC defaults + ZGC for big heaps.",
  authors: [{ name: "whitefreezing", url: "https://github.com/WhiteFreezing" }],
  openGraph: {
    title: "Aikar Flags Generator",
    description:
      "JVM flags, Pterodactyl egg + Docker command for any Minecraft server. Aikar's tuned G1GC.",
    url: "https://aikar.wfrz.eu",
    siteName: "aikar.wfrz.eu",
    type: "website",
  },
  twitter: { card: "summary_large_image", title: "Aikar Flags Generator" },
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}

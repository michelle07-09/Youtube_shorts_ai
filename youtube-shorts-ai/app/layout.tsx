// app/layout.tsx — Server Component (no "use client")
import type { Metadata } from "next";
import NavBar from "@/components/NavBar";
import "./globals.css";

export const metadata: Metadata = {
  title: "YouTube Shorts AI Pipeline",
  description:
    "Fully automated AI-powered YouTube Shorts generation — Script → Images → Video → Audio → Upload",
  keywords: ["youtube shorts", "ai", "automation", "content creation", "horror stories"],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="bg-grid" suppressHydrationWarning>
        <NavBar />
        <main style={{ paddingTop: "60px", minHeight: "100vh" }}>{children}</main>
      </body>
    </html>
  );
}

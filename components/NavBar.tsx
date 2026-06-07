"use client";

// components/NavBar.tsx
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";

const NAV_LINKS = [
  { href: "/", label: "🏠 Dashboard" },
  { href: "/autopilot", label: "🤖 Autopilot" },
  { href: "/pipeline", label: "⚡ Pipeline" },
  { href: "/history", label: "📋 History" },
  { href: "/settings", label: "⚙️ Settings" },
];

export default function NavBar() {
  const pathname = usePathname();

  // Boot the cron scheduler on first load
  useEffect(() => {
    fetch("/api/scheduler/init").catch(() => {});
  }, []);
  return (
    <nav
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        height: "60px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
        background: "rgba(5, 5, 8, 0.85)",
        backdropFilter: "blur(20px)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      {/* Logo */}
      <Link href="/" style={{ display: "flex", alignItems: "center", gap: "12px", textDecoration: "none" }}>
        <div
          style={{
            width: "32px",
            height: "32px",
            borderRadius: "10px",
            background: "linear-gradient(135deg, #6c47ff, #00d4ff)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "18px",
            flexShrink: 0,
          }}
        >
          ⚡
        </div>
        <span
          style={{
            fontFamily: "Outfit, sans-serif",
            fontWeight: 700,
            fontSize: "16px",
            background: "linear-gradient(135deg, #9c7aff, #00d4ff)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            whiteSpace: "nowrap",
          }}
        >
          ShortsAI Pipeline
        </span>
      </Link>

      {/* Nav Links */}
      <div style={{ display: "flex", gap: "4px" }}>
        {NAV_LINKS.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
                textDecoration: "none",
                padding: "6px 14px",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: 500,
                transition: "all 0.2s",
                background: isActive ? "rgba(108,71,255,0.15)" : "transparent",
                border: isActive ? "1px solid rgba(108,71,255,0.3)" : "1px solid transparent",
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLAnchorElement).style.color = "var(--text-primary)";
                  (e.currentTarget as HTMLAnchorElement).style.background = "rgba(108,71,255,0.08)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLAnchorElement).style.color = "var(--text-secondary)";
                  (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
                }
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </div>

      {/* Status */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <div
          style={{
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            background: "var(--green)",
            boxShadow: "0 0 8px var(--green)",
          }}
        />
        <span style={{ fontSize: "12px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>System Ready</span>
      </div>
    </nav>
  );
}

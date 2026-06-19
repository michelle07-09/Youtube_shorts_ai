// lib/keep-alive.ts
// Self-ping keep-alive — prevents Railway from sleeping the container.
// Pings the app's own /api/health endpoint every 4 minutes.
// This ensures node-cron jobs keep running 24/7 without anyone visiting the site.

import { getActiveJobIds, getRunningSeriesIds } from "./scheduler";

const PING_INTERVAL_MS = 4 * 60 * 1000; // 4 minutes
let keepAliveTimer: ReturnType<typeof setInterval> | null = null;
let pingCount = 0;

function getAppUrl(): string {
  // Railway auto-sets RAILWAY_PUBLIC_DOMAIN
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  }
  // Fallback to explicit app URL
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  // Local development
  const port = process.env.PORT || "3000";
  return `http://localhost:${port}`;
}

async function ping() {
  pingCount++;
  const url = `${getAppUrl()}/api/health`;
  try {
    const res = await fetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(10000), // 10s timeout
    });
    if (res.ok) {
      const activeJobs = getActiveJobIds();
      const running = getRunningSeriesIds();
      const status = running.length > 0 ? `🔄 ${running.length} running` : "idle";
      console.log(`[KeepAlive] ✅ Ping #${pingCount} OK | Jobs: ${activeJobs.length} | Status: ${status} | ${new Date().toISOString()}`);
    } else {
      console.warn(`[KeepAlive] ⚠️ Ping #${pingCount} returned ${res.status}`);
    }
  } catch (err) {
    // Don't crash on ping failures — just log and retry next interval
    console.warn(`[KeepAlive] ⚠️ Ping #${pingCount} failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/** Start the keep-alive self-ping loop */
export function startKeepAlive() {
  if (keepAliveTimer) {
    console.log("[KeepAlive] Already running, skipping duplicate start.");
    return;
  }

  console.log(`[KeepAlive] 🔄 Self-ping active — pinging every ${PING_INTERVAL_MS / 1000}s to ${getAppUrl()}/api/health`);

  // First ping after 30 seconds (give server time to fully start)
  setTimeout(() => {
    ping();
    // Then ping every 4 minutes
    keepAliveTimer = setInterval(ping, PING_INTERVAL_MS);
  }, 30_000);
}

/** Stop the keep-alive loop (for graceful shutdown) */
export function stopKeepAlive() {
  if (keepAliveTimer) {
    clearInterval(keepAliveTimer);
    keepAliveTimer = null;
    console.log("[KeepAlive] ⏹ Stopped.");
  }
}

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    console.log("╔═══════════════════════════════════════════════════════════╗");
    console.log("║  🎬 YouTube Shorts AI — Autonomous Pipeline Starting...  ║");
    console.log("╚═══════════════════════════════════════════════════════════╝");
    console.log(`[Boot] Environment: ${process.env.NODE_ENV || "development"}`);
    console.log(`[Boot] Railway Domain: ${process.env.RAILWAY_PUBLIC_DOMAIN || "not set (local dev)"}`);
    console.log(`[Boot] Time: ${new Date().toISOString()}`);

    // ── Step 1: Initialize cron scheduler ──────────────────────
    try {
      const { initScheduler } = await import("./lib/scheduler");
      initScheduler();
      console.log("[Boot] ✅ Scheduler initialized.");
    } catch (err) {
      console.error("[Boot] ❌ Failed to initialize scheduler:", err);
    }

    // ── Step 2: Start keep-alive self-ping ─────────────────────
    // This prevents Railway from sleeping the container.
    // Pings /api/health every 4 minutes so cron jobs stay alive 24/7.
    try {
      const { startKeepAlive } = await import("./lib/keep-alive");
      startKeepAlive();
      console.log("[Boot] ✅ Keep-alive self-ping started.");
    } catch (err) {
      console.error("[Boot] ❌ Failed to start keep-alive:", err);
    }

    // ── Step 3: Check for missed episodes (after 60s delay) ────
    // Wait 60s to let the server fully start before running pipelines.
    // This catches any episodes that were missed while the container was sleeping.
    setTimeout(async () => {
      try {
        const { checkAndRunMissedEpisodes } = await import("./lib/scheduler");
        console.log("[Boot] 🔍 Checking for missed episodes...");
        await checkAndRunMissedEpisodes();
      } catch (err) {
        console.error("[Boot] ❌ Failed to check missed episodes:", err);
      }
    }, 60_000); // 60 seconds after boot

    console.log("[Boot] 🚀 All systems initialized. Pipeline is fully autonomous.");
    console.log("[Boot] 💡 No need to open the web page — everything runs automatically!");
  }
}


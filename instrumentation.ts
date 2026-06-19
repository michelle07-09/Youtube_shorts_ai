export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    console.log("╔═══════════════════════════════════════════════════════════╗");
    console.log("║  🎬 YouTube Shorts AI — Autonomous Pipeline Starting...  ║");
    console.log("╚═══════════════════════════════════════════════════════════╝");
    console.log(`[Boot] Environment: ${process.env.NODE_ENV || "development"}`);
    console.log(`[Boot] Railway Domain: ${process.env.RAILWAY_PUBLIC_DOMAIN || "not set (local dev)"}`);
    console.log(`[Boot] Time: ${new Date().toISOString()}`);

    // ── Boot Diagnostics: Check all API keys ────────────────────
    console.log("");
    console.log("[Boot] ═══ CREDENTIAL DIAGNOSTICS ═══════════════════════");
    
    const checks = [
      { name: "OpenAI (Script/Images/TTS)", key: process.env.OPENAI_API_KEY, required: true },
      { name: "ElevenLabs (Voice)",         key: process.env.ELEVENLABS_API_KEY, required: false },
      { name: "ElevenLabs Voice ID",        key: process.env.ELEVENLABS_VOICE_ID, required: false },
      { name: "FAL.ai (Flux Images)",       key: process.env.FAL_KEY, required: false },
      { name: "Kling (Video Gen)",          key: process.env.KLING_API_KEY, required: false },
      { name: "Kling Secret",              key: process.env.KLING_API_SECRET, required: false },
      { name: "PixVerse (Video Gen)",       key: process.env.PIXVERSE_API_KEY, required: false },
      { name: "YouTube Client ID",          key: process.env.YOUTUBE_CLIENT_ID, required: true },
      { name: "YouTube Client Secret",      key: process.env.YOUTUBE_CLIENT_SECRET, required: true },
      { name: "YouTube Refresh Token",      key: process.env.YOUTUBE_REFRESH_TOKEN, required: true },
      { name: "Instagram Access Token",     key: process.env.INSTAGRAM_ACCESS_TOKEN, required: false },
      { name: "Instagram User ID",          key: process.env.INSTAGRAM_USER_ID, required: false },
      { name: "TikTok Access Token",        key: process.env.TIKTOK_ACCESS_TOKEN, required: false },
    ];

    let missingRequired = 0;
    for (const check of checks) {
      const hasValue = !!check.key && check.key.trim() !== "";
      const icon = hasValue ? "✅" : (check.required ? "❌" : "⚠️");
      const suffix = !hasValue && check.required ? " ← REQUIRED! Upload will fail!" : "";
      console.log(`[Boot]   ${icon} ${check.name}: ${hasValue ? "configured" : "MISSING"}${suffix}`);
      if (!hasValue && check.required) missingRequired++;
    }

    console.log("[Boot] ════════════════════════════════════════════════════");

    if (missingRequired > 0) {
      console.log(`[Boot] ⚠️  WARNING: ${missingRequired} required credential(s) missing!`);
      console.log("[Boot] ⚠️  The pipeline will generate videos but CANNOT upload to YouTube.");
      console.log("[Boot] ⚠️  Fix: Set the missing env vars in Railway or .env.local");
      if (!process.env.YOUTUBE_REFRESH_TOKEN) {
        console.log("[Boot] 💡 To get YouTube Refresh Token:");
        console.log("[Boot]    1. Visit /api/auth/youtube on your app");
        console.log("[Boot]    2. Authorize with Google");
        console.log("[Boot]    3. Token is saved automatically to the database");
        console.log("[Boot]    4. Copy it to YOUTUBE_REFRESH_TOKEN env var in Railway");
      }
    } else {
      console.log("[Boot] ✅ All required credentials are configured!");
    }
    console.log("");

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
    console.log("[Boot] 📊 Check /api/diagnostics for real-time system health.");
  }
}

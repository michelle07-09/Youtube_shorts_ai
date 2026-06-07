export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    console.log("[Instrumentation] Starting YouTube Shorts AI Pipeline...");
    try {
      const { initScheduler } = await import("./lib/scheduler");
      initScheduler();
    } catch (err) {
      console.error("[Instrumentation] Failed to initialize scheduler on startup:", err);
    }
  }
}

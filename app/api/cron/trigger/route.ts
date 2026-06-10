// app/api/cron/trigger/route.ts
// External cron trigger endpoint — can be called by cron-job.org (free) or any external scheduler.
// This acts as a BACKUP mechanism to ensure missed episodes are always caught.
//
// Usage:
// GET https://your-app.up.railway.app/api/cron/trigger?secret=YOUR_CRON_SECRET
//
// Set CRON_SECRET in Railway environment variables for security.

import { NextRequest, NextResponse } from "next/server";
import { getActiveSeries, getSeriesById } from "@/lib/series";
import { getActiveJobIds, initScheduler } from "@/lib/scheduler";
import { runAutopilotEpisode } from "@/lib/autopilot";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes max for pipeline execution

// Track running series to prevent duplicate runs
const runningTriggers = new Set<string>();

export async function GET(req: NextRequest) {
  // Verify secret if CRON_SECRET is set
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const providedSecret = req.nextUrl.searchParams.get("secret");
    if (providedSecret !== cronSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // Ensure scheduler is initialized
  const activeJobs = getActiveJobIds();
  const activeSeries = getActiveSeries();

  if (activeJobs.length === 0 && activeSeries.length > 0) {
    console.log("[CronTrigger] Scheduler has no active jobs — reinitializing...");
    initScheduler();
  }

  // Check for missed episodes
  const now = new Date();
  const missedSeries: string[] = [];
  const results: Array<{
    seriesId: string;
    seriesName: string;
    action: string;
    status: string;
  }> = [];

  for (const series of activeSeries) {
    if (!series.active) continue;

    const nextRun = series.nextRunAt ? new Date(series.nextRunAt) : null;
    const isMissed = nextRun && nextRun < now;
    const neverRan = !series.lastRunAt && series.episodeCount === 0;

    if (isMissed || neverRan) {
      const reason = neverRan ? "never ran" : `missed (was scheduled for ${nextRun?.toISOString()})`;
      
      if (runningTriggers.has(series.id)) {
        results.push({
          seriesId: series.id,
          seriesName: series.name,
          action: "skipped",
          status: `Already running`,
        });
        continue;
      }

      console.log(`[CronTrigger] 🔔 Series "${series.name}" needs to run — ${reason}`);
      missedSeries.push(series.name);

      // Fire and forget — run in background
      runningTriggers.add(series.id);
      void (async () => {
        try {
          const freshSeries = getSeriesById(series.id);
          if (freshSeries) {
            await runAutopilotEpisode(freshSeries);
          }
        } catch (err) {
          console.error(`[CronTrigger] ❌ Failed for "${series.name}":`, err);
        } finally {
          runningTriggers.delete(series.id);
        }
      })();

      results.push({
        seriesId: series.id,
        seriesName: series.name,
        action: "triggered",
        status: reason,
      });
    } else {
      results.push({
        seriesId: series.id,
        seriesName: series.name,
        action: "on-schedule",
        status: `Next run: ${nextRun?.toISOString() || "unknown"}`,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    timestamp: now.toISOString(),
    activeSchedulerJobs: getActiveJobIds().length,
    totalActiveSeries: activeSeries.length,
    missedTriggered: missedSeries.length,
    results,
  });
}

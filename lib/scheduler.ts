// lib/scheduler.ts
// Node-cron based scheduler — keeps cron jobs alive for all active series
// Enhanced with missed episode detection + auto-run on boot

import cron, { ScheduledTask } from "node-cron";
import { getActiveSeries, getSeriesById, updateSeries, computeNextRun } from "./series";
import { runAutopilotEpisode } from "./autopilot";

const activeJobs = new Map<string, ScheduledTask>();
const runningSeriesIds = new Set<string>(); // Prevent duplicate concurrent runs

/** Start cron jobs for all active series */
export function initScheduler() {
  console.log("[Scheduler] ═══════════════════════════════════════════════");
  console.log("[Scheduler] 🚀 Initializing autopilot cron scheduler...");
  console.log(`[Scheduler] Time: ${new Date().toISOString()}`);

  const series = getActiveSeries();
  for (const s of series) {
    scheduleSeriesJob(s.id, s.schedule);
  }

  console.log(`[Scheduler] ✅ ${series.length} series scheduled.`);
  console.log("[Scheduler] ═══════════════════════════════════════════════");
}

/** Schedule or reschedule a single series */
export function scheduleSeriesJob(seriesId: string, cronExpr: string) {
  // Cancel existing job if any
  stopSeriesJob(seriesId);

  if (!cron.validate(cronExpr)) {
    console.warn(`[Scheduler] Invalid cron expression for series ${seriesId}: ${cronExpr}`);
    return;
  }

  const task = cron.schedule(cronExpr, async () => {
    const series = getSeriesById(seriesId);
    if (!series || !series.active) return;

    // Prevent duplicate concurrent runs
    if (runningSeriesIds.has(seriesId)) {
      console.log(`[Scheduler] ⏳ Series "${series.name}" is already running, skipping this cron tick.`);
      return;
    }

    console.log(`[Scheduler] 🔔 Cron fired for series: "${series.name}" at ${new Date().toISOString()}`);
    updateSeries(seriesId, { nextRunAt: computeNextRun(cronExpr) });

    runningSeriesIds.add(seriesId);
    try {
      await runAutopilotEpisode(series);
      console.log(`[Scheduler] ✅ Cron episode complete for "${series.name}"`);
    } catch (err) {
      console.error(`[Scheduler] ❌ Autopilot failed for ${seriesId}:`, err);
    } finally {
      runningSeriesIds.delete(seriesId);
    }
  });

  activeJobs.set(seriesId, task);
  console.log(`[Scheduler] ✅ Scheduled series ${seriesId} with cron: ${cronExpr}`);
}

/** Stop a series cron job */
export function stopSeriesJob(seriesId: string) {
  const existing = activeJobs.get(seriesId);
  if (existing) {
    existing.stop();
    activeJobs.delete(seriesId);
    console.log(`[Scheduler] ⏹ Stopped job for series ${seriesId}`);
  }
}

/** List all active job series IDs */
export function getActiveJobIds(): string[] {
  return Array.from(activeJobs.keys());
}

/**
 * Check all active series for missed episodes and run them immediately.
 * A series is "missed" if:
 *  - It has never run (episodeCount === 0 and no lastRunAt)
 *  - Its nextRunAt is in the past
 * 
 * Called on server boot to catch up on anything that was missed while the
 * container was sleeping.
 */
export async function checkAndRunMissedEpisodes(): Promise<void> {
  const now = new Date();
  const series = getActiveSeries();
  
  console.log("[Scheduler] 🔍 Checking for missed episodes...");
  console.log(`[Scheduler] Found ${series.length} active series to check.`);

  let missedCount = 0;

  for (const s of series) {
    const nextRun = s.nextRunAt ? new Date(s.nextRunAt) : null;
    const neverRan = !s.lastRunAt && s.episodeCount === 0;
    const isMissed = nextRun && nextRun < now;

    if (neverRan || isMissed) {
      const reason = neverRan
        ? "has never run"
        : `missed schedule (was ${nextRun?.toISOString()})`;

      // Don't double-run
      if (runningSeriesIds.has(s.id)) {
        console.log(`[Scheduler] ⏳ "${s.name}" ${reason} but is already running, skipping.`);
        continue;
      }

      console.log(`[Scheduler] 🔔 "${s.name}" ${reason} — triggering now!`);
      missedCount++;

      // Run in background (don't block other series from being checked)
      runningSeriesIds.add(s.id);
      void (async () => {
        try {
          const freshSeries = getSeriesById(s.id);
          if (freshSeries && freshSeries.active) {
            await runAutopilotEpisode(freshSeries);
            // Update nextRunAt after successful run
            updateSeries(s.id, { nextRunAt: computeNextRun(s.schedule) });
            console.log(`[Scheduler] ✅ Missed episode for "${s.name}" completed!`);
          }
        } catch (err) {
          console.error(`[Scheduler] ❌ Missed episode for "${s.name}" failed:`, err);
        } finally {
          runningSeriesIds.delete(s.id);
        }
      })();
    } else {
      console.log(`[Scheduler] ⏰ "${s.name}" is on schedule. Next run: ${nextRun?.toISOString() || "unknown"}`);
    }
  }

  if (missedCount === 0) {
    console.log("[Scheduler] ✅ No missed episodes found — all series are on schedule.");
  } else {
    console.log(`[Scheduler] 🚀 Triggered ${missedCount} missed episode(s) in background.`);
  }
}

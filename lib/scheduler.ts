// lib/scheduler.ts
// Node-cron based scheduler — keeps cron jobs alive for all active series
// Enhanced with missed episode detection + auto-run on boot + retry logic

import cron, { ScheduledTask } from "node-cron";
import { getActiveSeries, getSeriesById, updateSeries, computeNextRun } from "./series";
import { runAutopilotEpisode } from "./autopilot";

const activeJobs = new Map<string, ScheduledTask>();
const runningSeriesIds = new Set<string>(); // Prevent duplicate concurrent runs

// Retry config for failed episodes
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5 * 60 * 1000; // 5 minutes between retries

/** Start cron jobs for all active series */
export function initScheduler() {
  console.log("[Scheduler] ═══════════════════════════════════════════════");
  console.log("[Scheduler] 🚀 Initializing autopilot cron scheduler...");
  console.log(`[Scheduler] Time: ${new Date().toISOString()}`);

  const series = getActiveSeries();
  
  if (series.length === 0) {
    console.log("[Scheduler] ⚠️  No active series found! Create one via the web UI or API.");
  }
  
  for (const s of series) {
    console.log(`[Scheduler] 📋 Series: "${s.name}" | Schedule: ${s.schedule} (${s.scheduleLabel}) | Episodes: ${s.episodeCount} | Active: ${s.active}`);
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

    console.log(`[Scheduler] ═══════════════════════════════════════════════`);
    console.log(`[Scheduler] 🔔 CRON FIRED for series: "${series.name}"`);
    console.log(`[Scheduler] Time: ${new Date().toISOString()}`);
    console.log(`[Scheduler] Episode #: ${series.episodeCount + 1}`);
    console.log(`[Scheduler] ═══════════════════════════════════════════════`);
    
    updateSeries(seriesId, { nextRunAt: computeNextRun(cronExpr) });

    await runWithRetry(series, 0);
  });

  activeJobs.set(seriesId, task);
  console.log(`[Scheduler] ✅ Scheduled series "${seriesId}" with cron: ${cronExpr}`);
}

/** Run an autopilot episode with retry logic */
async function runWithRetry(series: { id: string; name: string }, attempt: number): Promise<void> {
  const seriesId = series.id;
  
  runningSeriesIds.add(seriesId);
  try {
    const freshSeries = getSeriesById(seriesId);
    if (!freshSeries || !freshSeries.active) {
      console.log(`[Scheduler] ⚠️ Series "${series.name}" is no longer active, skipping.`);
      return;
    }
    
    await runAutopilotEpisode(freshSeries);
    console.log(`[Scheduler] ✅ Episode complete for "${series.name}" (attempt ${attempt + 1})`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : "";
    
    console.error(`[Scheduler] ❌ Autopilot failed for "${series.name}" (attempt ${attempt + 1}/${MAX_RETRIES})`);
    console.error(`[Scheduler] Error: ${message}`);
    if (stack) console.error(`[Scheduler] Stack: ${stack}`);
    
    if (attempt < MAX_RETRIES - 1) {
      const delayMs = RETRY_DELAY_MS * (attempt + 1); // Exponential-ish backoff
      console.log(`[Scheduler] 🔄 Retrying in ${delayMs / 1000}s...`);
      
      // Schedule retry
      runningSeriesIds.delete(seriesId);
      setTimeout(() => runWithRetry(series, attempt + 1), delayMs);
      return; // Don't delete from runningSeriesIds yet — the retry will handle it
    } else {
      console.error(`[Scheduler] 💀 All ${MAX_RETRIES} retries exhausted for "${series.name}". Will try again at next scheduled time.`);
    }
  } finally {
    runningSeriesIds.delete(seriesId);
  }
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

/** Get currently running series IDs */
export function getRunningSeriesIds(): string[] {
  return Array.from(runningSeriesIds);
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
  
  console.log("[Scheduler] ═══════════════════════════════════════════════");
  console.log("[Scheduler] 🔍 MISSED EPISODE CHECK");
  console.log(`[Scheduler] Time: ${now.toISOString()}`);
  console.log(`[Scheduler] Active series: ${series.length}`);
  console.log("[Scheduler] ═══════════════════════════════════════════════");

  let missedCount = 0;

  for (const s of series) {
    const nextRun = s.nextRunAt ? new Date(s.nextRunAt) : null;
    const neverRan = !s.lastRunAt && s.episodeCount === 0;
    const isMissed = nextRun && nextRun < now;

    if (neverRan || isMissed) {
      const reason = neverRan
        ? "has NEVER run (first episode!)"
        : `missed schedule (was due ${nextRun?.toISOString()}, ${Math.round((now.getTime() - (nextRun?.getTime() || 0)) / 3600000)}h ago)`;

      // Don't double-run
      if (runningSeriesIds.has(s.id)) {
        console.log(`[Scheduler] ⏳ "${s.name}" ${reason} but is already running, skipping.`);
        continue;
      }

      console.log(`[Scheduler] 🔔 "${s.name}" ${reason} — triggering now!`);
      missedCount++;

      // Run in background with retry (don't block other series from being checked)
      void runWithRetry(s, 0).then(() => {
        // Update nextRunAt after successful run
        updateSeries(s.id, { nextRunAt: computeNextRun(s.schedule) });
        console.log(`[Scheduler] ✅ Missed episode for "${s.name}" completed!`);
      }).catch(err => {
        console.error(`[Scheduler] ❌ Missed episode for "${s.name}" failed after all retries:`, err);
      });
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

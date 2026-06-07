// lib/scheduler.ts
// Node-cron based scheduler — keeps cron jobs alive for all active series

import cron, { ScheduledTask } from "node-cron";
import { getActiveSeries, updateSeries, computeNextRun } from "./series";
import { runAutopilotEpisode } from "./autopilot";

const activeJobs = new Map<string, ScheduledTask>();

/** Start cron jobs for all active series */
export function initScheduler() {
  console.log("[Scheduler] Initializing autopilot cron jobs...");

  const series = getActiveSeries();
  for (const s of series) {
    scheduleSeriesJob(s.id, s.schedule);
  }

  console.log(`[Scheduler] ${series.length} series scheduled.`);
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
    const { getSeriesById } = await import("./series");
    const series = getSeriesById(seriesId);
    if (!series || !series.active) return;

    console.log(`[Scheduler] 🔔 Cron fired for series: "${series.name}"`);
    updateSeries(seriesId, { nextRunAt: computeNextRun(cronExpr) });

    try {
      await runAutopilotEpisode(series);
    } catch (err) {
      console.error(`[Scheduler] Autopilot failed for ${seriesId}:`, err);
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

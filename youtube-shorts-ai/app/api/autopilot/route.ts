// app/api/autopilot/route.ts
// Manually trigger one autopilot episode for a series (or test run)

import { NextRequest, NextResponse } from "next/server";
import { getSeriesById, getAllEpisodes, getEpisodesBySeriesId } from "@/lib/series";
import { runAutopilotEpisode, getLogs } from "@/lib/autopilot";
import { getActiveJobIds } from "@/lib/scheduler";

export const runtime = "nodejs";
export const maxDuration = 300;

// Track which series are currently running
const runningSet = new Set<string>();

export async function GET(req: NextRequest) {
  const seriesId = req.nextUrl.searchParams.get("seriesId");

  return NextResponse.json({
    episodes: seriesId ? getEpisodesBySeriesId(seriesId) : getAllEpisodes(),
    activeJobs: getActiveJobIds(),
    running: Array.from(runningSet),
    logs: seriesId ? getLogs(seriesId) : {},
  });
}

/** Manually trigger one episode for a series */
export async function POST(req: NextRequest) {
  const { seriesId } = await req.json();

  if (!seriesId) {
    return NextResponse.json({ error: "seriesId required" }, { status: 400 });
  }

  if (runningSet.has(seriesId)) {
    return NextResponse.json({ ok: false, message: "Already running — check back soon!" });
  }

  const series = getSeriesById(seriesId);
  if (!series) {
    return NextResponse.json({ error: "Series not found" }, { status: 404 });
  }

  // Fire and forget — works reliably in local Next.js dev server
  runningSet.add(seriesId);
  void (async () => {
    try {
      await runAutopilotEpisode(series);
    } catch (err) {
      console.error("[Autopilot API] Error:", err);
    } finally {
      runningSet.delete(seriesId);
    }
  })();

  return NextResponse.json({
    ok: true,
    message: `🚀 Episode generation started for "${series.name}"! This takes 3-5 minutes. Check History when done.`,
  });
}

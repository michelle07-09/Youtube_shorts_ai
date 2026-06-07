// app/api/series/route.ts — Series CRUD
import { NextRequest, NextResponse } from "next/server";
import {
  getAllSeries,
  createSeries,
  updateSeries,
  deleteSeries,
  computeNextRun,
  CRON_PRESETS,
} from "@/lib/series";
import { scheduleSeriesJob, stopSeriesJob } from "@/lib/scheduler";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ series: getAllSeries(), presets: CRON_PRESETS });
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  const series = createSeries({
    name: body.name || "My Series",
    style: body.style || "Dark Horror",
    description: body.description || "",
    schedule: body.schedule || "0 9 * * *",
    scheduleLabel: body.scheduleLabel || "Every day at 9:00 AM",
    active: body.active ?? true,
    language: body.language || "English",
    videoDuration: body.videoDuration || "45",
    youtubeVisibility: body.youtubeVisibility || "public",
    youtubeHashtags: body.youtubeHashtags || "#shorts #horror #scarystories",
    characterSheet: body.characterSheet || "",
    settingDescription: body.settingDescription || "",
    platforms: body.platforms || { youtube: true, instagram: true, tiktok: true },
    instagramCaption: body.instagramCaption || "",
    tiktokPrivacy: body.tiktokPrivacy || "SELF_ONLY",
  });

  // Start cron job immediately
  if (series.active) {
    scheduleSeriesJob(series.id, series.schedule);
  }

  return NextResponse.json(series);
}

export async function PATCH(req: NextRequest) {
  const { id, ...updates } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  if (updates.schedule) {
    updates.nextRunAt = computeNextRun(updates.schedule);
  }

  updateSeries(id, updates);

  // Reschedule or stop cron based on active state
  if (updates.active === false) {
    stopSeriesJob(id);
  } else if (updates.schedule || updates.active === true) {
    const series = getAllSeries().find((s) => s.id === id);
    if (series) scheduleSeriesJob(id, series.schedule);
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  stopSeriesJob(id);
  deleteSeries(id);
  return NextResponse.json({ ok: true });
}

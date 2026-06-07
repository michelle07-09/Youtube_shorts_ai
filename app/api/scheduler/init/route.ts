// app/api/scheduler/init/route.ts
// Called once on app startup to boot the cron scheduler

import { NextResponse } from "next/server";
import { initScheduler, getActiveJobIds } from "@/lib/scheduler";

export const runtime = "nodejs";

let initialized = false;

export async function GET() {
  if (!initialized) {
    initScheduler();
    initialized = true;
  }
  return NextResponse.json({
    ok: true,
    activeJobs: getActiveJobIds(),
    message: `Scheduler running with ${getActiveJobIds().length} active series.`,
  });
}

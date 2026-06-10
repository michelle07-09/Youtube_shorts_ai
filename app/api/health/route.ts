// app/api/health/route.ts
// Health check endpoint — target for self-ping keep-alive + Railway healthcheck

import { NextResponse } from "next/server";
import { getActiveJobIds } from "@/lib/scheduler";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    activeSchedulerJobs: getActiveJobIds().length,
    jobs: getActiveJobIds(),
  });
}

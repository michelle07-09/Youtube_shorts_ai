// app/api/runs/route.ts
import { NextResponse } from "next/server";
import { getRuns } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const runs = getRuns();
  return NextResponse.json(runs.reverse()); // newest first
}

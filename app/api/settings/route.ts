// app/api/settings/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSettings, saveSettings } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const settings = getSettings();
  // Mask sensitive keys in response
  const safe = { ...settings };
  if (safe.openaiKey) safe.openaiKey = safe.openaiKey.replace(/sk-[a-zA-Z0-9]{20}/, "sk-***");
  return NextResponse.json(settings);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  saveSettings(body);
  return NextResponse.json({ ok: true });
}

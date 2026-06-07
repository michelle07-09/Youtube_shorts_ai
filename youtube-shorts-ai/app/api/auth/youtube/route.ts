import { NextRequest, NextResponse } from "next/server";
import { getSettings } from "@/lib/db";
import { getAuthUrl } from "@/lib/providers/youtube";

export async function GET(req: NextRequest) {
  const settings = getSettings();
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
  const protocol = host.includes("localhost") || host.includes("127.0.0.1") ? "http" : "https";
  const redirectUri = `${protocol}://${host}/api/auth/youtube/callback`;

  const url = getAuthUrl(settings.youtubeClientId, settings.youtubeClientSecret, redirectUri);
  return NextResponse.redirect(url);
}

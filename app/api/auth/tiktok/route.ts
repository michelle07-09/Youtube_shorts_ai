// app/api/auth/tiktok/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSettings } from "@/lib/db";

export async function GET(req: NextRequest) {
  const settings = getSettings();
  const clientKey = settings.tiktokClientKey;

  if (!clientKey) {
    return new NextResponse("TikTok Client Key is not configured in settings.", { status: 400 });
  }

  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
  const protocol = host.includes("localhost") || host.includes("127.0.0.1") ? "http" : "https";
  const redirectUri = `${protocol}://${host}/api/auth/tiktok/callback`;

  const tiktokAuthUrl = new URL("https://www.tiktok.com/v2/auth/authorize/");
  tiktokAuthUrl.searchParams.set("client_key", clientKey);
  tiktokAuthUrl.searchParams.set("scope", "user.info.basic,video.publish,video.upload");
  tiktokAuthUrl.searchParams.set("response_type", "code");
  tiktokAuthUrl.searchParams.set("redirect_uri", redirectUri);
  tiktokAuthUrl.searchParams.set("state", "tiktok");

  return NextResponse.redirect(tiktokAuthUrl.toString());
}

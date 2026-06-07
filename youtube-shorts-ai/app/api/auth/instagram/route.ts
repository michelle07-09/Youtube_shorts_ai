// app/api/auth/instagram/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSettings } from "@/lib/db";

export async function GET(req: NextRequest) {
  const settings = getSettings();
  const appId = settings.instagramAppId;

  if (!appId) {
    return new NextResponse("Instagram App ID is not configured in settings.", { status: 400 });
  }

  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
  const protocol = host.includes("localhost") || host.includes("127.0.0.1") ? "http" : "https";
  const redirectUri = `${protocol}://${host}/api/auth/instagram/callback`;

  const facebookAuthUrl = new URL("https://www.facebook.com/v19.0/dialog/oauth");
  facebookAuthUrl.searchParams.set("client_id", appId);
  facebookAuthUrl.searchParams.set("redirect_uri", redirectUri);
  facebookAuthUrl.searchParams.set("scope", "instagram_content_publish,instagram_basic,pages_show_list,pages_read_engagement");
  facebookAuthUrl.searchParams.set("response_type", "code");
  facebookAuthUrl.searchParams.set("state", "instagram");

  return NextResponse.redirect(facebookAuthUrl.toString());
}

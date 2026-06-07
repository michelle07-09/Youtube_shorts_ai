// app/api/auth/tiktok/callback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSettings, saveSettings } from "@/lib/db";
import { exchangeTikTokCode } from "@/lib/providers/tiktok";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) {
    return new NextResponse("No code provided", { status: 400 });
  }

  const settings = getSettings();
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
  const protocol = host.includes("localhost") || host.includes("127.0.0.1") ? "http" : "https";
  const redirectUri = `${protocol}://${host}/api/auth/tiktok/callback`;

  try {
    const { accessToken, refreshToken } = await exchangeTikTokCode(
      settings.tiktokClientKey,
      settings.tiktokClientSecret,
      code,
      redirectUri
    );

    saveSettings({
      tiktokAccessToken: accessToken,
      tiktokRefreshToken: refreshToken,
    });

    return new NextResponse(
      `<html><body style="font-family:sans-serif;background:#0a0a0f;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;flex-direction:column">
        <h1 style="color:#00f2fe">✅ TikTok Connected!</h1>
        <p>Your TikTok account is now authorized. You can close this window.</p>
        <script>setTimeout(()=>window.close(),3000)</script>
      </body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new NextResponse(`TikTok Auth failed: ${message}`, { status: 500 });
  }
}

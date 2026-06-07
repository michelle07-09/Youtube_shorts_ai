// app/api/auth/instagram/callback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSettings, saveSettings } from "@/lib/db";
import { getLongLivedToken, getInstagramAccountId } from "@/lib/providers/instagram";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) {
    return new NextResponse("No code provided", { status: 400 });
  }

  const settings = getSettings();
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
  const protocol = host.includes("localhost") || host.includes("127.0.0.1") ? "http" : "https";
  const redirectUri = `${protocol}://${host}/api/auth/instagram/callback`;

  try {
    // 1: Exchange code for short-lived token
    const tokenRes = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token?` +
      new URLSearchParams({
        client_id: settings.instagramAppId,
        client_secret: settings.instagramAppSecret,
        redirect_uri: redirectUri,
        code,
      })
    );
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      throw new Error(`Short-lived token exchange failed: ${JSON.stringify(tokenData)}`);
    }

    const shortLivedToken = tokenData.access_token;

    // 2: Exchange short-lived for long-lived token (lasts 60 days)
    const longLived = await getLongLivedToken(
      settings.instagramAppId,
      settings.instagramAppSecret,
      shortLivedToken
    );

    const longLivedToken = longLived.accessToken;

    // 3: Get user's Facebook Pages to find the connected Instagram Business account
    const pagesRes = await fetch(
      `https://graph.facebook.com/v19.0/me/accounts?access_token=${longLivedToken}`
    );
    const pagesData = await pagesRes.json();
    if (!pagesData.data || !Array.isArray(pagesData.data)) {
      throw new Error(`Failed to retrieve Facebook Pages: ${JSON.stringify(pagesData)}`);
    }

    let instagramUserId = "";
    for (const page of pagesData.data) {
      try {
        const pageId = page.id;
        const pageAccessToken = page.access_token;
        instagramUserId = await getInstagramAccountId(pageAccessToken, pageId);
        if (instagramUserId) {
          break;
        }
      } catch (err) {
        // Skip and try next page
      }
    }

    if (!instagramUserId) {
      throw new Error(
        "Could not find an Instagram Business account connected to any of your Facebook Pages. " +
        "Please connect your Instagram Business account to a Facebook Page first."
      );
    }

    // 4: Save long-lived token & User ID to settings
    saveSettings({
      instagramAccessToken: longLivedToken,
      instagramUserId,
    });

    return new NextResponse(
      `<html><body style="font-family:sans-serif;background:#0a0a0f;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;flex-direction:column">
        <h1 style="color:#ec4899">✅ Instagram Connected!</h1>
        <p>Your Instagram Business account is now authorized. You can close this window.</p>
        <script>setTimeout(()=>window.close(),3000)</script>
      </body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new NextResponse(`Instagram Auth failed: ${message}`, { status: 500 });
  }
}

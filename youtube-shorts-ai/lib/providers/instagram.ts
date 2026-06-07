// lib/providers/instagram.ts
// Instagram Graph API — post Reels to Instagram Business/Creator accounts

import fs from "fs";

const GRAPH_BASE = "https://graph.facebook.com/v19.0";

export interface InstagramUploadResult {
  mediaId: string;
  permalink?: string;
}

/**
 * Upload a video as an Instagram Reel.
 * Requires:
 *  - A long-lived User Access Token with instagram_content_publish scope
 *  - Instagram Business or Creator account connected to a Facebook Page
 *  - The video must be publicly accessible via a URL (we upload to a temp CDN or use the local server URL)
 *
 * Flow: Create container → Wait for processing → Publish
 */
export async function uploadToInstagram(
  accessToken: string,
  instagramUserId: string,
  videoPublicUrl: string,   // must be a publicly accessible HTTPS URL
  caption: string,
  coverUrl?: string
): Promise<InstagramUploadResult> {
  // ── Step 1: Create media container ──────────────────────────────
  const containerParams = new URLSearchParams({
    media_type: "REELS",
    video_url: videoPublicUrl,
    caption: caption.slice(0, 2200),
    share_to_feed: "true",
    access_token: accessToken,
  });

  if (coverUrl) {
    containerParams.set("cover_url", coverUrl);
  }

  const containerRes = await fetch(
    `${GRAPH_BASE}/${instagramUserId}/media`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: containerParams,
    }
  );

  const containerData = await containerRes.json();
  if (!containerData.id) {
    throw new Error(`Instagram container creation failed: ${JSON.stringify(containerData)}`);
  }

  const containerId = containerData.id;
  console.log(`[Instagram] Container created: ${containerId}`);

  // ── Step 2: Wait for video processing (poll status) ─────────────
  let status = "IN_PROGRESS";
  let attempts = 0;
  const maxAttempts = 24; // up to 2 minutes

  while (status === "IN_PROGRESS" && attempts < maxAttempts) {
    await new Promise((r) => setTimeout(r, 5000)); // wait 5s
    attempts++;

    const statusRes = await fetch(
      `${GRAPH_BASE}/${containerId}?fields=status_code&access_token=${accessToken}`
    );
    const statusData = await statusRes.json();
    status = statusData.status_code || "ERROR";

    console.log(`[Instagram] Processing status (${attempts}): ${status}`);
  }

  if (status !== "FINISHED") {
    throw new Error(`Instagram video processing failed with status: ${status}`);
  }

  // ── Step 3: Publish ───────────────────────────────────────────────
  const publishRes = await fetch(
    `${GRAPH_BASE}/${instagramUserId}/media_publish`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        creation_id: containerId,
        access_token: accessToken,
      }),
    }
  );

  const publishData = await publishRes.json();
  if (!publishData.id) {
    throw new Error(`Instagram publish failed: ${JSON.stringify(publishData)}`);
  }

  const mediaId = publishData.id;
  console.log(`[Instagram] ✅ Published! Media ID: ${mediaId}`);

  // Get permalink
  try {
    const permalinkRes = await fetch(
      `${GRAPH_BASE}/${mediaId}?fields=permalink&access_token=${accessToken}`
    );
    const permalinkData = await permalinkRes.json();
    return { mediaId, permalink: permalinkData.permalink };
  } catch {
    return { mediaId };
  }
}

/**
 * Get long-lived access token from short-lived token.
 * Short-lived tokens expire in 1 hour; long-lived tokens last 60 days.
 */
export async function getLongLivedToken(
  appId: string,
  appSecret: string,
  shortLivedToken: string
): Promise<{ accessToken: string; expiresIn: number }> {
  const res = await fetch(
    `${GRAPH_BASE}/oauth/access_token?` +
    new URLSearchParams({
      grant_type: "fb_exchange_token",
      client_id: appId,
      client_secret: appSecret,
      fb_exchange_token: shortLivedToken,
    })
  );

  const data = await res.json();
  if (!data.access_token) {
    throw new Error(`Long-lived token exchange failed: ${JSON.stringify(data)}`);
  }

  return { accessToken: data.access_token, expiresIn: data.expires_in };
}

/** Get Instagram Business Account ID from a Facebook Page access token */
export async function getInstagramAccountId(
  pageAccessToken: string,
  pageId: string
): Promise<string> {
  const res = await fetch(
    `${GRAPH_BASE}/${pageId}?fields=instagram_business_account&access_token=${pageAccessToken}`
  );
  const data = await res.json();

  if (!data.instagram_business_account?.id) {
    throw new Error("No Instagram Business Account linked to this Facebook Page");
  }

  return data.instagram_business_account.id;
}

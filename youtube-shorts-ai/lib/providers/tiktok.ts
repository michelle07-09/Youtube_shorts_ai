// lib/providers/tiktok.ts
// TikTok Content Posting API — upload video directly to TikTok

import fs from "fs";
import path from "path";
import https from "https";
import http from "http";

const TIKTOK_API_BASE = "https://open.tiktokapis.com/v2";

export interface TikTokUploadResult {
  publishId: string;
  shareUrl?: string;
}

/** Exchange authorization code for access token */
export async function exchangeTikTokCode(
  clientKey: string,
  clientSecret: string,
  code: string,
  redirectUri: string
): Promise<{ accessToken: string; refreshToken: string; openId: string }> {
  const res = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });

  const data = await res.json();
  if (!data.access_token) {
    throw new Error(`TikTok OAuth failed: ${JSON.stringify(data)}`);
  }
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    openId: data.open_id,
  };
}

/** Refresh an expired access token */
export async function refreshTikTokToken(
  clientKey: string,
  clientSecret: string,
  refreshToken: string
): Promise<{ accessToken: string; refreshToken: string }> {
  const res = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const data = await res.json();
  if (!data.access_token) {
    throw new Error(`TikTok token refresh failed: ${JSON.stringify(data)}`);
  }
  return { accessToken: data.access_token, refreshToken: data.refresh_token };
}

/** Get creator info (needed before posting) */
async function getCreatorInfo(accessToken: string): Promise<{
  creatorAvatarUrl: string;
  creatorNickname: string;
  privacyLevelOptions: string[];
  commentDisabled: boolean;
  duetDisabled: boolean;
  stitchDisabled: boolean;
  maxVideoPostDurationSec: number;
}> {
  const res = await fetch(`${TIKTOK_API_BASE}/post/publish/creator_info/query/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify({}),
  });

  const data = await res.json();
  if (data.error?.code !== "ok") {
    throw new Error(`TikTok creator info failed: ${JSON.stringify(data.error)}`);
  }
  return data.data;
}

/**
 * Upload a video file to TikTok using the Content Posting API (FILE_UPLOAD method).
 * Returns the publishId you can use to check status.
 */
export async function uploadToTikTok(
  accessToken: string,
  videoFilePath: string,
  title: string,
  privacyLevel: "PUBLIC_TO_EVERYONE" | "MUTUAL_FOLLOW_FRIENDS" | "SELF_ONLY" = "PUBLIC_TO_EVERYONE"
): Promise<TikTokUploadResult> {
  if (!fs.existsSync(videoFilePath)) {
    throw new Error(`TikTok upload: video file not found at ${videoFilePath}`);
  }

  const fileSize = fs.statSync(videoFilePath).size;
  const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB chunks
  const totalChunkCount = Math.ceil(fileSize / CHUNK_SIZE);

  // ── Step 1: Init upload ──────────────────────────────────────────
  const initRes = await fetch(`${TIKTOK_API_BASE}/post/publish/video/init/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify({
      post_info: {
        title: title.slice(0, 150),
        privacy_level: privacyLevel,
        disable_duet: false,
        disable_comment: false,
        disable_stitch: false,
        video_cover_timestamp_ms: 1000,
      },
      source_info: {
        source: "FILE_UPLOAD",
        video_size: fileSize,
        chunk_size: CHUNK_SIZE,
        total_chunk_count: totalChunkCount,
      },
    }),
  });

  const initData = await initRes.json();
  if (initData.error?.code !== "ok") {
    throw new Error(`TikTok init failed: ${JSON.stringify(initData.error)}`);
  }

  const { publish_id, upload_url } = initData.data;

  // ── Step 2: Upload chunks ────────────────────────────────────────
  const fileBuffer = fs.readFileSync(videoFilePath);

  for (let i = 0; i < totalChunkCount; i++) {
    const start = i * CHUNK_SIZE;
    const end   = Math.min(start + CHUNK_SIZE, fileSize);
    const chunk = fileBuffer.subarray(start, end);

    const chunkRes = await fetch(upload_url, {
      method: "PUT",
      headers: {
        "Content-Type":  "video/mp4",
        "Content-Range": `bytes ${start}-${end - 1}/${fileSize}`,
        "Content-Length": String(chunk.length),
      },
      body: chunk,
    });

    if (!chunkRes.ok && chunkRes.status !== 206) {
      throw new Error(`TikTok chunk ${i} upload failed: ${chunkRes.status}`);
    }
  }

  console.log(`[TikTok] ✅ Video uploaded. publish_id: ${publish_id}`);

  return { publishId: publish_id };
}

/** Check TikTok publish status */
export async function checkTikTokPublishStatus(
  accessToken: string,
  publishId: string
): Promise<{ status: string; failReason?: string; publiclyAvailable?: boolean }> {
  const res = await fetch(`${TIKTOK_API_BASE}/post/publish/status/fetch/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify({ publish_id: publishId }),
  });

  const data = await res.json();
  return {
    status: data.data?.status || "UNKNOWN",
    failReason: data.data?.fail_reason,
    publiclyAvailable: data.data?.publicly_available,
  };
}

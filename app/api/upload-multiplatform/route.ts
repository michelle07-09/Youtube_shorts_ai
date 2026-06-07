import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { getSettings } from "@/lib/db";
import { uploadToYouTube } from "@/lib/providers/youtube";
import { uploadToInstagram } from "@/lib/providers/instagram";
import { uploadToTikTok } from "@/lib/providers/tiktok";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      runId,
      title,
      description,
      tags = [],
      platforms = { youtube: true, instagram: true, tiktok: true },
      instagramCaption = "",
      tiktokPrivacy = "SELF_ONLY",
      playlistId = ""
    } = body;

    if (!runId) {
      return NextResponse.json({ error: "runId is required" }, { status: 400 });
    }

    const settings = getSettings();
    const outputDir = process.env.OUTPUT_DIR || path.join(process.cwd(), "public", "output");
    const videoFilePath = path.join(outputDir, runId, "final_video.mp4");

    if (!fs.existsSync(videoFilePath)) {
      return NextResponse.json({ error: `Video file not found for run ${runId}` }, { status: 404 });
    }

    const results: Record<string, any> = {};

    // 1. YouTube Upload
    if (platforms.youtube) {
      if (settings.youtubeClientId && settings.youtubeRefreshToken) {
        try {
          const ytResult = await uploadToYouTube(
            settings.youtubeClientId,
            settings.youtubeClientSecret,
            settings.youtubeRefreshToken,
            videoFilePath,
            `${title} #Shorts`,
            description || title,
            tags,
            settings.autopilotVisibility || "private",
            playlistId
          );
          results.youtube = { success: true, url: ytResult.url };
        } catch (err: any) {
          results.youtube = { success: false, error: err.message || String(err) };
        }
      } else {
        results.youtube = { success: false, error: "YouTube credentials not configured" };
      }
    }

    // 2. Instagram Upload
    if (platforms.instagram) {
      if (settings.instagramAccessToken && settings.instagramUserId) {
        try {
          const appUrl = process.env.NEXT_PUBLIC_APP_URL || 
                         (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : "") || 
                         "";
          if (!appUrl) {
            results.instagram = { success: false, error: "NEXT_PUBLIC_APP_URL is not set. Instagram upload requires a public video URL." };
          } else {
            const publicVideoUrl = `${appUrl}/api/output/${runId}/final_video.mp4`;
            const captionText = instagramCaption || `${title}\n\n${description || ""}`;
            
            const instResult = await uploadToInstagram(
              settings.instagramAccessToken,
              settings.instagramUserId,
              publicVideoUrl,
              captionText
            );
            
            results.instagram = {
              success: true,
              url: instResult.permalink || `https://www.instagram.com/p/${instResult.mediaId}/`,
              mediaId: instResult.mediaId
            };
          }
        } catch (err: any) {
          results.instagram = { success: false, error: err.message || String(err) };
        }
      } else {
        results.instagram = { success: false, error: "Instagram credentials not configured" };
      }
    }

    // 3. TikTok Upload
    if (platforms.tiktok) {
      if (settings.tiktokAccessToken) {
        try {
          const ttResult = await uploadToTikTok(
            settings.tiktokAccessToken,
            videoFilePath,
            title,
            tiktokPrivacy
          );
          results.tiktok = { success: true, publishId: ttResult.publishId };
        } catch (err: any) {
          results.tiktok = { success: false, error: err.message || String(err) };
        }
      } else {
        results.tiktok = { success: false, error: "TikTok credentials not configured" };
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || String(error) }, { status: 500 });
  }
}

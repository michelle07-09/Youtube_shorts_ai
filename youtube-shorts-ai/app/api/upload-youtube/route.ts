// app/api/upload-youtube/route.ts
import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { getSettings } from "@/lib/db";
import { uploadToYouTube } from "@/lib/providers/youtube";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const { runId, title, description, tags, visibility } = await req.json();

  const settings = getSettings();

  if (!settings.youtubeClientId || !settings.youtubeRefreshToken) {
    return NextResponse.json(
      { error: "YouTube OAuth not configured. Go to Settings > YouTube Auth." },
      { status: 400 }
    );
  }

  const outputDir = process.env.OUTPUT_DIR || path.join(process.cwd(), "public", "output");
  const videoFilePath = path.join(outputDir, runId, "final_video.mp4");

  try {
    const result = await uploadToYouTube(
      settings.youtubeClientId,
      settings.youtubeClientSecret,
      settings.youtubeRefreshToken,
      videoFilePath,
      title,
      description || `#horror #scarystories #shorts`,
      tags || ["horror", "shorts", "scary"],
      visibility || "public"
    );

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

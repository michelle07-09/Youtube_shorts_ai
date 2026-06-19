// lib/autopilot.ts
// Autonomous daily upload engine — generates topic + runs full pipeline + uploads
// Enhanced with detailed logging, credential pre-checks, and clear error messages

import OpenAI from "openai";
import path from "path";
import {
  Series,
  addEpisode,
  updateEpisode,
  updateSeries,
  computeNextRun,
  getSeriesById,
} from "./series";
import { getSettings } from "./db";
import { runPipeline } from "./pipeline-orchestrator";
import { createPipelineRunRecord } from "./pipeline-run";
import { uploadToYouTube, createYouTubePlaylist } from "./providers/youtube";

export interface AutopilotLog {
  time: string;
  level: "info" | "success" | "error";
  message: string;
}

const runLogs: Record<string, AutopilotLog[]> = {};

function log(seriesId: string, level: AutopilotLog["level"], message: string) {
  if (!runLogs[seriesId]) runLogs[seriesId] = [];
  runLogs[seriesId].push({ time: new Date().toISOString(), level, message });
  console.log(`[Autopilot:${seriesId.slice(0, 8)}] [${level.toUpperCase()}] ${message}`);
}

export function getLogs(seriesId: string): AutopilotLog[] {
  return runLogs[seriesId] || [];
}

async function generateEpisodeTopic(
  apiKey: string,
  series: Series,
  episodeNumber: number,
  pastTopics: string[]
): Promise<string> {
  const client = new OpenAI({ apiKey });
  const avoidList = pastTopics.slice(-20).join("\n- ");

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are a creative director for a YouTube Shorts channel called "${series.name}".
Channel style: ${series.style}.
Generate ONE compelling, unique episode topic.
Return ONLY the topic as a plain string — no JSON, no quotes, no explanation.`,
      },
      {
        role: "user",
        content: `Generate topic for Episode ${episodeNumber} of "${series.name}".

${pastTopics.length > 0 ? `Topics already used (DO NOT repeat):\n- ${avoidList}` : "This is the first episode!"}

Make it specific, intriguing, perfect for a ${series.videoDuration}-second ${series.style} YouTube Short.`,
      },
    ],
    temperature: 0.95,
    max_tokens: 100,
  });

  return response.choices[0].message.content?.trim() || `${series.style} Story Episode ${episodeNumber}`;
}

export async function runAutopilotEpisode(series: Series): Promise<void> {
  const settings = getSettings();
  runLogs[series.id] = [];

  log(series.id, "info", "═══════════════════════════════════════════════");
  log(series.id, "info", `🚀 AUTOPILOT STARTING for "${series.name}"`);
  log(series.id, "info", `Time: ${new Date().toISOString()}`);
  log(series.id, "info", "═══════════════════════════════════════════════");

  // ── Pre-flight credential check ───────────────────────────────
  log(series.id, "info", "🔑 Pre-flight credential check...");
  
  if (!settings.openaiKey) {
    log(series.id, "error", "❌ FATAL: OpenAI API key is missing! Cannot generate anything.");
    throw new Error("OpenAI API key is not configured. Set OPENAI_API_KEY environment variable.");
  }
  log(series.id, "info", "  ✅ OpenAI API key: configured");

  const audioOk = settings.audioProvider === "elevenlabs" 
    ? !!settings.elevenLabsKey 
    : !!settings.openaiKey;
  log(series.id, "info", `  ${audioOk ? "✅" : "⚠️"} Audio (${settings.audioProvider}): ${audioOk ? "configured" : "will fall back to OpenAI TTS"}`);

  // Get fresh series definition to check platform settings
  let freshSeries = getSeriesById(series.id) || series;
  const enabledPlatforms = freshSeries.platforms || { youtube: true, instagram: true, tiktok: true };

  const ytConfigured = !!(settings.youtubeClientId && settings.youtubeClientSecret && settings.youtubeRefreshToken);
  log(series.id, "info", `  ${ytConfigured ? "✅" : "❌"} YouTube upload: ${ytConfigured ? "configured" : "MISSING CREDENTIALS"}`);
  if (!ytConfigured) {
    if (!settings.youtubeRefreshToken) log(series.id, "error", "  → YouTube Refresh Token is EMPTY. Authorize at /api/auth/youtube");
    if (!settings.youtubeClientId) log(series.id, "error", "  → YouTube Client ID is EMPTY");
    if (!settings.youtubeClientSecret) log(series.id, "error", "  → YouTube Client Secret is EMPTY");
  }

  if (enabledPlatforms.instagram) {
    const igOk = !!(settings.instagramAccessToken && settings.instagramUserId);
    log(series.id, "info", `  ${igOk ? "✅" : "⚠️"} Instagram: ${igOk ? "configured" : "skipped (no credentials)"}`);
  }
  if (enabledPlatforms.tiktok) {
    const ttOk = !!settings.tiktokAccessToken;
    log(series.id, "info", `  ${ttOk ? "✅" : "⚠️"} TikTok: ${ttOk ? "configured" : "skipped (no credentials)"}`);
  }

  const episodeNumber = series.episodeCount + 1;
  log(series.id, "info", `📺 Episode #${episodeNumber} of "${series.name}"`);

  // ── 1: Generate unique topic ──────────────────────────────────
  log(series.id, "info", `🧠 Generating topic for Episode ${episodeNumber}...`);
  const { getEpisodesBySeriesId } = await import("./series");
  const pastTopics = getEpisodesBySeriesId(series.id).map((e) => e.topic);
  
  let topic: string;
  try {
    topic = await generateEpisodeTopic(settings.openaiKey, series, episodeNumber, pastTopics);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log(series.id, "error", `❌ Failed to generate topic: ${msg}`);
    throw err;
  }
  log(series.id, "info", `📝 Topic: "${topic}"`);

  // ── 2: Create episode record ──────────────────────────────────
  const episode = addEpisode({
    seriesId: series.id,
    seriesName: series.name,
    episodeNumber,
    topic,
    title: "",
    status: "running",
    runId: "",
    createdAt: new Date().toISOString(),
  });

  // ── 3: Create pipeline run ────────────────────────────────────
  const runId = createPipelineRunRecord(episode.id, topic);
  updateEpisode(episode.id, { runId });

  // Generate character sheet and setting description on the first episode if not already present
  freshSeries = getSeriesById(series.id) || series;
  let characterSheet = freshSeries.characterSheet;
  let settingDescription = freshSeries.settingDescription;

  if (!characterSheet || !settingDescription) {
    log(series.id, "info", `🎭 First episode of the series! Generating persistent characters...`);
    try {
      const { generateSeriesCharacters } = await import("./providers/openai");
      const generated = await generateSeriesCharacters(
        settings.openaiKey,
        series.name,
        series.style,
        series.description || ""
      );
      characterSheet = generated.characterSheet;
      settingDescription = generated.settingDescription;
      updateSeries(series.id, {
        characterSheet,
        settingDescription,
      });
      log(series.id, "success", `🎭 Persistent characters generated!`);
    } catch (err) {
      log(series.id, "error", `⚠️ Failed to generate persistent character sheet: ${err instanceof Error ? err.message : String(err)}. Falling back to per-episode generation.`);
    }
  } else {
    log(series.id, "info", `🎭 Using persistent characters from character sheet...`);
  }

  const seriesSettings = {
    ...settings,
    channelName: series.name,
    channelStyle: series.style,
    videoDuration: series.videoDuration,
    language: series.language,
  };

  // ── 4: Run full pipeline (script → images → voiceover → assemble) ──
  log(series.id, "info", "⚡ Running full AI pipeline...");
  log(series.id, "info", "  Step 1/6: Script generation (GPT-4o)");
  log(series.id, "info", "  Step 2/6: Image generation (DALL-E 3 / Flux)");
  log(series.id, "info", "  Step 3/6: Voiceover (ElevenLabs / OpenAI TTS)");
  log(series.id, "info", "  Step 4/6: Video generation (Kling / PixVerse)");
  log(series.id, "info", "  Step 5/6: FFmpeg assembly");
  log(series.id, "info", "  Step 6/6: Upload to platforms");

  let finalTitle = topic;
  let videoPath: string | undefined;
  let thumbnailUrl: string | undefined;

  try {
    await runPipeline(
      runId,
      episode.id,
      topic,
      seriesSettings,
      (event) => {
        log(series.id, "info", event.message);
        if (event.stage === "script" && event.status === "done" && event.data) {
          const d = event.data as { title?: string };
          if (d.title) finalTitle = d.title;
        }
        if (event.stage === "save" && event.status === "done" && event.data) {
          const d = event.data as { videoUrl?: string; thumbnailUrl?: string };
          videoPath = d.videoUrl;
          thumbnailUrl = d.thumbnailUrl;
        }
      },
      characterSheet,
      settingDescription
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : "";
    log(series.id, "error", `❌ Pipeline failed: ${message}`);
    if (stack) log(series.id, "error", `Stack: ${stack}`);
    updateEpisode(episode.id, { status: "failed", title: finalTitle });
    updateSeries(series.id, {
      lastRunAt: new Date().toISOString(),
      nextRunAt: computeNextRun(series.schedule),
    });
    throw err; // Re-throw so scheduler can retry
  }

  log(series.id, "success", `✅ Pipeline done: "${finalTitle}"`);
  updateEpisode(episode.id, { title: finalTitle, videoUrl: videoPath, thumbnailUrl });

  const outputDir = process.env.OUTPUT_DIR || path.join(process.cwd(), "public", "output");
  const videoFilePath = path.join(outputDir, runId, "final_video.mp4");
  let youtubeUrl: string | undefined;
  let instagramUrl: string | undefined;
  let tiktokPublishId: string | undefined;

  // Get fresh series definition to check platform settings
  freshSeries = getSeriesById(series.id) || series;

  // ── 5: YouTube Upload + Auto-Playlist ────────────────────────
  if (enabledPlatforms.youtube && settings.youtubeClientId && settings.youtubeClientSecret && settings.youtubeRefreshToken) {
    const description = [
      `${series.name} — Episode ${episodeNumber}`,
      "",
      finalTitle,
      "",
      series.description || "",
      "",
      series.youtubeHashtags || "#shorts",
    ].join("\n").trim();

    let playlistId = freshSeries.youtubePlaylistId;

    if (!playlistId) {
      try {
        log(series.id, "info", `📁 Creating YouTube playlist: "${series.name}"...`);
        const playlist = await createYouTubePlaylist(
          settings.youtubeClientId,
          settings.youtubeClientSecret,
          settings.youtubeRefreshToken,
          series.name,
          series.description || `Auto-generated series: ${series.name}`,
          series.youtubeVisibility
        );
        playlistId = playlist.playlistId;
        updateSeries(series.id, {
          youtubePlaylistId: playlist.playlistId,
          youtubePlaylistUrl: playlist.url,
        });
        log(series.id, "success", `📁 Playlist created: ${playlist.url}`);
      } catch (err) {
        log(series.id, "error", `⚠️ Playlist creation failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    } else {
      log(series.id, "info", `📁 Using existing playlist: ${playlistId}`);
    }

    try {
      log(series.id, "info", `📤 Uploading Episode ${episodeNumber} to YouTube...`);
      log(series.id, "info", `📤 Video file: ${videoFilePath}`);
      log(series.id, "info", `📤 Title: "${finalTitle} #Shorts"`);
      log(series.id, "info", `📤 Visibility: ${series.youtubeVisibility}`);
      
      const result = await uploadToYouTube(
        settings.youtubeClientId,
        settings.youtubeClientSecret,
        settings.youtubeRefreshToken,
        videoFilePath,
        `${finalTitle} #Shorts`,
        description,
        [...series.style.toLowerCase().split(" "), "shorts", series.name.toLowerCase()],
        series.youtubeVisibility,
        playlistId
      );

      log(series.id, "success", `🎉 UPLOADED TO YOUTUBE! ${result.url}`);
      youtubeUrl = result.url;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : "";
      log(series.id, "error", `⚠️ YouTube upload failed: ${message}`);
      if (stack) log(series.id, "error", `Stack: ${stack}`);
    }
  } else {
    const missing: string[] = [];
    if (!enabledPlatforms.youtube) missing.push("YouTube platform disabled for this series");
    if (!settings.youtubeClientId) missing.push("YOUTUBE_CLIENT_ID empty");
    if (!settings.youtubeClientSecret) missing.push("YOUTUBE_CLIENT_SECRET empty");
    if (!settings.youtubeRefreshToken) missing.push("YOUTUBE_REFRESH_TOKEN empty (authorize at /api/auth/youtube)");
    log(series.id, "error", `⏭️ YouTube upload SKIPPED: ${missing.join(", ")}`);
  }

  // ── 6: Instagram Upload ──────────────────────────────────────────
  if (enabledPlatforms.instagram && settings.instagramAccessToken && settings.instagramUserId) {
    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 
                     (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : "") || 
                     "";
      if (!appUrl) {
        log(series.id, "error", `⚠️ Instagram upload skipped: Instagram requires a public video URL but NEXT_PUBLIC_APP_URL is not set.`);
      } else {
        const publicVideoUrl = `${appUrl}/api/output/${runId}/final_video.mp4`;
        log(series.id, "info", `📸 Uploading Episode ${episodeNumber} to Instagram Reels using URL: ${publicVideoUrl}...`);

        const captionText = freshSeries.instagramCaption
          ? freshSeries.instagramCaption.replace("{title}", finalTitle).replace("{episode}", String(episodeNumber))
          : `${finalTitle}\n\n${series.description || ""}\n\n${series.youtubeHashtags || "#reels #shorts"}`;

        const { uploadToInstagram } = await import("./providers/instagram");
        const instResult = await uploadToInstagram(
          settings.instagramAccessToken,
          settings.instagramUserId,
          publicVideoUrl,
          captionText
        );
        instagramUrl = instResult.permalink || `https://www.instagram.com/p/${instResult.mediaId}/`;
        log(series.id, "success", `🎉 Uploaded to Instagram! ${instagramUrl}`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      log(series.id, "error", `⚠️ Instagram upload failed: ${message}`);
    }
  } else if (enabledPlatforms.instagram) {
    log(series.id, "info", `⏭️ Instagram upload skipped (credentials missing).`);
  }

  // ── 7: TikTok Upload ─────────────────────────────────────────────
  if (enabledPlatforms.tiktok && settings.tiktokAccessToken) {
    try {
      log(series.id, "info", `🎵 Uploading Episode ${episodeNumber} to TikTok...`);
      const { uploadToTikTok } = await import("./providers/tiktok");
      const tiktokPrivacy = freshSeries.tiktokPrivacy || "SELF_ONLY";
      const ttResult = await uploadToTikTok(
        settings.tiktokAccessToken,
        videoFilePath,
        `${finalTitle} ${series.youtubeHashtags || "#shorts"}`,
        tiktokPrivacy
      );
      tiktokPublishId = ttResult.publishId;
      log(series.id, "success", `🎉 Uploaded to TikTok! Publish ID: ${tiktokPublishId}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      log(series.id, "error", `⚠️ TikTok upload failed: ${message}`);
    }
  } else if (enabledPlatforms.tiktok) {
    log(series.id, "info", `⏭️ TikTok upload skipped (credentials missing).`);
  }

  // Final Update to save platform URLs/IDs and set state to done
  updateEpisode(episode.id, {
    status: "done",
    youtubeUrl,
    instagramUrl,
    tiktokPublishId
  });

  // ── 8: Update series metadata ─────────────────────────────────
  updateSeries(series.id, {
    episodeCount: episodeNumber,
    lastRunAt: new Date().toISOString(),
    nextRunAt: computeNextRun(series.schedule),
  });

  log(series.id, "success", "═══════════════════════════════════════════════");
  log(series.id, "success", `✅ Episode ${episodeNumber} of "${series.name}" COMPLETE!`);
  log(series.id, "success", `   YouTube: ${youtubeUrl || "not uploaded"}`);
  log(series.id, "success", `   Instagram: ${instagramUrl || "not uploaded"}`);
  log(series.id, "success", `   TikTok: ${tiktokPublishId || "not uploaded"}`);
  log(series.id, "success", "═══════════════════════════════════════════════");
}

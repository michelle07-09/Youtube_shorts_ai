// lib/autopilot.ts
// Autonomous daily upload engine — generates topic + runs full pipeline + uploads

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
  console.log(`[Autopilot:${seriesId}] [${level.toUpperCase()}] ${message}`);
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

  log(series.id, "info", `🚀 Starting autopilot for "${series.name}"`);

  const episodeNumber = series.episodeCount + 1;

  // ── 1: Generate unique topic ──────────────────────────────────
  log(series.id, "info", `🧠 Generating topic for Episode ${episodeNumber}...`);
  const { getEpisodesBySeriesId } = await import("./series");
  const pastTopics = getEpisodesBySeriesId(series.id).map((e) => e.topic);
  const topic = await generateEpisodeTopic(settings.openaiKey, series, episodeNumber, pastTopics);
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
  let freshSeries = getSeriesById(series.id) || series;
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
    log(series.id, "error", `❌ Pipeline failed: ${message}`);
    updateEpisode(episode.id, { status: "failed", title: finalTitle });
    updateSeries(series.id, {
      lastRunAt: new Date().toISOString(),
      nextRunAt: computeNextRun(series.schedule),
    });
    return;
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
  const enabledPlatforms = freshSeries.platforms || { youtube: true, instagram: true, tiktok: true };

  // ── 5: YouTube Upload + Auto-Playlist ────────────────────────
  if (enabledPlatforms.youtube && settings.youtubeClientId && settings.youtubeRefreshToken) {
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

      log(series.id, "success", `🎉 Uploaded to YouTube! ${result.url}`);
      youtubeUrl = result.url;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      log(series.id, "error", `⚠️ YouTube upload failed: ${message}`);
    }
  } else {
    log(series.id, "info", `⏭️ YouTube upload skipped (disabled or credentials missing).`);
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
  } else {
    log(series.id, "info", `⏭️ Instagram upload skipped (disabled or credentials missing).`);
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
  } else {
    log(series.id, "info", `⏭️ TikTok upload skipped (disabled or credentials missing).`);
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

  log(series.id, "success", `✅ Episode ${episodeNumber} complete!`);
}

// app/api/diagnostics/route.ts
// Real-time system health endpoint — check from your phone, no laptop needed
import { NextResponse } from "next/server";
import { getSettings, getAutomationState } from "@/lib/db";
import { getAllSeries, getActiveSeries, getAllEpisodes } from "@/lib/series";
import { getActiveJobIds, getRunningSeriesIds } from "@/lib/scheduler";

export const dynamic = "force-dynamic";

export async function GET() {
  const settings = getSettings();
  const series = getAllSeries();
  const activeSeries = getActiveSeries();
  const episodes = getAllEpisodes();
  const activeJobs = getActiveJobIds();
  const runningNow = getRunningSeriesIds();
  const automation = getAutomationState();

  // Check credentials
  const credentials = {
    openai: { configured: !!settings.openaiKey, required: true },
    elevenlabs: { configured: !!settings.elevenLabsKey, required: false },
    kling: { configured: !!(settings.klingKey && settings.klingSecret), required: false },
    pixverse: { configured: !!settings.pixverseKey, required: false },
    fal: { configured: !!settings.falKey, required: false },
    youtube: {
      clientId: !!settings.youtubeClientId,
      clientSecret: !!settings.youtubeClientSecret,
      refreshToken: !!settings.youtubeRefreshToken,
      configured: !!(settings.youtubeClientId && settings.youtubeClientSecret && settings.youtubeRefreshToken),
      required: true,
    },
    instagram: {
      configured: !!(settings.instagramAccessToken && settings.instagramUserId),
      required: false,
    },
    tiktok: {
      configured: !!settings.tiktokAccessToken,
      required: false,
    },
  };

  // Determine upload capability
  const canUploadYouTube = credentials.youtube.configured;
  const canGenerateVideo = !!settings.openaiKey; // minimum: OpenAI for script + images + TTS
  const canGenerateAIVideo = credentials.kling.configured || credentials.pixverse.configured;

  // Series status
  const seriesStatus = series.map((s) => ({
    id: s.id,
    name: s.name,
    active: s.active,
    episodeCount: s.episodeCount,
    schedule: s.schedule,
    scheduleLabel: s.scheduleLabel,
    lastRunAt: s.lastRunAt,
    nextRunAt: s.nextRunAt,
    cronJobActive: activeJobs.includes(s.id),
    currentlyRunning: runningNow.includes(s.id),
    platforms: s.platforms || { youtube: true, instagram: true, tiktok: true },
    hasCharacterSheet: !!s.characterSheet,
  }));

  // Recent episodes
  const recentEpisodes = episodes.slice(0, 20).map((e) => ({
    id: e.id,
    seriesName: e.seriesName,
    episodeNumber: e.episodeNumber,
    topic: e.topic,
    title: e.title,
    status: e.status,
    youtubeUrl: e.youtubeUrl || null,
    instagramUrl: e.instagramUrl || null,
    tiktokPublishId: e.tiktokPublishId || null,
    createdAt: e.createdAt,
  }));

  // Overall health
  const issues: string[] = [];
  if (!credentials.openai.configured) issues.push("❌ OpenAI API key missing — cannot generate anything");
  if (!credentials.youtube.configured) {
    if (!credentials.youtube.refreshToken) {
      issues.push("❌ YouTube Refresh Token missing — authorize at /api/auth/youtube");
    }
    if (!credentials.youtube.clientId) issues.push("❌ YouTube Client ID missing");
    if (!credentials.youtube.clientSecret) issues.push("❌ YouTube Client Secret missing");
  }
  if (!credentials.elevenlabs.configured && settings.audioProvider === "elevenlabs") {
    issues.push("⚠️ ElevenLabs key missing but selected as audio provider — will fall back to OpenAI TTS");
  }
  if (activeSeries.length === 0) issues.push("⚠️ No active series — nothing will be generated");
  if (activeJobs.length === 0 && activeSeries.length > 0) issues.push("⚠️ Cron jobs not running despite active series");

  const healthStatus = issues.length === 0 ? "HEALTHY" : 
    issues.some(i => i.startsWith("❌")) ? "CRITICAL" : "WARNING";

  return NextResponse.json({
    status: healthStatus,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
    railwayDomain: process.env.RAILWAY_PUBLIC_DOMAIN || null,

    issues,

    capabilities: {
      canGenerateVideo,
      canGenerateAIVideo,
      canUploadYouTube,
      canUploadInstagram: credentials.instagram.configured,
      canUploadTikTok: credentials.tiktok.configured,
    },

    credentials: {
      openai: credentials.openai.configured ? "✅" : "❌",
      elevenlabs: credentials.elevenlabs.configured ? "✅" : "⚠️ missing",
      kling: credentials.kling.configured ? "✅" : "⚠️ missing",
      pixverse: credentials.pixverse.configured ? "✅" : "⚠️ missing",
      fal: credentials.fal.configured ? "✅" : "⚠️ missing",
      youtube_oauth: credentials.youtube.configured ? "✅" : "❌ MISSING",
      youtube_client_id: credentials.youtube.clientId ? "✅" : "❌",
      youtube_client_secret: credentials.youtube.clientSecret ? "✅" : "❌",
      youtube_refresh_token: credentials.youtube.refreshToken ? "✅" : "❌ AUTHORIZE AT /api/auth/youtube",
      instagram: credentials.instagram.configured ? "✅" : "⚠️ missing",
      tiktok: credentials.tiktok.configured ? "✅" : "⚠️ missing",
    },

    providers: {
      image: settings.imageProvider,
      video: settings.videoProvider,
      audio: settings.audioProvider,
    },

    scheduler: {
      activeJobs: activeJobs.length,
      activeJobIds: activeJobs,
      currentlyRunning: runningNow,
    },

    automation,

    series: seriesStatus,
    recentEpisodes,
  }, { status: 200 });
}

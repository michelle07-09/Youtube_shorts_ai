// lib/db.ts
// Local JSON database using a simple file-based approach
// API keys are loaded from environment variables first (highest priority),
// falling back to whatever is stored in the JSON db.

import fs from "fs";
import path from "path";

const DB_PATH = path.join(process.env.DATA_DIR || path.join(process.cwd(), "data"), "db.json");

export interface Topic {
  id: string;
  text: string;
  status: "pending" | "running" | "done" | "failed";
  createdAt: string;
}

export interface PipelineRun {
  id: string;
  topicId: string;
  topic: string;
  status: "running" | "done" | "failed";
  stages: Record<string, StageResult>;
  result?: {
    title: string;
    videoUrl?: string;
    youtubeUrl?: string;
    thumbnailUrl?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface StageResult {
  status: "pending" | "running" | "done" | "failed";
  startedAt?: string;
  completedAt?: string;
  output?: unknown;
  error?: string;
}

export interface AppSettings {
  openaiKey: string;
  elevenLabsKey: string;
  elevenLabsVoiceId: string;
  falKey: string;
  klingKey: string;
  klingSecret: string;
  pixverseKey: string;
  youtubeClientId: string;
  youtubeClientSecret: string;
  youtubeRefreshToken: string;
  imageProvider: "dalle3" | "flux";
  videoProvider: "kling" | "pixverse" | "runway";
  audioProvider: "elevenlabs" | "openai";
  channelName: string;
  channelStyle: string;
  videoDuration: string;
  language: string;
  autopilotEnabled: boolean;
  autopilotIntervalMinutes: string;
  autopilotMaxRunsPerDay: string;
  autopilotAutoUpload: boolean;
  autopilotVisibility: "public" | "private" | "unlisted";
  autopilotTopicPrompt: string;
  instagramAccessToken: string;
  instagramUserId: string;
  instagramAppId: string;
  instagramAppSecret: string;
  tiktokAccessToken: string;
  tiktokRefreshToken: string;
  tiktokClientKey: string;
  tiktokClientSecret: string;
}

interface DB {
  topics: Topic[];
  runs: PipelineRun[];
  settings: AppSettings;
  automation: AutomationState;
}

export interface AutomationState {
  enabled: boolean;
  running: boolean;
  runsToday: number;
  day: string;
  currentRunId?: string;
  currentTopicId?: string;
  currentTopic?: string;
  lastRunAt?: string;
  nextRunAt?: string;
  lastHeartbeatAt?: string;
  lastMessage?: string;
  lastError?: string;
  startedAt?: string;
  stoppedAt?: string;
}

/** Defaults pulled entirely from environment variables */
function envDefaults(): AppSettings {
  return {
    openaiKey:            process.env.OPENAI_API_KEY        || "",
    elevenLabsKey:        process.env.ELEVENLABS_API_KEY    || "",
    elevenLabsVoiceId:    process.env.ELEVENLABS_VOICE_ID   || "21m00Tcm4TlvDq8ikWAM",
    falKey:               process.env.FAL_KEY               || "",
    klingKey:             process.env.KLING_API_KEY         || "",
    klingSecret:          process.env.KLING_API_SECRET      || "",
    pixverseKey:          process.env.PIXVERSE_API_KEY      || "",
    youtubeClientId:      process.env.YOUTUBE_CLIENT_ID     || "",
    youtubeClientSecret:  process.env.YOUTUBE_CLIENT_SECRET || "",
    youtubeRefreshToken:  process.env.YOUTUBE_REFRESH_TOKEN || "",
    imageProvider:       (process.env.IMAGE_PROVIDER        || "dalle3") as AppSettings["imageProvider"],
    videoProvider:       (process.env.VIDEO_PROVIDER        || "kling")  as AppSettings["videoProvider"],
    audioProvider:       (process.env.AUDIO_PROVIDER        || "elevenlabs") as AppSettings["audioProvider"],
    channelName:          process.env.CHANNEL_NAME          || "The Haunted Archives",
    channelStyle:         process.env.CHANNEL_STYLE         || "Dark Horror",
    videoDuration:        process.env.VIDEO_DURATION        || "45",
    language:             process.env.LANGUAGE              || "English",
    autopilotEnabled:      process.env.AUTOPILOT_ENABLED === "true",
    autopilotIntervalMinutes: process.env.AUTOPILOT_INTERVAL_MINUTES || "60",
    autopilotMaxRunsPerDay:   process.env.AUTOPILOT_MAX_RUNS_PER_DAY || "3",
    autopilotAutoUpload:      process.env.AUTOPILOT_AUTO_UPLOAD === "true",
    autopilotVisibility:      (process.env.AUTOPILOT_VISIBILITY || "private") as AppSettings["autopilotVisibility"],
    autopilotTopicPrompt:
      process.env.AUTOPILOT_TOPIC_PROMPT ||
      "Generate fresh, high-retention YouTube Shorts topics that fit the channel style. Avoid duplicates.",
    instagramAccessToken: process.env.INSTAGRAM_ACCESS_TOKEN || "",
    instagramUserId:      process.env.INSTAGRAM_USER_ID      || "",
    instagramAppId:       process.env.INSTAGRAM_APP_ID       || "",
    instagramAppSecret:   process.env.INSTAGRAM_APP_SECRET   || "",
    tiktokAccessToken:    process.env.TIKTOK_ACCESS_TOKEN    || "",
    tiktokRefreshToken:   process.env.TIKTOK_REFRESH_TOKEN   || "",
    tiktokClientKey:      process.env.TIKTOK_CLIENT_KEY      || "",
    tiktokClientSecret:   process.env.TIKTOK_CLIENT_SECRET   || "",
  };
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function defaultAutomationState(): AutomationState {
  return {
    enabled: false,
    running: false,
    runsToday: 0,
    day: todayKey(),
    lastMessage: "Autopilot is idle.",
  };
}

function ensureDir() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function readDB(): DB {
  ensureDir();
  if (!fs.existsSync(DB_PATH)) {
    const defaultDB: DB = {
      topics: [],
      runs: [],
      settings: envDefaults(),
      automation: defaultAutomationState(),
    };
    fs.writeFileSync(DB_PATH, JSON.stringify(defaultDB, null, 2));
    return defaultDB;
  }
  const db = JSON.parse(fs.readFileSync(DB_PATH, "utf-8")) as Partial<DB>;
  db.topics = db.topics || [];
  db.runs = db.runs || [];
  db.settings = { ...envDefaults(), ...(db.settings || {}) };
  db.automation = { ...defaultAutomationState(), ...(db.automation || {}) };
  return db as DB;
}

export function writeDB(db: DB): void {
  ensureDir();
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

/**
 * getSettings() merges stored settings with env vars.
 * Environment variables ALWAYS win over stored values,
 * so keys in .env.local are always active without manual UI entry.
 */
export function getSettings(): AppSettings {
  const stored = readDB().settings;
  const env = envDefaults();

  return {
    // For each key: use env var if non-empty, otherwise fall back to stored
    openaiKey:           env.openaiKey           || stored.openaiKey,
    elevenLabsKey:       env.elevenLabsKey       || stored.elevenLabsKey,
    elevenLabsVoiceId:   env.elevenLabsVoiceId   || stored.elevenLabsVoiceId,
    falKey:              env.falKey               || stored.falKey,
    klingKey:            env.klingKey             || stored.klingKey,
    klingSecret:         env.klingSecret          || stored.klingSecret,
    pixverseKey:         env.pixverseKey          || stored.pixverseKey,
    youtubeClientId:     env.youtubeClientId      || stored.youtubeClientId,
    youtubeClientSecret: env.youtubeClientSecret  || stored.youtubeClientSecret,
    youtubeRefreshToken: env.youtubeRefreshToken  || stored.youtubeRefreshToken,
    imageProvider:       env.imageProvider        || stored.imageProvider,
    videoProvider:       env.videoProvider        || stored.videoProvider,
    audioProvider:       env.audioProvider        || stored.audioProvider,
    channelName:         env.channelName          || stored.channelName,
    channelStyle:        env.channelStyle         || stored.channelStyle,
    videoDuration:       env.videoDuration        || stored.videoDuration,
    language:            env.language             || stored.language,
    autopilotEnabled: process.env.AUTOPILOT_ENABLED
      ? env.autopilotEnabled
      : stored.autopilotEnabled,
    autopilotIntervalMinutes:
      process.env.AUTOPILOT_INTERVAL_MINUTES || stored.autopilotIntervalMinutes,
    autopilotMaxRunsPerDay:
      process.env.AUTOPILOT_MAX_RUNS_PER_DAY || stored.autopilotMaxRunsPerDay,
    autopilotAutoUpload: process.env.AUTOPILOT_AUTO_UPLOAD
      ? env.autopilotAutoUpload
      : stored.autopilotAutoUpload,
    autopilotVisibility: (process.env.AUTOPILOT_VISIBILITY as AppSettings["autopilotVisibility"]) || stored.autopilotVisibility,
    autopilotTopicPrompt:
      process.env.AUTOPILOT_TOPIC_PROMPT || stored.autopilotTopicPrompt,
    instagramAccessToken: env.instagramAccessToken || stored.instagramAccessToken,
    instagramUserId:      env.instagramUserId      || stored.instagramUserId,
    instagramAppId:       env.instagramAppId       || stored.instagramAppId,
    instagramAppSecret:   env.instagramAppSecret   || stored.instagramAppSecret,
    tiktokAccessToken:    env.tiktokAccessToken    || stored.tiktokAccessToken,
    tiktokRefreshToken:   env.tiktokRefreshToken   || stored.tiktokRefreshToken,
    tiktokClientKey:      env.tiktokClientKey      || stored.tiktokClientKey,
    tiktokClientSecret:   env.tiktokClientSecret   || stored.tiktokClientSecret,
  };
}

export function saveSettings(settings: Partial<AppSettings>): void {
  const db = readDB();
  db.settings = { ...db.settings, ...settings };
  writeDB(db);
}

export function getTopics(): Topic[] {
  return readDB().topics;
}

export function addTopic(topic: Topic): void {
  const db = readDB();
  db.topics.push(topic);
  writeDB(db);
}

export function updateTopic(id: string, updates: Partial<Topic>): void {
  const db = readDB();
  const idx = db.topics.findIndex((t) => t.id === id);
  if (idx !== -1) db.topics[idx] = { ...db.topics[idx], ...updates };
  writeDB(db);
}

export function deleteTopic(id: string): void {
  const db = readDB();
  db.topics = db.topics.filter((t) => t.id !== id);
  writeDB(db);
}

export function getRuns(): PipelineRun[] {
  return readDB().runs;
}

export function createRun(run: PipelineRun): void {
  const db = readDB();
  db.runs.push(run);
  writeDB(db);
}

export function updateRun(id: string, updates: Partial<PipelineRun>): void {
  const db = readDB();
  const idx = db.runs.findIndex((r) => r.id === id);
  if (idx !== -1)
    db.runs[idx] = { ...db.runs[idx], ...updates, updatedAt: new Date().toISOString() };
  writeDB(db);
}

export function updateRunStage(runId: string, stage: string, result: StageResult): void {
  const db = readDB();
  const idx = db.runs.findIndex((r) => r.id === runId);
  if (idx !== -1) {
    db.runs[idx].stages[stage] = result;
    db.runs[idx].updatedAt = new Date().toISOString();
  }
  writeDB(db);
}

export function getAutomationState(): AutomationState {
  const db = readDB();
  const today = todayKey();

  if (db.automation.day !== today) {
    db.automation.day = today;
    db.automation.runsToday = 0;
    writeDB(db);
  }

  return db.automation;
}

export function updateAutomationState(updates: Partial<AutomationState>): void {
  const db = readDB();
  db.automation = { ...db.automation, ...updates };
  writeDB(db);
}

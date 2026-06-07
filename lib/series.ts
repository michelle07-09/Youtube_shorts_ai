// lib/series.ts
// Series management — autonomous daily upload system

import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

const SERIES_PATH = path.join(process.env.DATA_DIR || path.join(process.cwd(), "data"), "series.json");

export interface Series {
  id: string;
  name: string;           // e.g. "The Haunted Archives"
  style: string;          // e.g. "Dark Horror"
  description: string;    // What this series is about
  schedule: string;       // cron expression e.g. "0 9 * * *" = 9am daily
  scheduleLabel: string;  // Human readable e.g. "Every day at 9:00 AM"
  active: boolean;
  episodeCount: number;
  language: string;
  videoDuration: string;
  youtubeVisibility: "public" | "private" | "unlisted";
  youtubeHashtags: string;
  youtubePlaylistId?: string;   // ← YouTube playlist ID for this series
  youtubePlaylistUrl?: string;  // ← YouTube playlist URL
  lastRunAt: string | null;
  nextRunAt: string | null;
  createdAt: string;
  characterSheet?: string;
  settingDescription?: string;
  platforms: {
    youtube: boolean;
    instagram: boolean;
    tiktok: boolean;
  };
  instagramCaption?: string;
  tiktokPrivacy?: "PUBLIC_TO_EVERYONE" | "MUTUAL_FOLLOW_FRIENDS" | "SELF_ONLY";
}

export interface Episode {
  id: string;
  seriesId: string;
  seriesName: string;
  episodeNumber: number;
  topic: string;
  title: string;
  status: "running" | "done" | "failed";
  runId: string;
  youtubeUrl?: string;
  instagramUrl?: string;
  tiktokPublishId?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  createdAt: string;
}

interface SeriesDB {
  series: Series[];
  episodes: Episode[];
}

function ensureFile(): SeriesDB {
  const dir = path.dirname(SERIES_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  if (!fs.existsSync(SERIES_PATH)) {
    const empty: SeriesDB = { series: [], episodes: [] };
    fs.writeFileSync(SERIES_PATH, JSON.stringify(empty, null, 2));
    return empty;
  }
  const db = JSON.parse(fs.readFileSync(SERIES_PATH, "utf-8")) as SeriesDB;
  db.series = (db.series || []).map((s) => ({
    ...s,
    platforms: s.platforms || { youtube: true, instagram: true, tiktok: true },
  }));
  db.episodes = db.episodes || [];
  return db;
}

function writeFile(db: SeriesDB) {
  fs.writeFileSync(SERIES_PATH, JSON.stringify(db, null, 2));
}

export function getAllSeries(): Series[] {
  return ensureFile().series;
}

export function getActiveSeries(): Series[] {
  return ensureFile().series.filter((s) => s.active);
}

export function getSeriesById(id: string): Series | null {
  return ensureFile().series.find((s) => s.id === id) || null;
}

export function createSeries(data: Omit<Series, "id" | "episodeCount" | "lastRunAt" | "nextRunAt" | "createdAt">): Series {
  const db = ensureFile();
  const series: Series = {
    ...data,
    id: uuidv4(),
    episodeCount: 0,
    lastRunAt: null,
    nextRunAt: computeNextRun(data.schedule),
    createdAt: new Date().toISOString(),
  };
  db.series.push(series);
  writeFile(db);
  return series;
}

export function updateSeries(id: string, updates: Partial<Series>) {
  const db = ensureFile();
  const idx = db.series.findIndex((s) => s.id === id);
  if (idx !== -1) db.series[idx] = { ...db.series[idx], ...updates };
  writeFile(db);
}

export function deleteSeries(id: string) {
  const db = ensureFile();
  db.series = db.series.filter((s) => s.id !== id);
  writeFile(db);
}

export function addEpisode(ep: Omit<Episode, "id">): Episode {
  const db = ensureFile();
  const episode: Episode = { ...ep, id: uuidv4() };
  db.episodes.push(episode);
  writeFile(db);
  return episode;
}

export function updateEpisode(id: string, updates: Partial<Episode>) {
  const db = ensureFile();
  const idx = db.episodes.findIndex((e) => e.id === id);
  if (idx !== -1) db.episodes[idx] = { ...db.episodes[idx], ...updates };
  writeFile(db);
}

export function getEpisodesBySeriesId(seriesId: string): Episode[] {
  return ensureFile().episodes
    .filter((e) => e.seriesId === seriesId)
    .sort((a, b) => b.episodeNumber - a.episodeNumber);
}

export function getAllEpisodes(): Episode[] {
  return ensureFile().episodes.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

/** Compute the next cron run time as ISO string */
export function computeNextRun(cronExpr: string): string | null {
  try {
    // Parse simple daily cron "minute hour * * *"
    const parts = cronExpr.trim().split(/\s+/);
    if (parts.length !== 5) return null;
    const [min, hour] = parts;

    const now = new Date();
    const next = new Date();
    next.setHours(parseInt(hour), parseInt(min), 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    return next.toISOString();
  } catch {
    return null;
  }
}

/** CRON presets */
export const CRON_PRESETS = [
  { label: "Every day at 6:00 AM",  value: "0 6 * * *"  },
  { label: "Every day at 9:00 AM",  value: "0 9 * * *"  },
  { label: "Every day at 12:00 PM", value: "0 12 * * *" },
  { label: "Every day at 3:00 PM",  value: "0 15 * * *" },
  { label: "Every day at 6:00 PM",  value: "0 18 * * *" },
  { label: "Every day at 9:00 PM",  value: "0 21 * * *" },
  { label: "Every 12 hours",        value: "0 9,21 * * *" },
  { label: "Every 6 hours",         value: "0 6,12,18,0 * * *" },
];

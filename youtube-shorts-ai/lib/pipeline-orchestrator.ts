// lib/pipeline-orchestrator.ts
// Core orchestrator — full AI pipeline with Ken Burns motion + character consistency

import path from "path";
import fs from "fs";
import axios from "axios";
import { spawn } from "child_process";
import { AppSettings, updateRun, updateRunStage, updateTopic } from "./db";
import { generateScript, generateAlternativeTitles, generateImageDALLE, generateTTSOpenAI } from "./providers/openai";
import { generateTTSElevenLabs } from "./providers/elevenlabs";
import { generateImageFlux } from "./providers/fal";
import { generateVideoKling } from "./providers/kling";
import { generateVideoPixVerse } from "./providers/pixverse";

export type SSECallback = (event: PipelineEvent) => void;

export interface PipelineEvent {
  stage: string;
  status: "start" | "progress" | "done" | "error";
  message: string;
  data?: unknown;
}

const OUTPUT_DIR = process.env.OUTPUT_DIR || path.join(/*turbopackIgnore: true*/ process.cwd(), "public", "output");

function ensureOutputDir() {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function downloadFile(url: string, dest: string): Promise<void> {
  const response = await axios.get(url, { responseType: "arraybuffer", timeout: 60000 });
  fs.writeFileSync(dest, Buffer.from(response.data));
}

function emit(cb: SSECallback, stage: string, status: PipelineEvent["status"], message: string, data?: unknown) {
  cb({ stage, status, message, data });
}

// Ken Burns motion presets — different effect per scene so they feel varied
const MOTION_PRESETS = [
  // Slow zoom in (center)
  (frames: number) =>
    `zoompan=z='min(zoom+0.0010,1.4)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=1080x1920`,
  // Pan left to right
  (frames: number) =>
    `zoompan=z=1.3:x='if(lte(on\\,1)\\,0\\,x+0.7)':y='ih/2-(ih/zoom/2)':d=${frames}:s=1080x1920`,
  // Slow zoom out (center)
  (frames: number) =>
    `zoompan=z='if(lte(on\\,1)\\,1.4\\,max(1.0\\,zoom-0.0010))':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=1080x1920`,
  // Pan right to left
  (frames: number) =>
    `zoompan=z=1.3:x='if(lte(on\\,1)\\,(iw-iw/zoom)\\,max(0\\,x-0.7))':y='ih/2-(ih/zoom/2)':d=${frames}:s=1080x1920`,
  // Tilt up (pan from bottom to top)
  (frames: number) =>
    `zoompan=z=1.3:x='iw/2-(iw/zoom/2)':y='if(lte(on\\,1)\\,(ih-ih/zoom)\\,max(0\\,y-0.5))':d=${frames}:s=1080x1920`,
  // Zoom in (top-left)
  (frames: number) =>
    `zoompan=z='min(zoom+0.0008,1.35)':x=0:y=0:d=${frames}:s=1080x1920`,
];

export async function runPipeline(
  runId: string,
  topicId: string,
  topic: string,
  settings: AppSettings,
  onEvent: SSECallback,
  seriesCharacterSheet?: string,
  seriesSettingDescription?: string
): Promise<void> {
  ensureOutputDir();
  const runDir = path.join(OUTPUT_DIR, runId);
  fs.mkdirSync(runDir, { recursive: true });

  try {
    // ─── STAGE 1: Script ──────────────────────────────────────────
    emit(onEvent, "script", "start", "🧠 Generating story, characters and scene breakdown...");
    updateRunStage(runId, "script", { status: "running", startedAt: new Date().toISOString() });

    const script = await generateScript(
      settings.openaiKey,
      topic,
      settings.channelStyle,
      settings.videoDuration,
      settings.language,
      seriesCharacterSheet,
      seriesSettingDescription
    );

    fs.writeFileSync(path.join(runDir, "script.json"), JSON.stringify(script, null, 2));
    updateRunStage(runId, "script", { status: "done", completedAt: new Date().toISOString(), output: script });
    emit(onEvent, "script", "done", `✅ Script: "${script.title}" — ${script.scenes.length} scenes with consistent character`, script);

    // ─── STAGE 2: Images ─────────────────────────────────────────
    emit(onEvent, "images", "start", "🖼️ Generating scene images (character locked for all scenes)...");
    updateRunStage(runId, "images", { status: "running", startedAt: new Date().toISOString() });

    const imageUrls: string[] = [];
    const dalleUrls: string[] = []; // Keep original CDN URLs for video APIs

    for (let i = 0; i < script.scenes.length; i++) {
      const scene = script.scenes[i];
      emit(onEvent, "images", "progress", `🎨 Scene ${i + 1}/${script.scenes.length}: ${scene.imagePrompt.slice(0, 80)}...`);

      let imageUrl: string;
      if (settings.imageProvider === "flux" && settings.falKey) {
        const result = await generateImageFlux(settings.falKey, scene.imagePrompt, scene.scene);
        imageUrl = result.url;
      } else {
        imageUrl = await generateImageDALLE(settings.openaiKey, scene.imagePrompt);
      }

      dalleUrls.push(imageUrl); // save CDN URL for Kling (needs public URL)

      const imagePath = path.join(runDir, `scene_${i + 1}.png`);
      await downloadFile(imageUrl, imagePath);
      imageUrls.push(`/api/output/${runId}/scene_${i + 1}.png`);
      emit(onEvent, "images", "progress", `✅ Scene ${i + 1} image done`);
    }

    updateRunStage(runId, "images", { status: "done", completedAt: new Date().toISOString(), output: imageUrls });
    emit(onEvent, "images", "done", `✅ All ${imageUrls.length} scene images generated`, imageUrls);

    // ─── STAGE 3: Audio / Voiceover ──────────────────────────────
    emit(onEvent, "audio", "start", "🎤 Generating voiceover narration...");
    updateRunStage(runId, "audio", { status: "running", startedAt: new Date().toISOString() });

    const fullNarration = script.scenes.map((s) => s.narration).join(" ");
    let audioBuffer: Buffer;

    if (settings.audioProvider === "elevenlabs" && settings.elevenLabsKey) {
      emit(onEvent, "audio", "progress", "🎤 Using ElevenLabs voice...");
      audioBuffer = await generateTTSElevenLabs(settings.elevenLabsKey, fullNarration, settings.elevenLabsVoiceId);
    } else {
      emit(onEvent, "audio", "progress", "🎤 Using OpenAI TTS...");
      audioBuffer = await generateTTSOpenAI(settings.openaiKey, fullNarration);
    }

    const audioPath = path.join(runDir, "narration.mp3");
    fs.writeFileSync(audioPath, audioBuffer);
    const audioPublicPath = `/api/output/${runId}/narration.mp3`;
    updateRunStage(runId, "audio", { status: "done", completedAt: new Date().toISOString(), output: audioPublicPath });
    emit(onEvent, "audio", "done", "✅ Voiceover narration generated", audioPublicPath);

    // ─── STAGE 4: Video Generation ───────────────────────────────
    const videoUrls: string[] = [];
    const hasVideoProvider =
      (settings.videoProvider === "kling" && settings.klingKey) ||
      (settings.videoProvider === "pixverse" && settings.pixverseKey);

    if (hasVideoProvider) {
      emit(onEvent, "videos", "start", "🎬 Generating scene videos (3-5 min per scene)...");
      updateRunStage(runId, "videos", { status: "running", startedAt: new Date().toISOString() });

      for (let i = 0; i < script.scenes.length; i++) {
        const scene = script.scenes[i];
        const publicImageUrl = dalleUrls[i]; // Use CDN URL — Kling needs public access

        emit(onEvent, "videos", "progress", `🎬 Scene ${i + 1}/${script.scenes.length}...`);

        try {
          let videoUrl: string;
          if (settings.videoProvider === "kling" && settings.klingKey) {
            const result = await generateVideoKling(settings.klingKey, settings.klingSecret, publicImageUrl, scene.videoPrompt);
            videoUrl = result.url;
          } else {
            const result = await generateVideoPixVerse(settings.pixverseKey, publicImageUrl, scene.videoPrompt);
            videoUrl = result.url;
          }

          const videoPath = path.join(runDir, `scene_${i + 1}.mp4`);
          await downloadFile(videoUrl, videoPath);
          videoUrls.push(`/api/output/${runId}/scene_${i + 1}.mp4`);
          emit(onEvent, "videos", "progress", `✅ Scene ${i + 1} video done`);
        } catch (err) {
          emit(onEvent, "videos", "progress", `⚠️ Scene ${i + 1} video failed — using Ken Burns image instead`);
          videoUrls.push(imageUrls[i]);
        }
      }

      updateRunStage(runId, "videos", { status: "done", completedAt: new Date().toISOString(), output: videoUrls });
      emit(onEvent, "videos", "done", `✅ Videos ready`, videoUrls);
    } else {
      // No video API — Ken Burns effect will make images look like video
      emit(onEvent, "videos", "done", "⏭️ No video API key — Ken Burns motion will be applied to images", imageUrls);
      imageUrls.forEach((_, i) => videoUrls.push(`/api/output/${runId}/scene_${i + 1}.png`));
      updateRunStage(runId, "videos", { status: "done", completedAt: new Date().toISOString(), output: videoUrls });
    }

    // ─── STAGE 5: Titles ─────────────────────────────────────────
    emit(onEvent, "titles", "start", "✍️ Generating title variations...");
    updateRunStage(runId, "titles", { status: "running", startedAt: new Date().toISOString() });
    let altTitles: string[] = [];
    try { altTitles = await generateAlternativeTitles(settings.openaiKey, script.title, settings.channelStyle); }
    catch { altTitles = [script.title]; }
    const titlesData = { main: script.title, alternatives: altTitles };
    fs.writeFileSync(path.join(runDir, "titles.json"), JSON.stringify(titlesData, null, 2));
    updateRunStage(runId, "titles", { status: "done", completedAt: new Date().toISOString(), output: titlesData });
    emit(onEvent, "titles", "done", `✅ Titles generated`, titlesData);

    // ─── STAGE 6: Assemble ───────────────────────────────────────
    emit(onEvent, "assemble", "start", "🎞️ Assembling final video with motion effects + voiceover...");
    updateRunStage(runId, "assemble", { status: "running", startedAt: new Date().toISOString() });

    const assembleResult = await assembleVideo(runId, runDir, script, imageUrls, audioPath);

    updateRunStage(runId, "assemble", { status: "done", completedAt: new Date().toISOString(), output: assembleResult });
    emit(onEvent, "assemble", "done", "✅ Final video assembled with voiceover and motion!", assembleResult);

    // ─── STAGE 7: Save ───────────────────────────────────────────
    emit(onEvent, "save", "start", "💾 Saving results...");
    const result = {
      title: script.title,
      videoUrl: assembleResult.finalVideoPath,
      thumbnailUrl: imageUrls[0],
    };
    updateRun(runId, { status: "done", result });
    updateTopic(topicId, { status: "done" });
    updateRunStage(runId, "save", { status: "done", completedAt: new Date().toISOString(), output: result });
    emit(onEvent, "save", "done", "✅ Pipeline complete! Video ready with voiceover.", result);

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    emit(onEvent, "error", "error", `❌ Pipeline failed: ${message}`);
    updateRun(runId, { status: "failed" });
    updateTopic(topicId, { status: "failed" });
    throw err;
  }
}

/**
 * Assemble final video:
 * 1. Per scene: apply Ken Burns zoom/pan effect to image → segment.mp4 (silent)
 * 2. Concatenate all segments
 * 3. Merge with narration audio track
 */
async function assembleVideo(
  runId: string,
  runDir: string,
  script: { scenes: { scene: number; duration: number }[] },
  imageUrls: string[],
  audioPath: string
): Promise<{ finalVideoPath: string; duration: number }> {

  const finalVideoAbsPath = path.join(runDir, "final_video.mp4");
  const segmentListPath   = path.join(runDir, "segments.txt");
  const segmentPaths: string[] = [];

  for (let i = 0; i < script.scenes.length; i++) {
    const imagePath   = path.join(runDir, `scene_${i + 1}.png`);
    const segmentPath = path.join(runDir, `scene_${i + 1}_segment.mp4`);
    const duration    = Math.max(2, script.scenes[i].duration || 10);
    const frames      = Math.round(duration * 30);

    // Pick a Ken Burns motion preset (cycle through them)
    const motionFilter = MOTION_PRESETS[i % MOTION_PRESETS.length](frames);

    // Build the video filter chain
    // scale=4000:-1 gives zoompan room to pan without black edges
    const vf = [
      "scale=4000:-1",       // oversample for smooth pan/zoom
      motionFilter,          // Ken Burns motion
      "format=yuv420p",      // required for H.264
    ].join(",");

    await runFfmpeg([
      "-y",
      "-loop", "1",
      "-framerate", "30",
      "-i", imagePath,
      "-vf", vf,
      "-t", String(duration),
      "-r", "30",
      "-c:v", "libx264",
      "-crf", "20",
      "-preset", "fast",
      "-pix_fmt", "yuv420p",
      segmentPath,
    ]);

    segmentPaths.push(segmentPath);
  }

  // Write concat list
  fs.writeFileSync(
    segmentListPath,
    segmentPaths.map((p) => `file '${p.replace(/\\/g, "/").replace(/'/g, "'\\''")}'`).join("\n")
  );

  // Concat segments + merge voiceover audio
  await runFfmpeg([
    "-y",
    "-f", "concat",
    "-safe", "0",
    "-i", segmentListPath,     // video (silent)
    "-i", audioPath,           // voiceover narration
    "-c:v", "copy",            // keep video stream unchanged
    "-c:a", "aac",             // encode audio as AAC
    "-b:a", "192k",            // good quality audio bitrate
    "-shortest",               // end when shorter stream ends
    "-movflags", "+faststart", // web-optimized MP4
    finalVideoAbsPath,
  ]);

  if (!fs.existsSync(finalVideoAbsPath)) {
    throw new Error("FFmpeg finished but final_video.mp4 was not created. Check ffmpeg logs.");
  }

  const totalDuration = script.scenes.reduce((a, s) => a + (s.duration || 10), 0);
  return {
    finalVideoPath: `/api/output/${runId}/final_video.mp4`,
    duration: totalDuration,
  };
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("ffmpeg", args, { windowsHide: true });
    let stderr = "";

    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });

    child.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") {
        reject(new Error("FFmpeg is not installed or not on PATH. Install FFmpeg from https://ffmpeg.org/download.html"));
        return;
      }
      reject(error);
    });

    child.on("close", (code) => {
      if (code === 0) { resolve(); return; }
      reject(new Error(`FFmpeg failed (code ${code}): ${stderr.slice(-2000)}`));
    });
  });
}

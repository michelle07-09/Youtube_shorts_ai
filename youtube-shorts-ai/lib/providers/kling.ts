// lib/providers/kling.ts
// Kling AI video generation (image-to-video)

import axios from "axios";
import crypto from "crypto";

function generateKlingToken(apiKey: string, apiSecret: string): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({ iss: apiKey, exp: now + 1800, nbf: now - 5 })
  ).toString("base64url");
  const sig = crypto
    .createHmac("sha256", apiSecret)
    .update(`${header}.${payload}`)
    .digest("base64url");
  return `${header}.${payload}.${sig}`;
}

export interface KlingVideoResult {
  url: string;
  duration: number;
}

export async function generateVideoKling(
  apiKey: string,
  apiSecret: string,
  imageUrl: string,
  prompt: string,
  duration: 5 | 10 = 5
): Promise<KlingVideoResult> {
  const token = generateKlingToken(apiKey, apiSecret);

  // Submit task
  const submitRes = await axios.post(
    "https://api.klingai.com/v1/videos/image2video",
    {
      model_name: "kling-v1",
      image: imageUrl,
      prompt: `${prompt}. Cinematic quality, smooth motion, horror atmosphere.`,
      negative_prompt: "blurry, low quality, static, no motion",
      cfg_scale: 0.5,
      mode: "std",
      duration: String(duration),
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );

  const taskId = submitRes.data.data?.task_id;
  if (!taskId) throw new Error("Kling: no task_id returned");

  // Poll for completion (videos take 2-5 min)
  let attempts = 0;
  while (attempts < 60) {
    await sleep(10000); // wait 10 seconds between polls

    const statusRes = await axios.get(
      `https://api.klingai.com/v1/videos/image2video/${taskId}`,
      { headers: { Authorization: `Bearer ${generateKlingToken(apiKey, apiSecret)}` } }
    );

    const task = statusRes.data.data;
    if (task?.task_status === "succeed") {
      const videoUrl = task.task_result?.videos?.[0]?.url;
      if (!videoUrl) throw new Error("Kling: no video URL in result");
      return { url: videoUrl, duration };
    }

    if (task?.task_status === "failed") {
      throw new Error(`Kling video generation failed: ${task.task_status_msg}`);
    }

    attempts++;
  }

  throw new Error("Kling video generation timed out");
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

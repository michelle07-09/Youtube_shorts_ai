// lib/providers/pixverse.ts
// PixVerse video generation provider

import axios from "axios";

export async function generateVideoPixVerse(
  apiKey: string,
  imageUrl: string,
  prompt: string
): Promise<{ url: string }> {
  // Submit generation
  const submitRes = await axios.post(
    "https://app-api.pixverse.ai/openapi/v2/video/img/generate",
    {
      img_url: imageUrl,
      prompt: `${prompt}. Cinematic quality, smooth motion.`,
      duration: 5,
      motion_mode: "normal",
      quality: "1080p",
      negative_prompt: "blurry, static, no motion, low quality",
    },
    {
      headers: {
        "API-KEY": apiKey,
        "Content-Type": "application/json",
      },
    }
  );

  const videoId = submitRes.data?.Resp?.video_id;
  if (!videoId) throw new Error("PixVerse: no video_id returned");

  // Poll for completion
  let attempts = 0;
  while (attempts < 40) {
    await sleep(15000);

    const statusRes = await axios.get(
      `https://app-api.pixverse.ai/openapi/v2/video/result/${videoId}`,
      { headers: { "API-KEY": apiKey } }
    );

    const status = statusRes.data?.Resp?.status;
    if (status === 1) {
      // completed
      const url = statusRes.data?.Resp?.url;
      return { url };
    }
    if (status === -1) {
      throw new Error("PixVerse video generation failed");
    }

    attempts++;
  }

  throw new Error("PixVerse video generation timed out");
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

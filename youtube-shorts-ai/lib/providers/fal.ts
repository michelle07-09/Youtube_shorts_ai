// lib/providers/fal.ts
// Flux image generation via FAL.ai

import axios from "axios";

export interface FluxImageResult {
  url: string;
  width: number;
  height: number;
}

export async function generateImageFlux(
  apiKey: string,
  prompt: string,
  sceneIndex: number
): Promise<FluxImageResult> {
  // Submit job
  const submitRes = await axios.post(
    "https://queue.fal.run/fal-ai/flux/schnell",
    {
      prompt: `${prompt}. Vertical 9:16 portrait format, ultra-detailed, cinematic lighting, photorealistic.`,
      image_size: "portrait_9_16",
      num_inference_steps: 8,
      num_images: 1,
      enable_safety_checker: true,
    },
    {
      headers: {
        Authorization: `Key ${apiKey}`,
        "Content-Type": "application/json",
      },
    }
  );

  const requestId = submitRes.data.request_id;

  // Poll for result
  let attempts = 0;
  while (attempts < 20) {
    await sleep(3000);
    const statusRes = await axios.get(
      `https://queue.fal.run/fal-ai/flux/schnell/requests/${requestId}/status`,
      { headers: { Authorization: `Key ${apiKey}` } }
    );

    if (statusRes.data.status === "COMPLETED") {
      const resultRes = await axios.get(
        `https://queue.fal.run/fal-ai/flux/schnell/requests/${requestId}`,
        { headers: { Authorization: `Key ${apiKey}` } }
      );
      const image = resultRes.data.images[0];
      return { url: image.url, width: image.width, height: image.height };
    }

    if (statusRes.data.status === "FAILED") {
      throw new Error(`FAL image generation failed for scene ${sceneIndex}`);
    }

    attempts++;
  }

  throw new Error(`FAL image generation timed out for scene ${sceneIndex}`);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

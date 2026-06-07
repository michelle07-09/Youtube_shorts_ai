// lib/providers/openai.ts
import OpenAI from "openai";

export function getOpenAIClient(apiKey: string): OpenAI {
  return new OpenAI({ apiKey });
}

export interface Scene {
  scene: number;
  imagePrompt: string;
  videoPrompt: string;
  narration: string;
  duration: number;
}

export interface ScriptOutput {
  title: string;
  story: string;
  characterSheet: string;   // ← VISUAL description of ALL main characters — constant across scenes
  settingDescription: string; // ← location/world lore — constant across scenes
  scenes: Scene[];
}

export interface SeriesCharacters {
  characterSheet: string;
  settingDescription: string;
}

export async function generateSeriesCharacters(
  apiKey: string,
  seriesName: string,
  style: string,
  description: string
): Promise<SeriesCharacters> {
  const client = getOpenAIClient(apiKey);
  const response = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: "You are a creative visual director and showrunner designing an AI-generated vertical video series. Always respond with valid JSON only.",
      },
      {
        role: "user",
        content: `Create a persistent Character Sheet and Setting Description for a new series: "${seriesName}"
Style: ${style}
Description: ${description}

We need persistent characters and settings to keep the visual style consistent across episodes.

Return ONLY this JSON (no markdown):
{
  "characterSheet": "EXHAUSTIVE physical description of 1-3 main characters: [Character name], [age]-year-old [gender], [skin tone] skin, [hair color/style], [eye color] eyes, wearing [specific detailed outfit with colors]. [Any scars/marks/distinguishing features]. [Expression/demeanor]. Make sure they are distinct and visually striking.",
  "settingDescription": "EXHAUSTIVE description of the main setting: Location: [specific place]. [Detailed atmosphere: lighting color, time of day, weather, architectural details, mood, color palette]. [What materials, textures, objects are visible]."
}`,
      },
    ],
    temperature: 0.8,
    response_format: { type: "json_object" },
  });

  const content = response.choices[0].message.content || "{}";
  return JSON.parse(content) as SeriesCharacters;
}

export async function generateScript(
  apiKey: string,
  topic: string,
  channelStyle: string,
  duration: string,
  language: string,
  seriesCharacterSheet?: string,
  seriesSettingDescription?: string
): Promise<ScriptOutput> {
  const client = getOpenAIClient(apiKey);

  const systemPrompt = `You are a master storyteller creating ${duration}-second YouTube Shorts scripts for a ${channelStyle} channel.
Create engaging, suspenseful content optimized for vertical video format.
CRITICAL: Character appearance and setting MUST be 100% consistent across all scenes.
Always respond with valid JSON only.`;

  const contextInstruction = (seriesCharacterSheet && seriesSettingDescription)
    ? `IMPORTANT: This is a continuation of a series. You MUST write this episode to feature the persistent character(s) and setting defined below. Do NOT invent new main characters or settings.
EXISTING CHARACTER SHEET:
${seriesCharacterSheet}

EXISTING SETTING DESCRIPTION:
${seriesSettingDescription}
`
    : `Define a "characterSheet" and a "settingDescription" from scratch for this episode.`;

  const userPrompt = `Create a YouTube Short script for: "${topic}"

Requirements:
- Style: ${channelStyle}
- Total duration: ${duration} seconds
- Language: ${language}
- Number of scenes: 4-6 scenes, each 8-12 seconds
- Narrative Arc: The script should have a clear emotional hook, dramatic build-up, and end on a cliffhanger.
- Voice direction: Feel free to include bracketed audio/voice cues in the narration (e.g. "[whispers]", "[speaking urgently]", "[gasp]") if appropriate, to guide the voice-over.

${contextInstruction}

IMPORTANT for image consistency:
1. Define/reuse the "characterSheet" — a single, extremely detailed physical description of every character that appears (hair color, eye color, skin tone, age, clothing, specific features). This EXACT description will be copy-pasted into every scene's imagePrompt so the AI generates the SAME character every time.
2. Define/reuse the "settingDescription" — detailed visual description of the location/world (architecture, lighting, atmosphere, colors). Also copy-pasted into every scene.
3. Each scene's imagePrompt must be SHORT (just the scene action) — the character and setting descriptions will be automatically prepended.

Return ONLY this JSON (no markdown):
{
  "title": "Catchy ${channelStyle} title with strong hook",
  "story": "Full story in 2-3 paragraphs",
  "characterSheet": "EXHAUSTIVE physical description: [Character name], [age]-year-old [gender], [skin tone] skin, [hair color/style], [eye color] eyes, wearing [specific detailed outfit with colors]. [Any scars/marks/distinguishing features]. [Expression/demeanor].",
  "settingDescription": "Location: [specific place]. [Detailed atmosphere: lighting color, time of day, weather, architectural details, mood, color palette]. [What materials, textures, objects are visible].",
  "scenes": [
    {
      "scene": 1,
      "imagePrompt": "[Scene-specific action ONLY — 1-2 sentences describing what is HAPPENING in this scene. Do NOT include character or setting here.]",
      "videoPrompt": "Camera: slow zoom in / pan left / dolly forward / tilt up — pick one movement",
      "narration": "Spoken narration for this scene (${language})",
      "duration": 10
    }
  ]
}`;

  const response = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.75,
    response_format: { type: "json_object" },
  });

  const content = response.choices[0].message.content || "{}";
  const parsed = JSON.parse(content) as ScriptOutput;

  // Overwrite output character sheet/setting if series values were supplied
  if (seriesCharacterSheet) {
    parsed.characterSheet = seriesCharacterSheet;
  }
  if (seriesSettingDescription) {
    parsed.settingDescription = seriesSettingDescription;
  }

  // ── Inject character + setting into every image prompt ──────────
  // This ensures DALL-E sees the same character description for every scene
  const charPrefix = parsed.characterSheet
    ? `[CHARACTER: ${parsed.characterSheet}] [SETTING: ${parsed.settingDescription}] `
    : "";

  parsed.scenes = parsed.scenes.map((scene) => ({
    ...scene,
    imagePrompt: `${charPrefix}${scene.imagePrompt} — ${channelStyle} style, cinematic, 9:16 vertical format, ultra-detailed, professional lighting`,
  }));

  return parsed;
}

export async function generateAlternativeTitles(
  apiKey: string,
  mainTitle: string,
  style: string
): Promise<string[]> {
  const client = getOpenAIClient(apiKey);

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "user",
        content: `Generate 4 alternative YouTube Shorts titles for: "${mainTitle}" (${style} style).
Return ONLY a JSON array of strings: ["title1", "title2", "title3", "title4"]`,
      },
    ],
    response_format: { type: "json_object" },
  });

  const content = response.choices[0].message.content || '{"titles":[]}';
  const parsed = JSON.parse(content);
  return parsed.titles || parsed;
}

export async function generateTopicIdea(
  apiKey: string,
  channelStyle: string,
  language: string,
  topicPrompt: string,
  recentTopics: string[]
): Promise<string> {
  const client = getOpenAIClient(apiKey);

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: "You create concise YouTube Shorts topic ideas. Return valid JSON only.",
      },
      {
        role: "user",
        content: `Channel style: ${channelStyle}
Language: ${language}
Brief: ${topicPrompt}
Recent topics to avoid (don't repeat these): ${recentTopics.length ? recentTopics.join(" | ") : "none"}

Return ONLY this JSON:
{ "topic": "one specific, unique short-form video idea, under 120 characters" }`,
      },
    ],
    temperature: 0.9,
    response_format: { type: "json_object" },
  });

  const parsed = JSON.parse(response.choices[0].message.content || "{}");
  const topic = typeof parsed.topic === "string" ? parsed.topic.trim() : "";

  if (!topic) throw new Error("OpenAI did not return a usable autopilot topic.");
  return topic;
}

export async function generateImageDALLE(
  apiKey: string,
  prompt: string
): Promise<string> {
  const client = getOpenAIClient(apiKey);

  // Trim prompt to DALL-E 3 max (4000 chars) to avoid rejection
  const trimmedPrompt = prompt.slice(0, 3900);

  const response = await client.images.generate({
    model: "dall-e-3",
    prompt: trimmedPrompt,
    n: 1,
    size: "1024x1792",
    quality: "hd",
  });

  return response.data?.[0]?.url ?? "";
}

export async function generateTTSOpenAI(
  apiKey: string,
  text: string,
  voice: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer" = "onyx"
): Promise<Buffer> {
  const client = getOpenAIClient(apiKey);

  const cleanText = text.replace(/\[[^\]]*\]/g, "").replace(/\([^)]*\)/g, "").replace(/\s+/g, " ").trim();

  const response = await client.audio.speech.create({
    model: "tts-1-hd",
    voice,
    input: cleanText,
    speed: 0.9,
  });

  return Buffer.from(await response.arrayBuffer());
}

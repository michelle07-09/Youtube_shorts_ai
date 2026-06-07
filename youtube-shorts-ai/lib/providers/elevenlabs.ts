// lib/providers/elevenlabs.ts
import axios from "axios";

export async function generateTTSElevenLabs(
  apiKey: string,
  text: string,
  voiceId: string = "21m00Tcm4TlvDq8ikWAM" // Rachel - default voice
): Promise<Buffer> {
  const cleanText = text.replace(/\[[^\]]*\]/g, "").replace(/\([^)]*\)/g, "").replace(/\s+/g, " ").trim();

  const response = await axios.post(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      text: cleanText,
      model_id: "eleven_multilingual_v2",
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.3,
        use_speaker_boost: true,
      },
    },
    {
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      responseType: "arraybuffer",
    }
  );

  return Buffer.from(response.data);
}

export async function getVoices(apiKey: string): Promise<{ voice_id: string; name: string }[]> {
  const response = await axios.get("https://api.elevenlabs.io/v1/voices", {
    headers: { "xi-api-key": apiKey },
  });
  return response.data.voices;
}

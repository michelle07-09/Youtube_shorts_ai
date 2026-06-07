// lib/providers/youtube.ts
import { google } from "googleapis";
import fs from "fs";

/** Resolve YouTube OAuth redirect URI dynamically */
export function getRedirectUri(customRedirectUri?: string): string {
  if (customRedirectUri) return customRedirectUri;
  if (process.env.YOUTUBE_REDIRECT_URI) return process.env.YOUTUBE_REDIRECT_URI;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : "");
  if (appUrl) return `${appUrl}/api/auth/youtube/callback`;
  return "http://localhost:3000/api/auth/youtube/callback";
}

export function getYouTubeClient(clientId: string, clientSecret: string, refreshToken: string, customRedirectUri?: string) {
  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    getRedirectUri(customRedirectUri)
  );
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  return google.youtube({ version: "v3", auth: oauth2Client });
}

export function getAuthUrl(clientId: string, clientSecret: string, customRedirectUri?: string): string {
  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    getRedirectUri(customRedirectUri)
  );
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: [
      "https://www.googleapis.com/auth/youtube.upload",
      "https://www.googleapis.com/auth/youtube",        // needed for playlists
    ],
    prompt: "consent",
  });
}

export async function exchangeCodeForToken(
  clientId: string,
  clientSecret: string,
  code: string,
  customRedirectUri?: string
): Promise<string> {
  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    getRedirectUri(customRedirectUri)
  );
  const { tokens } = await oauth2Client.getToken(code);
  return tokens.refresh_token || "";
}

export async function uploadToYouTube(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
  videoFilePath: string,
  title: string,
  description: string,
  tags: string[] = [],
  visibility: "public" | "private" | "unlisted" = "public",
  playlistId?: string   // ← optional — add to playlist immediately after upload
): Promise<{ videoId: string; url: string }> {
  const youtube = getYouTubeClient(clientId, clientSecret, refreshToken);
  const fileStream = fs.createReadStream(videoFilePath);

  const response = await youtube.videos.insert({
    part: ["snippet", "status"],
    requestBody: {
      snippet: {
        title: title.substring(0, 100),
        description: `${description}\n\n#shorts`,
        tags: [...tags, "shorts"],
        categoryId: "24",
        defaultLanguage: "en",
      },
      status: {
        privacyStatus: visibility,
        selfDeclaredMadeForKids: false,
      },
    },
    media: {
      mimeType: "video/mp4",
      body: fileStream,
    },
  });

  const videoId = response.data.id || "";

  // Add to playlist if provided
  if (playlistId && videoId) {
    try {
      await addVideoToPlaylist(clientId, clientSecret, refreshToken, playlistId, videoId);
      console.log(`[YouTube] Added video ${videoId} to playlist ${playlistId}`);
    } catch (err) {
      console.warn("[YouTube] Failed to add to playlist:", err);
    }
  }

  return {
    videoId,
    url: `https://youtube.com/shorts/${videoId}`,
  };
}

/**
 * Create a YouTube playlist for a series.
 * Returns the playlist ID to store in the series config.
 */
export async function createYouTubePlaylist(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
  playlistName: string,
  description: string = "",
  visibility: "public" | "private" | "unlisted" = "public"
): Promise<{ playlistId: string; url: string }> {
  const youtube = getYouTubeClient(clientId, clientSecret, refreshToken);

  const response = await youtube.playlists.insert({
    part: ["snippet", "status"],
    requestBody: {
      snippet: {
        title: playlistName.substring(0, 150),
        description: description || `Auto-generated series: ${playlistName}`,
        defaultLanguage: "en",
      },
      status: {
        privacyStatus: visibility,
      },
    },
  });

  const playlistId = response.data.id || "";
  console.log(`[YouTube] ✅ Created playlist: "${playlistName}" → ${playlistId}`);

  return {
    playlistId,
    url: `https://www.youtube.com/playlist?list=${playlistId}`,
  };
}

/**
 * Add a video to a YouTube playlist.
 */
export async function addVideoToPlaylist(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
  playlistId: string,
  videoId: string
): Promise<void> {
  const youtube = getYouTubeClient(clientId, clientSecret, refreshToken);

  await youtube.playlistItems.insert({
    part: ["snippet"],
    requestBody: {
      snippet: {
        playlistId,
        resourceId: {
          kind: "youtube#video",
          videoId,
        },
      },
    },
  });
}

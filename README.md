# YouTube Shorts AI Pipeline 🎬⚡

A fully automated, AI-powered YouTube Shorts generation system. From a single story idea to a published YouTube Short — completely hands-free.

> [!IMPORTANT]
> **Repository Layout**: The Next.js source code is located inside the [`youtube-shorts-ai`](./youtube-shorts-ai) subdirectory.

## Pipeline Flow

```
Topic Idea
    ↓
🧠 Generate Script (GPT-4o)
    ↓
🖼️ Generate Images (DALL-E 3 / Flux)
    ↓
🎤 Generate Audio Narration (ElevenLabs / OpenAI TTS)
    ↓
🎬 Generate Videos (Kling / PixVerse)
    ↓
✍️ Generate Title Variations
    ↓
🎞️ Assemble Final Video (FFmpeg)
    ↓
📤 Upload to YouTube Shorts / Instagram / TikTok
```

---

## 🚀 Deploy to Railway (Recommended)

The easiest way to run this app is to deploy it to [Railway](https://railway.app) — no local setup needed.

### 1. Create a Railway Project
1. Go to [railway.app](https://railway.app) and sign in
2. Click **New Project → Deploy from GitHub Repo**
3. Select your `Youtube_shorts_ai` repo
4. **IMPORTANT STEP**: Go to your service **Settings** in Railway dashboard. Under **General → Root Directory**, change it to: `youtube-shorts-ai`. This ensures Railway builds the project from the subdirectory.
5. Railway will automatically detect the Dockerfile inside the `youtube-shorts-ai` folder and start building.

### 2. Attach Persistent Volumes
Since containers are ephemeral, you need persistent volumes to keep your database and generated files across deployments.
In your Railway service settings:
1. Go to **Settings → Volumes**
2. Add a volume:
   - Mount path: `/app/data` (for database files)
3. Add another volume:
   - Mount path: `/app/output` (for generated videos/images)

### 3. Set Environment Variables
Go to **Variables** tab and add your API keys (see `youtube-shorts-ai/.env.railway.example` for the full list):

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | ✅ Yes | GPT-4o script + DALL-E images + TTS |
| `ELEVENLABS_API_KEY` | Optional | Higher quality voiceover |
| `KLING_API_KEY` + `KLING_API_SECRET` | Optional | Kling video generation |
| `YOUTUBE_CLIENT_ID` + `YOUTUBE_CLIENT_SECRET` | Optional | YouTube auto-upload |

### 4. Generate a Public Domain
Railway auto-generates a public URL. Go to **Settings → Networking → Generate Domain**.

### 5. Update OAuth Redirect URIs
Once deployed, open the Settings panel in the web UI. It will automatically detect and show the exact redirect URIs based on your deployed domain:
* **YouTube**: `https://YOUR-DOMAIN.up.railway.app/api/auth/youtube/callback`
* **Instagram**: `https://YOUR-DOMAIN.up.railway.app/api/auth/instagram/callback`
* **TikTok**: `https://YOUR-DOMAIN.up.railway.app/api/auth/tiktok/callback`

---

## 💻 Local Development (Optional)

### 1. Install dependencies
```bash
cd youtube-shorts-ai
npm install
```

### 2. Install FFmpeg
- **Windows**: `winget install ffmpeg` or download from [ffmpeg.org](https://ffmpeg.org/download.html)
- **macOS**: `brew install ffmpeg`
- **Linux**: `apt install ffmpeg`

### 3. Run the dev server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

# YouTube Shorts AI Pipeline 🎬⚡

A fully automated, AI-powered YouTube Shorts generation system. From a single story idea to a published YouTube Short — completely hands-free.

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
📤 Upload to YouTube Shorts
```

---

## 🚀 Deploy to Railway (Recommended)

The easiest way to run this app is to deploy it to [Railway](https://railway.app) — no local setup needed.

### 1. Push to GitHub
```bash
git init && git add -A && git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/youtube-shorts-ai.git
git push -u origin main
```

### 2. Create a Railway Project
1. Go to [railway.app](https://railway.app) and sign in
2. Click **New Project → Deploy from GitHub Repo**
3. Select your `youtube-shorts-ai` repo
4. Railway will automatically detect the Dockerfile and start building

### 3. Attach Persistent Volumes
In your Railway service settings:
1. Go to **Settings → Volumes**
2. Add a volume:
   - Mount path: `/app/data` (for database files)
3. Add another volume:
   - Mount path: `/app/output` (for generated videos/images)

### 4. Set Environment Variables
Go to **Variables** tab and add your API keys (see `.env.railway.example` for the full list):

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | ✅ Yes | GPT-4o script + DALL-E images + TTS |
| `ELEVENLABS_API_KEY` | Optional | Higher quality voiceover |
| `KLING_API_KEY` + `KLING_API_SECRET` | Optional | Kling video generation |
| `YOUTUBE_CLIENT_ID` + `YOUTUBE_CLIENT_SECRET` | Optional | YouTube auto-upload |

### 5. Generate a Public Domain
Railway auto-generates a public URL like `https://youtube-shorts-ai-production-XXXX.up.railway.app`.
Go to **Settings → Networking → Generate Domain**.

### 6. Update YouTube OAuth (if using)
In [Google Cloud Console](https://console.cloud.google.com):
1. Go to your OAuth 2.0 credentials
2. Update the **Authorized redirect URI** to:
   ```
   https://YOUR-RAILWAY-DOMAIN.up.railway.app/api/auth/youtube/callback
   ```

### 7. You're Live! 🎉
Open your Railway URL in any browser and start generating YouTube Shorts.

---

## 💻 Local Development (Optional)

### 1. Install dependencies
```bash
npm install
```

### 2. Install FFmpeg
- **Windows**: `winget install ffmpeg` or download from [ffmpeg.org](https://ffmpeg.org/download.html)
- **macOS**: `brew install ffmpeg`
- **Linux**: `apt install ffmpeg`

### 3. Configure API Keys
Copy `.env.local` and fill in your keys, OR use the Settings panel in the UI.

### 4. Run the dev server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## API Keys Required

| Service | Required | Used For |
|---------|----------|----------|
| OpenAI | ✅ Yes | Script generation, images (DALL-E), TTS |
| ElevenLabs | Optional | Higher quality narration |
| FAL.ai | Optional | Flux image generation (better than DALL-E) |
| Kling AI | Optional | Image-to-video generation |
| PixVerse | Optional | Image-to-video (alternative) |
| Google Cloud | Optional | YouTube auto-upload |

## YouTube OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project
3. Enable **YouTube Data API v3**
4. Create **OAuth 2.0 credentials** (Web Application type)
5. Add authorized redirect URI:
   - Local: `http://localhost:3000/api/auth/youtube/callback`
   - Railway: `https://YOUR-DOMAIN.up.railway.app/api/auth/youtube/callback`
6. Copy Client ID + Secret to Settings (or Railway env vars)
7. Click **Connect YouTube Account** in Settings

## File Structure

```
youtube-shorts-ai/
├── app/
│   ├── page.tsx              # Dashboard
│   ├── pipeline/page.tsx     # Live pipeline runner
│   ├── settings/page.tsx     # API key configuration
│   ├── history/page.tsx      # Run history
│   ├── autopilot/page.tsx    # Autopilot / Series manager
│   └── api/
│       ├── pipeline/run/     # SSE pipeline orchestrator
│       ├── output/[...path]/ # File serving (volumes)
│       ├── topics/           # Topic CRUD
│       ├── runs/             # Run history
│       ├── settings/         # Settings CRUD
│       ├── upload-youtube/   # YouTube upload
│       ├── upload-multiplatform/ # Multi-platform upload
│       └── auth/             # OAuth flows (YouTube/Instagram/TikTok)
├── lib/
│   ├── db.ts                 # JSON database (uses DATA_DIR)
│   ├── series.ts             # Series management
│   ├── pipeline-orchestrator.ts
│   ├── autopilot.ts          # Autonomous episode engine
│   ├── scheduler.ts          # Cron-based scheduler
│   └── providers/
│       ├── openai.ts
│       ├── elevenlabs.ts
│       ├── fal.ts
│       ├── kling.ts
│       ├── pixverse.ts
│       ├── youtube.ts
│       ├── instagram.ts
│       └── tiktok.ts
├── data/                     # Auto-created database (or Railway volume)
├── public/output/            # Generated videos & images (or Railway volume)
├── Dockerfile                # Multi-stage production build
├── railway.json              # Railway deployment config
├── .env.local                # Local dev env vars
└── .env.railway.example      # Railway env var template
```

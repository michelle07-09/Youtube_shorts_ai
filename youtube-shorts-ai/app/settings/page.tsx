"use client";

// app/settings/page.tsx — Settings Panel
import { useState, useEffect } from "react";

interface Settings {
  openaiKey: string;
  elevenLabsKey: string;
  elevenLabsVoiceId: string;
  falKey: string;
  klingKey: string;
  klingSecret: string;
  pixverseKey: string;
  youtubeClientId: string;
  youtubeClientSecret: string;
  youtubeRefreshToken: string;
  imageProvider: "dalle3" | "flux";
  videoProvider: "kling" | "pixverse" | "runway";
  audioProvider: "elevenlabs" | "openai";
  channelName: string;
  channelStyle: string;
  videoDuration: string;
  language: string;
  autopilotEnabled: boolean;
  autopilotIntervalMinutes: string;
  autopilotMaxRunsPerDay: string;
  autopilotAutoUpload: boolean;
  autopilotVisibility: "public" | "private" | "unlisted";
  autopilotTopicPrompt: string;
  instagramAccessToken: string;
  instagramUserId: string;
  instagramAppId: string;
  instagramAppSecret: string;
  tiktokAccessToken: string;
  tiktokRefreshToken: string;
  tiktokClientKey: string;
  tiktokClientSecret: string;
}

function KeyStatus({ value }: { value: string; label: string }) {
  const isSet = value && value.length > 4;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        padding: "2px 8px",
        borderRadius: "12px",
        fontSize: "10px",
        fontWeight: 700,
        background: isSet ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.12)",
        color: isSet ? "var(--green)" : "var(--red)",
        marginLeft: "8px",
      }}
    >
      {isSet ? "✅ Configured" : "⚠️ Missing"}
    </span>
  );
}

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="glass pipeline-node" style={{ padding: "24px", marginBottom: "16px" }}>
      <h2 style={{ fontSize: "15px", fontWeight: 700, marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}>
        <span>{icon}</span> {title}
      </h2>
      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>{children}</div>
    </div>
  );
}

function Field({ label, hint, badge, children }: { label: string; hint?: string; badge?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "flex", alignItems: "center", fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
        {label}{badge}
      </label>
      {children}
      {hint && <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "5px" }}>{hint}</p>}
    </div>
  );
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    openaiKey: "", elevenLabsKey: "", elevenLabsVoiceId: "21m00Tcm4TlvDq8ikWAM",
    falKey: "", klingKey: "", klingSecret: "", pixverseKey: "",
    youtubeClientId: "", youtubeClientSecret: "", youtubeRefreshToken: "",
    imageProvider: "dalle3", videoProvider: "kling", audioProvider: "elevenlabs",
    channelName: "The Haunted Archives", channelStyle: "Dark Horror",
    videoDuration: "45", language: "English",
    autopilotEnabled: false, autopilotIntervalMinutes: "60", autopilotMaxRunsPerDay: "3",
    autopilotAutoUpload: false, autopilotVisibility: "private",
    autopilotTopicPrompt: "Generate fresh, high-retention YouTube Shorts topics that fit the channel style. Avoid duplicates.",
    instagramAccessToken: "", instagramUserId: "", instagramAppId: "", instagramAppSecret: "",
    tiktokAccessToken: "", tiktokRefreshToken: "", tiktokClientKey: "", tiktokClientSecret: "",
  });
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [origin, setOrigin] = useState("http://localhost:3000");

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => { setSettings(data); setLoading(false); });
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function save() {
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
        <div style={{ color: "var(--text-muted)", fontSize: "14px" }}>Loading settings...</div>
      </div>
    );
  }

  // Count configured keys
  const configuredCount = [
    settings.openaiKey, settings.elevenLabsKey, settings.klingKey,
    settings.pixverseKey, settings.youtubeClientId, settings.instagramAppId,
    settings.tiktokClientKey
  ].filter(Boolean).length;

  return (
    <div style={{ padding: "32px 24px", maxWidth: "800px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontFamily: "Outfit, sans-serif", fontSize: "28px", fontWeight: 800, background: "linear-gradient(135deg, #9c7aff, #00d4ff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            ⚙️ Settings
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginTop: "4px" }}>
            Configure API keys and channel preferences
          </p>
        </div>
        <button className="btn-primary" onClick={save} id="save-settings-btn" style={{ padding: "10px 28px" }}>
          {saved ? "✅ Saved!" : "💾 Save Settings"}
        </button>
      </div>

      {/* Status banner */}
      <div
        style={{
          padding: "14px 20px",
          borderRadius: "12px",
          background: configuredCount >= 5 ? "rgba(16,185,129,0.08)" : "rgba(108,71,255,0.08)",
          border: `1px solid ${configuredCount >= 5 ? "rgba(16,185,129,0.3)" : "rgba(108,71,255,0.3)"}`,
          marginBottom: "24px",
          display: "flex",
          alignItems: "center",
          gap: "12px",
        }}
      >
        <span style={{ fontSize: "24px" }}>{configuredCount >= 5 ? "🚀" : "🔧"}</span>
        <div>
          <div style={{ fontSize: "13px", fontWeight: 700, color: configuredCount >= 5 ? "var(--green)" : "var(--purple-light)" }}>
            {configuredCount >= 5
              ? "Core API keys configured — ready to run pipeline!"
              : `${configuredCount}/7 keys configured`}
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
            Keys loaded from environment — changes here are saved to local database as overrides.
          </div>
        </div>
      </div>

      {/* Channel Config */}
      <Section title="Channel Configuration" icon="📺">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
          <Field label="Channel Name">
            <input className="input" value={settings.channelName} onChange={(e) => update("channelName", e.target.value)} id="channel-name" />
          </Field>
          <Field label="Content Style">
            <input className="input" value={settings.channelStyle} onChange={(e) => update("channelStyle", e.target.value)} id="channel-style" />
          </Field>
          <Field label="Video Duration (seconds)">
            <input className="input" type="number" value={settings.videoDuration} onChange={(e) => update("videoDuration", e.target.value)} id="video-duration" />
          </Field>
          <Field label="Language">
            <select className="input" value={settings.language} onChange={(e) => update("language", e.target.value)} id="language-select">
              {["English", "Spanish", "French", "German", "Portuguese", "Indonesian"].map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </Field>
        </div>
      </Section>

      <Section title="Autopilot" icon="AUTO">
        <div
          style={{
            padding: "12px 16px",
            borderRadius: "10px",
            background: settings.autopilotEnabled ? "rgba(16,185,129,0.08)" : "rgba(108,71,255,0.08)",
            border: `1px solid ${settings.autopilotEnabled ? "rgba(16,185,129,0.25)" : "rgba(108,71,255,0.25)"}`,
            fontSize: "12px",
            color: "var(--text-secondary)",
          }}
        >
          {settings.autopilotEnabled
            ? "Autopilot is enabled. The dashboard starts and monitors the local scheduler."
            : "Autopilot is off. Turn it on here or from the dashboard when you are ready."}
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: "10px", color: "var(--text-secondary)", fontSize: "13px" }}>
          <input
            type="checkbox"
            checked={settings.autopilotEnabled}
            onChange={(e) => update("autopilotEnabled", e.target.checked)}
          />
          Enable autopilot scheduler
        </label>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "14px" }}>
          <Field label="Run Every (minutes)" hint="How often the scheduler checks whether it should create a new Short.">
            <input
              className="input"
              type="number"
              min="5"
              value={settings.autopilotIntervalMinutes}
              onChange={(e) => update("autopilotIntervalMinutes", e.target.value)}
            />
          </Field>
          <Field label="Max Runs Per Day" hint="Daily cost guardrail. Manual Run Once ignores this limit.">
            <input
              className="input"
              type="number"
              min="1"
              value={settings.autopilotMaxRunsPerDay}
              onChange={(e) => update("autopilotMaxRunsPerDay", e.target.value)}
            />
          </Field>
          <Field label="Upload Visibility">
            <select
              className="input"
              value={settings.autopilotVisibility}
              onChange={(e) => update("autopilotVisibility", e.target.value as Settings["autopilotVisibility"])}
            >
              <option value="private">Private</option>
              <option value="unlisted">Unlisted</option>
              <option value="public">Public</option>
            </select>
          </Field>
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: "10px", color: "var(--text-secondary)", fontSize: "13px" }}>
          <input
            type="checkbox"
            checked={settings.autopilotAutoUpload}
            onChange={(e) => update("autopilotAutoUpload", e.target.checked)}
          />
          Upload completed videos to YouTube automatically
        </label>

        <Field label="Topic Generator Brief" hint="This tells autopilot what kind of topics to invent when your queue is empty.">
          <textarea
            className="input"
            rows={4}
            value={settings.autopilotTopicPrompt}
            onChange={(e) => update("autopilotTopicPrompt", e.target.value)}
          />
        </Field>
      </Section>

      {/* AI Providers */}
      <Section title="AI Provider Selection" icon="🤖">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "14px" }}>
          <Field label="Image Provider">
            <select className="input" value={settings.imageProvider} onChange={(e) => update("imageProvider", e.target.value as "dalle3" | "flux")} id="image-provider">
              <option value="dalle3">DALL-E 3 (OpenAI)</option>
              <option value="flux">Flux (FAL.ai)</option>
            </select>
          </Field>
          <Field label="Video Provider">
            <select className="input" value={settings.videoProvider} onChange={(e) => update("videoProvider", e.target.value as "kling" | "pixverse" | "runway")} id="video-provider">
              <option value="kling">Kling AI</option>
              <option value="pixverse">PixVerse</option>
              <option value="runway">Runway ML</option>
            </select>
          </Field>
          <Field label="Audio Provider">
            <select className="input" value={settings.audioProvider} onChange={(e) => update("audioProvider", e.target.value as "elevenlabs" | "openai")} id="audio-provider">
              <option value="elevenlabs">ElevenLabs</option>
              <option value="openai">OpenAI TTS</option>
            </select>
          </Field>
        </div>
      </Section>

      {/* OpenAI */}
      <Section title="OpenAI" icon="🧠">
        <Field label="API Key" badge={<KeyStatus value={settings.openaiKey} label="OpenAI" />} hint="Required. GPT-4o script generation, DALL-E 3 images, OpenAI TTS.">
          <input className="input" type="password" value={settings.openaiKey} onChange={(e) => update("openaiKey", e.target.value)} placeholder="sk-proj-..." id="openai-key" />
        </Field>
      </Section>

      {/* ElevenLabs */}
      <Section title="ElevenLabs" icon="🎤">
        <Field label="API Key" badge={<KeyStatus value={settings.elevenLabsKey} label="ElevenLabs" />} hint="elevenlabs.io — premium voice narration">
          <input className="input" type="password" value={settings.elevenLabsKey} onChange={(e) => update("elevenLabsKey", e.target.value)} placeholder="sk_..." id="elevenlabs-key" />
        </Field>
        <Field label="Voice ID" hint="Default: Rachel. Browse voices at elevenlabs.io/voice-library">
          <input className="input" value={settings.elevenLabsVoiceId} onChange={(e) => update("elevenLabsVoiceId", e.target.value)} id="elevenlabs-voice-id" />
        </Field>
      </Section>

      {/* FAL.ai */}
      <Section title="FAL.ai (Flux Images)" icon="🖼️">
        <Field label="API Key" badge={<KeyStatus value={settings.falKey} label="FAL" />} hint="fal.ai — Flux image generation (better quality than DALL-E)">
          <input className="input" type="password" value={settings.falKey} onChange={(e) => update("falKey", e.target.value)} placeholder="fal_..." id="fal-key" />
        </Field>
      </Section>

      {/* Kling */}
      <Section title="Kling AI (Video)" icon="🎬">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
          <Field label="Access Key" badge={<KeyStatus value={settings.klingKey} label="Kling" />}>
            <input className="input" type="password" value={settings.klingKey} onChange={(e) => update("klingKey", e.target.value)} placeholder="AQ3F..." id="kling-key" />
          </Field>
          <Field label="Secret Key">
            <input className="input" type="password" value={settings.klingSecret} onChange={(e) => update("klingSecret", e.target.value)} placeholder="8nLM..." id="kling-secret" />
          </Field>
        </div>
      </Section>

      {/* PixVerse */}
      <Section title="PixVerse (Video Alternative)" icon="🎥">
        <Field label="API Key" badge={<KeyStatus value={settings.pixverseKey} label="PixVerse" />} hint="PixVerse developer dashboard — alternative video generation">
          <input className="input" type="password" value={settings.pixverseKey} onChange={(e) => update("pixverseKey", e.target.value)} placeholder="sk-..." id="pixverse-key" />
        </Field>
      </Section>

      {/* YouTube */}
      <Section title="YouTube / Google OAuth" icon="📺">
        <div
          style={{
            padding: "12px 16px", borderRadius: "10px",
            background: settings.youtubeClientId ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)",
            border: `1px solid ${settings.youtubeClientId ? "rgba(16,185,129,0.25)" : "rgba(239,68,68,0.2)"}`,
            fontSize: "12px", color: "var(--text-secondary)", marginBottom: "4px",
          }}
        >
          {settings.youtubeClientId
            ? "✅ Google OAuth credentials are configured."
            : `⚠️ Setup: Google Cloud Console → YouTube Data API v3 → OAuth 2.0 credentials → add redirect URI: ${origin}/api/auth/youtube/callback`}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
          <Field label="Client ID" badge={<KeyStatus value={settings.youtubeClientId} label="YT Client ID" />}>
            <input className="input" type="password" value={settings.youtubeClientId} onChange={(e) => update("youtubeClientId", e.target.value)} id="yt-client-id" />
          </Field>
          <Field label="Client Secret">
            <input className="input" type="password" value={settings.youtubeClientSecret} onChange={(e) => update("youtubeClientSecret", e.target.value)} id="yt-client-secret" />
          </Field>
        </div>
        <Field label="Refresh Token" badge={<KeyStatus value={settings.youtubeRefreshToken} label="YT Token" />} hint="Auto-filled after connecting your YouTube account below.">
          <input className="input" type="password" value={settings.youtubeRefreshToken} onChange={(e) => update("youtubeRefreshToken", e.target.value)} placeholder="Auto-filled after OAuth" id="yt-refresh-token" />
        </Field>
        <button
          className="btn-primary"
          style={{ background: "linear-gradient(135deg, #ef4444, #b91c1c)", width: "fit-content" }}
          onClick={() => { save(); setTimeout(() => window.open("/api/auth/youtube", "_blank", "width=600,height=700"), 500); }}
          id="connect-youtube-btn"
        >
          📺 Connect YouTube Account
        </button>
      </Section>

      {/* Instagram */}
      <Section title="Instagram Reels / Facebook Developer" icon="📸">
        <div
          style={{
            padding: "12px 16px", borderRadius: "10px",
            background: settings.instagramAppId ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)",
            border: `1px solid ${settings.instagramAppId ? "rgba(16,185,129,0.25)" : "rgba(239,68,68,0.2)"}`,
            fontSize: "12px", color: "var(--text-secondary)", marginBottom: "4px",
          }}
        >
          {settings.instagramAppId
            ? "✅ Instagram App credentials are configured."
            : `⚠️ Setup: Facebook Developer Console → Add Instagram Sharing Product → add redirect URI: ${origin}/api/auth/instagram/callback`}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
          <Field label="App ID" badge={<KeyStatus value={settings.instagramAppId} label="IG App ID" />}>
            <input className="input" type="password" value={settings.instagramAppId} onChange={(e) => update("instagramAppId", e.target.value)} id="ig-app-id" />
          </Field>
          <Field label="App Secret">
            <input className="input" type="password" value={settings.instagramAppSecret} onChange={(e) => update("instagramAppSecret", e.target.value)} id="ig-app-secret" />
          </Field>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
          <Field label="User ID (Instagram Business Account)" badge={<KeyStatus value={settings.instagramUserId} label="IG User ID" />} hint="Fetched automatically.">
            <input className="input" value={settings.instagramUserId} onChange={(e) => update("instagramUserId", e.target.value)} placeholder="Auto-filled after login" id="ig-user-id" />
          </Field>
          <Field label="Access Token" badge={<KeyStatus value={settings.instagramAccessToken} label="IG Token" />} hint="Long-lived page token.">
            <input className="input" type="password" value={settings.instagramAccessToken} onChange={(e) => update("instagramAccessToken", e.target.value)} placeholder="Auto-filled after login" id="ig-access-token" />
          </Field>
        </div>
        <button
          className="btn-primary"
          style={{ background: "linear-gradient(135deg, #d6249f, #285AEB)", width: "fit-content" }}
          onClick={() => { save(); setTimeout(() => window.open("/api/auth/instagram", "_blank", "width=600,height=700"), 500); }}
          id="connect-instagram-btn"
        >
          📸 Connect Instagram Account
        </button>
      </Section>

      {/* TikTok */}
      <Section title="TikTok Developer" icon="🎵">
        <div
          style={{
            padding: "12px 16px", borderRadius: "10px",
            background: settings.tiktokClientKey ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)",
            border: `1px solid ${settings.tiktokClientKey ? "rgba(16,185,129,0.25)" : "rgba(239,68,68,0.2)"}`,
            fontSize: "12px", color: "var(--text-secondary)", marginBottom: "4px",
          }}
        >
          {settings.tiktokClientKey
            ? "✅ TikTok Client Key is configured."
            : `⚠️ Setup: TikTok Developer Console → Video Kit product → add redirect URI: ${origin}/api/auth/tiktok/callback`}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
          <Field label="Client Key" badge={<KeyStatus value={settings.tiktokClientKey} label="TT Client Key" />}>
            <input className="input" type="password" value={settings.tiktokClientKey} onChange={(e) => update("tiktokClientKey", e.target.value)} id="tt-client-key" />
          </Field>
          <Field label="Client Secret">
            <input className="input" type="password" value={settings.tiktokClientSecret} onChange={(e) => update("tiktokClientSecret", e.target.value)} id="tt-client-secret" />
          </Field>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
          <Field label="Access Token" badge={<KeyStatus value={settings.tiktokAccessToken} label="TT Access" />}>
            <input className="input" type="password" value={settings.tiktokAccessToken} onChange={(e) => update("tiktokAccessToken", e.target.value)} placeholder="Auto-filled after login" id="tt-access-token" />
          </Field>
          <Field label="Refresh Token" badge={<KeyStatus value={settings.tiktokRefreshToken} label="TT Refresh" />}>
            <input className="input" type="password" value={settings.tiktokRefreshToken} onChange={(e) => update("tiktokRefreshToken", e.target.value)} placeholder="Auto-filled after login" id="tt-refresh-token" />
          </Field>
        </div>
        <button
          className="btn-primary"
          style={{ background: "linear-gradient(135deg, #00f2fe, #4facfe)", color: "#000", fontWeight: 700, width: "fit-content" }}
          onClick={() => { save(); setTimeout(() => window.open("/api/auth/tiktok", "_blank", "width=600,height=700"), 500); }}
          id="connect-tiktok-btn"
        >
          🎵 Connect TikTok Account
        </button>
      </Section>

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "8px" }}>
        <button className="btn-primary" onClick={save} id="save-settings-bottom-btn" style={{ padding: "12px 36px" }}>
          {saved ? "✅ Saved!" : "💾 Save All Settings"}
        </button>
      </div>
    </div>
  );
}

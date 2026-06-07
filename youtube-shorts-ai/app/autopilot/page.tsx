"use client";

// app/autopilot/page.tsx — Fully Autonomous Series Manager
import { useState, useEffect, useCallback } from "react";

interface Series {
  id: string;
  name: string;
  style: string;
  description: string;
  schedule: string;
  scheduleLabel: string;
  active: boolean;
  episodeCount: number;
  language: string;
  videoDuration: string;
  youtubeVisibility: string;
  youtubeHashtags: string;
  lastRunAt: string | null;
  nextRunAt: string | null;
  createdAt: string;
  characterSheet?: string;
  settingDescription?: string;
  platforms: {
    youtube: boolean;
    instagram: boolean;
    tiktok: boolean;
  };
  instagramCaption?: string;
  tiktokPrivacy?: "PUBLIC_TO_EVERYONE" | "MUTUAL_FOLLOW_FRIENDS" | "SELF_ONLY";
}

interface Episode {
  id: string;
  seriesId: string;
  seriesName: string;
  episodeNumber: number;
  topic: string;
  title: string;
  status: "running" | "done" | "failed";
  youtubeUrl?: string;
  instagramUrl?: string;
  tiktokPublishId?: string;
  thumbnailUrl?: string;
  createdAt: string;
}

const PRESETS = [
  { label: "Every day at 6:00 AM",  value: "0 6 * * *"  },
  { label: "Every day at 9:00 AM",  value: "0 9 * * *"  },
  { label: "Every day at 12:00 PM", value: "0 12 * * *" },
  { label: "Every day at 3:00 PM",  value: "0 15 * * *" },
  { label: "Every day at 6:00 PM",  value: "0 18 * * *" },
  { label: "Every day at 9:00 PM",  value: "0 21 * * *" },
  { label: "Every 12 hours",        value: "0 9,21 * * *" },
];

const STYLES = [
  "Dark Horror", "True Crime", "Ghost Stories", "Urban Legends",
  "Sci-Fi Thriller", "Supernatural", "Mystery", "Creepypasta",
  "Motivational", "Life Advice", "History Facts", "Fun Facts",
];

const EMPTY_FORM = {
  name: "", style: "Dark Horror", description: "", schedule: "0 9 * * *",
  scheduleLabel: "Every day at 9:00 AM", language: "English",
  videoDuration: "45", youtubeVisibility: "public",
  youtubeHashtags: "#shorts #horror #scarystories",
  platforms: { youtube: true, instagram: true, tiktok: true },
  instagramCaption: "",
  tiktokPrivacy: "SELF_ONLY" as "PUBLIC_TO_EVERYONE" | "MUTUAL_FOLLOW_FRIENDS" | "SELF_ONLY",
};

export default function AutopilotPage() {
  const [series, setSeries]           = useState<Series[]>([]);
  const [episodes, setEpisodes]       = useState<Episode[]>([]);
  const [showCreate, setShowCreate]   = useState(false);
  const [selectedSeries, setSelectedSeries] = useState<Series | null>(null);
  const [form, setForm]               = useState(EMPTY_FORM);
  const [runningIds, setRunningIds]   = useState<string[]>([]);
  const [toast, setToast]             = useState<string | null>(null);
  const [schedulerJobs, setSchedulerJobs] = useState<string[]>([]);

  const load = useCallback(async () => {
    const [serRes, epRes, schedRes] = await Promise.all([
      fetch("/api/series").then((r) => r.json()),
      fetch("/api/autopilot").then((r) => r.json()),
      fetch("/api/scheduler/init").then((r) => r.json()),
    ]);
    setSeries(serRes.series || []);
    setEpisodes(epRes.episodes || []);
    setRunningIds(epRes.running || []);
    setSchedulerJobs(schedRes.activeJobs || []);
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 8000);
    return () => clearInterval(interval);
  }, [load]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 5000);
  }

  async function createSeries(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    await fetch("/api/series", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setForm(EMPTY_FORM);
    setShowCreate(false);
    load();
    showToast(`✅ Series "${form.name}" created! It will automatically post ${form.scheduleLabel.toLowerCase()}.`);
  }

  async function toggleSeries(s: Series) {
    await fetch("/api/series", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: s.id, active: !s.active }),
    });
    load();
  }

  async function deleteSeries(id: string) {
    if (!confirm("Delete this series and all its episodes?")) return;
    await fetch("/api/series", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (selectedSeries?.id === id) setSelectedSeries(null);
    load();
  }

  async function triggerNow(seriesId: string) {
    const res = await fetch("/api/autopilot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seriesId }),
    });
    const data = await res.json();
    showToast(data.message || "Pipeline started!");
    // Optimistically add to running
    setRunningIds((prev) => [...prev, seriesId]);
    // Reload after 3s to get real state
    setTimeout(load, 3000);
  }

  function formatNext(iso: string | null) {
    if (!iso) return "—";
    const d   = new Date(iso);
    const diff = d.getTime() - Date.now();
    if (diff < 0) return "Running soon...";
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return h > 0 ? `in ${h}h ${m}m` : `in ${m}m`;
  }

  const seriesEpisodes = selectedSeries
    ? episodes.filter((e) => e.seriesId === selectedSeries.id)
    : [];

  return (
    <div style={{ padding: "32px 24px", maxWidth: "1400px", margin: "0 auto" }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: "24px", left: "50%", transform: "translateX(-50%)",
          zIndex: 999, background: "var(--bg-card)", border: "1px solid var(--purple)",
          borderRadius: "12px", padding: "14px 24px", fontSize: "14px", fontWeight: 600,
          boxShadow: "0 8px 32px rgba(108,71,255,0.3)", maxWidth: "600px", textAlign: "center",
          animation: "slide-in 0.3s ease",
        }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "32px" }}>
        <div>
          <h1 style={{ fontFamily: "Outfit, sans-serif", fontSize: "32px", fontWeight: 800, background: "linear-gradient(135deg, #9c7aff, #00d4ff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            🤖 Autopilot Mode
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginTop: "6px" }}>
            Create a series → AI generates & cross-posts a new episode to YouTube, Instagram and TikTok automatically
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 16px", borderRadius: "20px", background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)" }}>
            <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--green)", boxShadow: "0 0 8px var(--green)" }} />
            <span style={{ fontSize: "12px", color: "var(--green)", fontWeight: 600 }}>
              {schedulerJobs.length} Series Active
            </span>
          </div>
          <button className="btn-primary" onClick={() => setShowCreate(true)} id="create-series-btn" style={{ padding: "10px 24px" }}>
            + New Series
          </button>
        </div>
      </div>

      {/* Empty state */}
      {series.length === 0 && !showCreate && (
        <div className="glass-purple" style={{ padding: "40px", borderRadius: "20px", textAlign: "center", marginBottom: "32px" }}>
          <div style={{ fontSize: "64px", marginBottom: "16px" }}>🤖</div>
          <h2 style={{ fontSize: "24px", fontWeight: 800, marginBottom: "12px" }}>Fully Autonomous Multi-Platform Channels</h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "15px", maxWidth: "600px", margin: "0 auto 24px" }}>
            You set the series name and style once. The AI generates a new unique episode, creates the video, and automatically uploads to YouTube Shorts, Instagram Reels, and TikTok — all on the same schedule.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", maxWidth: "700px", margin: "0 auto 32px" }}>
            {[
              { icon: "📝", label: "You name the series" },
              { icon: "🤖", label: "AI picks today's topic" },
              { icon: "🎬", label: "Full video generated" },
              { icon: "📤", label: "Cross-posted daily" },
            ].map((s) => (
              <div key={s.label} style={{ padding: "16px", borderRadius: "12px", background: "rgba(108,71,255,0.08)", border: "1px solid rgba(108,71,255,0.2)" }}>
                <div style={{ fontSize: "28px", marginBottom: "8px" }}>{s.icon}</div>
                <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)" }}>{s.label}</div>
              </div>
            ))}
          </div>
          <button className="btn-primary" onClick={() => setShowCreate(true)} id="create-first-series-btn" style={{ padding: "14px 40px", fontSize: "16px" }}>
            🚀 Create My First Series
          </button>
        </div>
      )}

      {/* ── Create Series Modal ── */}
      {showCreate && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowCreate(false); }}
        >
          <div
            className="glass"
            style={{ width: "100%", maxWidth: "640px", borderRadius: "20px", border: "1px solid rgba(108,71,255,0.3)", display: "flex", flexDirection: "column", maxHeight: "90vh" }}
          >
            {/* Modal header — fixed */}
            <div style={{ padding: "24px 28px 16px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h2 style={{ fontSize: "20px", fontWeight: 800 }}>🎬 Create New Series</h2>
                <button onClick={() => setShowCreate(false)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "24px", lineHeight: 1 }}>×</button>
              </div>
            </div>

            {/* Modal body — scrollable */}
            <div style={{ overflowY: "auto", padding: "20px 28px", flex: 1 }}>
              <form id="create-series-form" onSubmit={createSeries} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: "6px" }}>
                    Series Name *
                  </label>
                  <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder='e.g. "The Haunted Archives"' required id="series-name-input" />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                  <div>
                    <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: "6px" }}>Content Style</label>
                    <select className="input" value={form.style} onChange={(e) => setForm({ ...form, style: e.target.value })} id="series-style">
                      {STYLES.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: "6px" }}>Upload Schedule</label>
                    <select className="input" value={form.schedule} onChange={(e) => { const p = PRESETS.find((p) => p.value === e.target.value); setForm({ ...form, schedule: e.target.value, scheduleLabel: p?.label || e.target.value }); }} id="series-schedule">
                      {PRESETS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: "6px" }}>Video Duration (sec)</label>
                    <input className="input" type="number" value={form.videoDuration} onChange={(e) => setForm({ ...form, videoDuration: e.target.value })} min="15" max="60" id="series-duration" />
                  </div>
                  <div>
                    <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: "6px" }}>Language</label>
                    <select className="input" value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })} id="series-language">
                      {["English", "Indonesian", "Spanish", "French", "Portuguese"].map((l) => <option key={l}>{l}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: "6px" }}>YouTube Visibility</label>
                    <select className="input" value={form.youtubeVisibility} onChange={(e) => setForm({ ...form, youtubeVisibility: e.target.value })} id="series-visibility">
                      <option value="public">Public</option>
                      <option value="unlisted">Unlisted</option>
                      <option value="private">Private</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: "6px" }}>Hashtags</label>
                    <input className="input" value={form.youtubeHashtags} onChange={(e) => setForm({ ...form, youtubeHashtags: e.target.value })} id="series-hashtags" />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: "6px" }}>Series Description (optional)</label>
                  <textarea className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} id="series-description" style={{ resize: "vertical" }} placeholder="Used in video descriptions" />
                </div>

                {/* Platforms target section */}
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "4px" }}>
                  <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Target Platforms</label>
                  <div style={{ display: "flex", gap: "20px" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "var(--text-secondary)", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={form.platforms.youtube}
                        onChange={(e) => setForm({ ...form, platforms: { ...form.platforms, youtube: e.target.checked } })}
                      />
                      🔴 YouTube
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "var(--text-secondary)", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={form.platforms.instagram}
                        onChange={(e) => setForm({ ...form, platforms: { ...form.platforms, instagram: e.target.checked } })}
                      />
                      📸 Instagram
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "var(--text-secondary)", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={form.platforms.tiktok}
                        onChange={(e) => setForm({ ...form, platforms: { ...form.platforms, tiktok: e.target.checked } })}
                      />
                      🎵 TikTok
                    </label>
                  </div>
                </div>

                {form.platforms.instagram && (
                  <div>
                    <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: "6px" }}>Instagram Caption Template</label>
                    <input className="input" value={form.instagramCaption} onChange={(e) => setForm({ ...form, instagramCaption: e.target.value })} placeholder="Optional. e.g. {title} - Episode {episode}" id="instagram-caption-template" />
                  </div>
                )}

                {form.platforms.tiktok && (
                  <div>
                    <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: "6px" }}>TikTok Privacy Level</label>
                    <select className="input" value={form.tiktokPrivacy} onChange={(e) => setForm({ ...form, tiktokPrivacy: e.target.value as any })} id="tiktok-privacy-level">
                      <option value="SELF_ONLY">Private (Self Only - Draft)</option>
                      <option value="MUTUAL_FOLLOW_FRIENDS">Friends Only</option>
                      <option value="PUBLIC_TO_EVERYONE">Public</option>
                    </select>
                  </div>
                )}

                <div style={{ padding: "12px 16px", borderRadius: "10px", background: "rgba(108,71,255,0.08)", border: "1px solid rgba(108,71,255,0.2)", fontSize: "12px", color: "var(--text-secondary)" }}>
                  📅 <strong>{form.scheduleLabel}</strong> — AI will automatically publish episodes on selected platforms.
                </div>
              </form>
            </div>

            {/* Modal footer — fixed */}
            <div style={{ padding: "16px 28px 24px", borderTop: "1px solid var(--border)", display: "flex", gap: "10px", justifyContent: "flex-end", flexShrink: 0 }}>
              <button type="button" className="btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
              <button type="submit" form="create-series-form" className="btn-primary" id="confirm-create-series-btn">
                🚀 Create Series
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Series Grid ── */}
      {series.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: selectedSeries ? "320px 1fr" : "repeat(auto-fill, minmax(320px, 1fr))", gap: "20px", alignItems: "start" }}>

          {/* Series Cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {series.map((s) => {
              const isRunning = runningIds.includes(s.id);
              return (
                <div
                  key={s.id}
                  className={`glass pipeline-node ${s.id === selectedSeries?.id ? "active" : ""}`}
                  style={{ padding: "20px", cursor: "pointer" }}
                  onClick={() => setSelectedSeries(s.id === selectedSeries?.id ? null : s)}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "15px", fontWeight: 700, marginBottom: "3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</div>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{s.style} · {s.scheduleLabel}</div>
                      
                      {/* Platform Indicators */}
                      <div style={{ display: "flex", gap: "6px", marginTop: "6px", alignItems: "center" }}>
                        <span style={{ fontSize: "10px", color: "var(--text-secondary)" }}>Publish:</span>
                        {s.platforms?.youtube && <span title="YouTube Shorts">🔴</span>}
                        {s.platforms?.instagram && <span title="Instagram Reels">📸</span>}
                        {s.platforms?.tiktok && <span title="TikTok">🎵</span>}
                      </div>
                    </div>
                    {/* Toggle switch */}
                    <div
                      style={{ width: "36px", height: "20px", borderRadius: "10px", background: s.active ? "var(--purple)" : "rgba(255,255,255,0.1)", cursor: "pointer", position: "relative", flexShrink: 0, transition: "background 0.2s", marginLeft: "12px" }}
                      onClick={(e) => { e.stopPropagation(); toggleSeries(s); }}
                    >
                      <div style={{ position: "absolute", top: "2px", left: s.active ? "18px" : "2px", width: "16px", height: "16px", borderRadius: "50%", background: "white", transition: "left 0.2s", boxShadow: "0 1px 4px rgba(0,0,0,0.3)" }} />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px", marginBottom: "12px" }}>
                    {[
                      { label: "Episodes", value: s.episodeCount },
                      { label: "Next Run",  value: isRunning ? "⚙️ Now!" : formatNext(s.nextRunAt) },
                      { label: "Status",    value: isRunning ? "🔄 Running" : s.active ? "🟢 Active" : "⏸ Paused" },
                    ].map((stat) => (
                      <div key={stat.label} style={{ padding: "8px 6px", borderRadius: "8px", background: "var(--bg-secondary)", textAlign: "center" }}>
                        <div style={{ fontSize: "13px", fontWeight: 700, color: isRunning && stat.label === "Status" ? "var(--cyan)" : "var(--text-primary)" }}>{stat.value}</div>
                        <div style={{ fontSize: "9px", color: "var(--text-muted)", marginTop: "2px" }}>{stat.label}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      className="btn-primary"
                      style={{ flex: 1, justifyContent: "center", fontSize: "12px", padding: "8px", opacity: isRunning ? 0.7 : 1 }}
                      onClick={(e) => { e.stopPropagation(); if (!isRunning) triggerNow(s.id); }}
                      disabled={isRunning}
                      id={`run-now-${s.id}`}
                    >
                      {isRunning ? "⚙️ Generating..." : "▶ Run Now"}
                    </button>
                    <button
                      className="btn-danger"
                      style={{ flexShrink: 0 }}
                      onClick={(e) => { e.stopPropagation(); deleteSeries(s.id); }}
                      id={`delete-series-${s.id}`}
                    >
                      🗑
                    </button>
                  </div>
                </div>
              );
            })}

            <button className="btn-secondary" onClick={() => setShowCreate(true)} id="add-another-series-btn" style={{ padding: "12px" }}>
              + Add Another Series
            </button>
          </div>

          {/* ── Episode History Panel ── */}
          {selectedSeries && (
            <div className="glass pipeline-node" style={{ padding: "24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px", gap: "12px" }}>
                <div>
                  <h3 style={{ fontSize: "18px", fontWeight: 700 }}>{selectedSeries.name}</h3>
                  <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
                    {seriesEpisodes.length} episodes · {selectedSeries.scheduleLabel}
                  </p>
                </div>
                <button
                  className="btn-primary"
                  onClick={() => { if (!runningIds.includes(selectedSeries.id)) triggerNow(selectedSeries.id); }}
                  disabled={runningIds.includes(selectedSeries.id)}
                  id="trigger-selected-series"
                  style={{ flexShrink: 0 }}
                >
                  {runningIds.includes(selectedSeries.id) ? "⚙️ Generating..." : "▶ Generate Episode Now"}
                </button>
              </div>

              {/* Running indicator */}
              {runningIds.includes(selectedSeries.id) && (
                <div style={{ padding: "12px 16px", borderRadius: "10px", background: "rgba(108,71,255,0.1)", border: "1px solid rgba(108,71,255,0.3)", marginBottom: "16px", display: "flex", alignItems: "center", gap: "10px" }}>
                  <span className="animate-spin-slow" style={{ display: "inline-block", fontSize: "18px" }}>⚙️</span>
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--purple-light)" }}>Pipeline running...</div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Generating script, images, audio & video. Takes 3-10 minutes. This page auto-refreshes.</div>
                  </div>
                </div>
              )}

              {/* Next run */}
              {selectedSeries.nextRunAt && !runningIds.includes(selectedSeries.id) && (
                <div style={{ padding: "12px 16px", borderRadius: "10px", background: "rgba(108,71,255,0.06)", border: "1px solid rgba(108,71,255,0.15)", marginBottom: "16px", display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "18px" }}>⏰</span>
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: 600 }}>Next auto-upload: {formatNext(selectedSeries.nextRunAt)}</div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{new Date(selectedSeries.nextRunAt).toLocaleString()}</div>
                  </div>
                </div>
              )}

              {/* Episodes list */}
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "480px", overflowY: "auto" }}>
                {seriesEpisodes.length === 0 && !runningIds.includes(selectedSeries.id) && (
                  <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
                    <div style={{ fontSize: "36px", marginBottom: "8px" }}>🎬</div>
                    <div style={{ fontWeight: 600 }}>No episodes yet.</div>
                    <div style={{ fontSize: "12px", marginTop: "6px" }}>Click "Generate Episode Now" or wait for the scheduled time.</div>
                  </div>
                )}
                {seriesEpisodes.map((ep) => (
                  <div
                    key={ep.id}
                    style={{
                      display: "flex", gap: "12px", padding: "14px",
                      background: "var(--bg-secondary)", borderRadius: "10px",
                      border: `1px solid ${ep.status === "done" ? "rgba(16,185,129,0.2)" : ep.status === "failed" ? "rgba(239,68,68,0.2)" : "rgba(108,71,255,0.2)"}`,
                      animation: "slide-in 0.3s ease",
                    }}
                  >
                    {ep.thumbnailUrl && (
                      <img src={ep.thumbnailUrl} alt="" style={{ width: "36px", height: "64px", objectFit: "cover", borderRadius: "6px", flexShrink: 0 }} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                        <span style={{ fontSize: "10px", fontWeight: 700, color: "var(--text-muted)", background: "var(--bg-card)", padding: "2px 7px", borderRadius: "4px" }}>EP {ep.episodeNumber}</span>
                        <span className={`badge badge-${ep.status}`}>{ep.status}</span>
                      </div>
                      <div style={{ fontSize: "13px", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ep.title || ep.topic}</div>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>{new Date(ep.createdAt).toLocaleString()}</div>
                    </div>
                    <div style={{ display: "flex", gap: "10px", alignItems: "center", alignSelf: "center" }}>
                      {ep.youtubeUrl && (
                        <a href={ep.youtubeUrl} target="_blank" rel="noreferrer" title="YouTube Short" style={{ color: "#ff4444", fontSize: "18px", textDecoration: "none" }}>🔴</a>
                      )}
                      {ep.instagramUrl && (
                        <a href={ep.instagramUrl} target="_blank" rel="noreferrer" title="Instagram Reel" style={{ color: "#d6249f", fontSize: "18px", textDecoration: "none" }}>📸</a>
                      )}
                      {ep.tiktokPublishId && (
                        <span title={`TikTok Upload (Publish ID: ${ep.tiktokPublishId})`} style={{ color: "#00f2fe", fontSize: "18px", cursor: "help" }}>🎵</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

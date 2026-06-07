"use client";

// app/page.tsx — Main Dashboard
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Topic {
  id: string;
  text: string;
  status: "pending" | "running" | "done" | "failed";
  createdAt: string;
}

interface Run {
  id: string;
  topic: string;
  status: "running" | "done" | "failed";
  createdAt: string;
  result?: { title: string; videoUrl?: string; youtubeUrl?: string; thumbnailUrl?: string };
}

interface AutopilotStatus {
  enabled: boolean;
  schedulerActive: boolean;
  running: boolean;
  intervalMinutes: number;
  maxRunsPerDay: number;
  autoUpload: boolean;
  canGenerate: boolean;
  canUpload: boolean;
  state: {
    runsToday: number;
    currentTopic?: string;
    currentRunId?: string;
    lastRunAt?: string;
    nextRunAt?: string;
    lastHeartbeatAt?: string;
    lastMessage?: string;
    lastError?: string;
  };
}

const PIPELINE_STAGES = [
  { id: "script",   icon: "🧠", label: "Script",        desc: "GPT-4o story generation" },
  { id: "images",   icon: "🖼️",  label: "Images",        desc: "AI scene images" },
  { id: "audio",    icon: "🎤",  label: "Audio",         desc: "TTS narration" },
  { id: "videos",   icon: "🎬",  label: "Videos",        desc: "AI video generation" },
  { id: "titles",   icon: "✍️",  label: "Titles",        desc: "Title variations" },
  { id: "assemble", icon: "🎞️",  label: "Assemble",      desc: "Final video merge" },
  { id: "save",     icon: "💾",  label: "Save",          desc: "Store results" },
  { id: "upload",   icon: "📤",  label: "YouTube",       desc: "Auto-upload Shorts" },
];

export default function Dashboard() {
  const router = useRouter();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [newTopic, setNewTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ total: 0, done: 0, failed: 0, running: 0 });
  const [autopilot, setAutopilot] = useState<AutopilotStatus | null>(null);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  async function loadData() {
    const [topicsRes, runsRes, autopilotRes] = await Promise.all([
      fetch("/api/topics").then((r) => r.json()),
      fetch("/api/runs").then((r) => r.json()),
      fetch("/api/autopilot").then((r) => r.json()),
    ]);
    setTopics(topicsRes);
    setRuns(runsRes);
    setAutopilot(autopilotRes);
    setStats({
      total: runsRes.length,
      done: runsRes.filter((r: Run) => r.status === "done").length,
      failed: runsRes.filter((r: Run) => r.status === "failed").length,
      running: runsRes.filter((r: Run) => r.status === "running").length,
    });
  }

  async function addTopic(e: React.FormEvent) {
    e.preventDefault();
    if (!newTopic.trim()) return;
    await fetch("/api/topics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: newTopic.trim() }),
    });
    setNewTopic("");
    loadData();
  }

  async function deleteTopic(id: string) {
    await fetch("/api/topics", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    loadData();
  }

  function runTopic(topic: Topic) {
    router.push(`/pipeline?topicId=${topic.id}&topic=${encodeURIComponent(topic.text)}`);
  }

  function runCustom() {
    if (!newTopic.trim()) return;
    router.push(`/pipeline?topic=${encodeURIComponent(newTopic.trim())}`);
  }

  async function autopilotAction(action: "start" | "stop" | "run-now") {
    setLoading(true);
    const next = await fetch("/api/autopilot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    }).then((r) => r.json());
    setAutopilot(next);
    setLoading(false);
    loadData();
  }

  function formatTime(value?: string) {
    return value ? new Date(value).toLocaleString() : "Not yet";
  }

  return (
    <div style={{ padding: "32px 24px", maxWidth: "1400px", margin: "0 auto" }}>
      {/* ── Hero ── */}
      <div style={{ textAlign: "center", marginBottom: "48px" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "6px 16px",
            borderRadius: "20px",
            background: "rgba(108,71,255,0.1)",
            border: "1px solid rgba(108,71,255,0.3)",
            marginBottom: "20px",
            fontSize: "12px",
            color: "var(--purple-light)",
            fontWeight: 600,
            letterSpacing: "1px",
            textTransform: "uppercase",
          }}
        >
          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--green)", display: "inline-block" }} />
          Fully Automated AI Pipeline
        </div>
        <h1
          style={{
            fontFamily: "Outfit, sans-serif",
            fontSize: "clamp(32px, 5vw, 60px)",
            fontWeight: 800,
            lineHeight: 1.1,
            marginBottom: "16px",
          }}
        >
          <span style={{ background: "linear-gradient(135deg, #9c7aff, #00d4ff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            YouTube Shorts
          </span>
          <br />
          <span style={{ color: "var(--text-primary)" }}>AI Factory</span>
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "16px", maxWidth: "500px", margin: "0 auto" }}>
          Generate complete YouTube Shorts automatically — from story idea to published video with AI.
        </p>
      </div>

      {/* ── Stats ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "32px" }}>
        {[
          { label: "Total Runs", value: stats.total, color: "var(--purple-light)", icon: "⚡" },
          { label: "Completed", value: stats.done, color: "var(--green)", icon: "✅" },
          { label: "Running", value: stats.running, color: "var(--cyan)", icon: "⚙️" },
          { label: "Failed", value: stats.failed, color: "var(--red)", icon: "❌" },
        ].map((s) => (
          <div key={s.label} className="glass pipeline-node" style={{ padding: "20px", textAlign: "center" }}>
            <div style={{ fontSize: "24px", marginBottom: "8px" }}>{s.icon}</div>
            <div style={{ fontSize: "32px", fontWeight: 800, color: s.color, fontFamily: "Outfit, sans-serif" }}>
              {s.value}
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Pipeline Overview ── */}
      <div
        className={`pipeline-node ${autopilot?.running ? "active" : autopilot?.enabled ? "done" : ""}`}
        style={{ padding: "24px", marginBottom: "32px" }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "20px" }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
              <h2 style={{ fontSize: "18px", fontWeight: 800 }}>Autopilot</h2>
              <span className={`badge ${autopilot?.running ? "badge-running" : autopilot?.enabled ? "badge-done" : "badge-pending"}`}>
                {autopilot?.running ? "running" : autopilot?.enabled ? "active" : "off"}
              </span>
              {autopilot?.schedulerActive && <span className="badge badge-running">scheduler live</span>}
            </div>
            <p style={{ color: "var(--text-secondary)", fontSize: "13px", marginBottom: "14px" }}>
              {autopilot?.state?.lastMessage || "Go to 🤖 Autopilot to create a series and schedule daily uploads."}
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "10px" }}>
              {[
                { label: "Runs Today",   value: `${autopilot?.state?.runsToday ?? 0}/${autopilot?.maxRunsPerDay ?? 0}` },
                { label: "Next Run",     value: formatTime(autopilot?.state?.nextRunAt) },
                { label: "Heartbeat",    value: formatTime(autopilot?.state?.lastHeartbeatAt) },
                { label: "Auto Upload",  value: autopilot?.autoUpload ? (autopilot.canUpload ? "Ready" : "Needs YouTube") : "Off" },
              ].map((item) => (
                <div key={item.label} style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: "8px", padding: "10px" }}>
                  <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>{item.label}</div>
                  <div style={{ fontSize: "12px", color: "var(--text-primary)", marginTop: "4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.value}
                  </div>
                </div>
              ))}
            </div>

            {autopilot?.state?.currentTopic && (
              <div style={{ marginTop: "12px", fontSize: "12px", color: "var(--cyan)" }}>
                Current topic: {autopilot.state.currentTopic}
              </div>
            )}
            {autopilot?.state?.lastError && (
              <div style={{ marginTop: "12px", fontSize: "12px", color: "var(--red)" }}>
                Last error: {autopilot.state.lastError}
              </div>
            )}
            {!autopilot?.canGenerate && (
              <div style={{ marginTop: "12px", fontSize: "12px", color: "var(--yellow)" }}>
                Add an OpenAI key in Settings before autopilot can generate content.
              </div>
            )}

          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px", minWidth: "170px" }}>
            {autopilot?.enabled ? (
              <button className="btn-danger" onClick={() => autopilotAction("stop")} disabled={loading}>
                Stop Autopilot
              </button>
            ) : (
              <button className="btn-primary" onClick={() => autopilotAction("start")} disabled={loading || !autopilot?.canGenerate}>
                Start Autopilot
              </button>
            )}
            <button className="btn-secondary" onClick={() => autopilotAction("run-now")} disabled={loading || autopilot?.running || !autopilot?.canGenerate}>
              Run Once Now
            </button>
            <a href="/settings" className="btn-secondary" style={{ textDecoration: "none", textAlign: "center" }}>
              Autopilot Settings
            </a>
          </div>
        </div>
      </div>

      <div className="glass pipeline-node" style={{ padding: "24px", marginBottom: "32px" }}>
        <h2 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "20px", color: "var(--text-secondary)" }}>
          🔄 Pipeline Stages
        </h2>
        <div style={{ display: "flex", alignItems: "center", gap: "0", overflowX: "auto", paddingBottom: "8px" }}>
          {PIPELINE_STAGES.map((stage, i) => (
            <div key={stage.id} style={{ display: "flex", alignItems: "center" }}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "6px",
                  minWidth: "90px",
                  padding: "12px 8px",
                  borderRadius: "10px",
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border)",
                  cursor: "default",
                }}
              >
                <div style={{ fontSize: "20px" }}>{stage.icon}</div>
                <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-primary)" }}>{stage.label}</div>
                <div style={{ fontSize: "9px", color: "var(--text-muted)", textAlign: "center" }}>{stage.desc}</div>
              </div>
              {i < PIPELINE_STAGES.length - 1 && (
                <div
                  style={{
                    width: "24px",
                    height: "2px",
                    background: "linear-gradient(90deg, var(--border), var(--purple))",
                    flexShrink: 0,
                  }}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
        {/* ── Topic Queue ── */}
        <div className="glass pipeline-node" style={{ padding: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
            <h2 style={{ fontSize: "16px", fontWeight: 700 }}>📋 Topic Queue</h2>
            <span className="badge badge-pending">{topics.filter((t) => t.status === "pending").length} pending</span>
          </div>

          <form onSubmit={addTopic} style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
            <input
              className="input"
              value={newTopic}
              onChange={(e) => setNewTopic(e.target.value)}
              placeholder='e.g. "Scary story in abandoned hospital"'
              id="topic-input"
            />
            <button type="submit" className="btn-primary" style={{ flexShrink: 0 }} id="add-topic-btn">
              + Add
            </button>
          </form>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "340px", overflowY: "auto" }}>
            {topics.length === 0 && (
              <div style={{ textAlign: "center", padding: "32px", color: "var(--text-muted)", fontSize: "13px" }}>
                No topics yet. Add your first story idea above!
              </div>
            )}
            {topics.map((topic) => (
              <div
                key={topic.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "12px 14px",
                  background: "var(--bg-secondary)",
                  borderRadius: "10px",
                  border: "1px solid var(--border)",
                  transition: "border-color 0.2s",
                }}
                className="animate-slide-in"
              >
                <div style={{ flex: 1, fontSize: "13px", fontWeight: 500 }}>{topic.text}</div>
                <span className={`badge badge-${topic.status}`}>{topic.status}</span>
                <button
                  className="btn-primary"
                  style={{ padding: "5px 12px", fontSize: "11px" }}
                  onClick={() => runTopic(topic)}
                  disabled={topic.status === "running"}
                  id={`run-${topic.id}`}
                >
                  ▶ Run
                </button>
                <button
                  className="btn-danger"
                  onClick={() => deleteTopic(topic.id)}
                  id={`delete-${topic.id}`}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          {newTopic.trim() && (
            <button
              className="btn-primary"
              onClick={runCustom}
              style={{ width: "100%", marginTop: "16px", justifyContent: "center" }}
              id="run-custom-btn"
            >
              ⚡ Run Custom Topic Now
            </button>
          )}
        </div>

        {/* ── Recent Runs ── */}
        <div className="glass pipeline-node" style={{ padding: "24px" }}>
          <h2 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "20px" }}>🕒 Recent Runs</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "420px", overflowY: "auto" }}>
            {runs.length === 0 && (
              <div style={{ textAlign: "center", padding: "32px", color: "var(--text-muted)", fontSize: "13px" }}>
                No runs yet. Start your first pipeline!
              </div>
            )}
            {runs.slice(0, 10).map((run) => (
              <div
                key={run.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "12px 14px",
                  background: "var(--bg-secondary)",
                  borderRadius: "10px",
                  border: `1px solid ${run.status === "done" ? "rgba(16,185,129,0.2)" : run.status === "failed" ? "rgba(239,68,68,0.2)" : "var(--border)"}`,
                }}
              >
                {run.result?.thumbnailUrl && (
                  <img
                    src={run.result.thumbnailUrl}
                    alt="thumb"
                    style={{ width: "36px", height: "64px", objectFit: "cover", borderRadius: "6px" }}
                  />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "13px", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {run.result?.title || run.topic}
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
                    {new Date(run.createdAt).toLocaleString()}
                  </div>
                </div>
                <span className={`badge badge-${run.status}`}>{run.status}</span>
                {run.result?.youtubeUrl && (
                  <a
                    href={run.result.youtubeUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: "#ff4444", fontSize: "18px", textDecoration: "none" }}
                  >
                    ▶
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Quick Start ── */}
      <div
        className="glass-purple"
        style={{ padding: "24px", borderRadius: "16px", marginTop: "32px", textAlign: "center" }}
      >
        <h3 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "8px" }}>
          🚀 Quick Start
        </h3>
        <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginBottom: "20px" }}>
          Configure your API keys in Settings, then run your first pipeline!
        </p>
        <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
          <a href="/settings" className="btn-primary" style={{ textDecoration: "none" }} id="goto-settings-btn">
            ⚙️ Configure Settings
          </a>
          <a href="/pipeline" className="btn-secondary" style={{ textDecoration: "none" }} id="goto-pipeline-btn">
            ⚡ Open Pipeline
          </a>
        </div>
      </div>
    </div>
  );
}

"use client";

// app/pipeline/page.tsx — Live Pipeline Run View
import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

interface PipelineEvent {
  runId?: string;
  stage: string;
  status: "start" | "progress" | "done" | "error";
  message: string;
  data?: unknown;
}

interface StageState {
  status: "pending" | "running" | "done" | "error";
  messages: string[];
  output?: unknown;
}

const STAGES = [
  { id: "script",   icon: "🧠", label: "Generate Script",   color: "#9c7aff" },
  { id: "images",   icon: "🖼️",  label: "Generate Images",   color: "#00d4ff" },
  { id: "audio",    icon: "🎤",  label: "Generate Audio",    color: "#f59e0b" },
  { id: "videos",   icon: "🎬",  label: "Generate Videos",   color: "#ec4899" },
  { id: "titles",   icon: "✍️",  label: "Generate Titles",   color: "#10b981" },
  { id: "assemble", icon: "🎞️",  label: "Assemble Video",    color: "#6366f1" },
  { id: "save",     icon: "💾",  label: "Save Result",       color: "#8b5cf6" },
  { id: "upload",   icon: "📤",  label: "Upload YouTube",    color: "#ef4444" },
];

function PipelinePage() {
  const searchParams = useSearchParams();
  const topicFromUrl = searchParams.get("topic") || "";
  const topicIdFromUrl = searchParams.get("topicId") || "";

  const [topic, setTopic] = useState(topicFromUrl);
  const [runId, setRunId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [stages, setStages] = useState<Record<string, StageState>>(() =>
    Object.fromEntries(STAGES.map((s) => [s.id, { status: "pending", messages: [] }]))
  );
  const [logs, setLogs] = useState<{ text: string; type: string }[]>([]);
  const [result, setResult] = useState<{ title?: string; videoUrl?: string; thumbnailUrl?: string } | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  function addLog(text: string, type = "info") {
    setLogs((prev) => [...prev, { text: `[${new Date().toLocaleTimeString()}] ${text}`, type }]);
  }

  function updateStage(stageId: string, update: Partial<StageState>) {
    setStages((prev) => ({
      ...prev,
      [stageId]: { ...prev[stageId], ...update },
    }));
  }

  function addStageMessage(stageId: string, message: string) {
    setStages((prev) => ({
      ...prev,
      [stageId]: {
        ...prev[stageId],
        messages: [...(prev[stageId]?.messages || []), message],
      },
    }));
  }

  async function startPipeline() {
    if (!topic.trim()) return;
    setRunning(true);
    setDone(false);
    setResult(null);
    setLogs([]);
    setStages(Object.fromEntries(STAGES.map((s) => [s.id, { status: "pending", messages: [] }])));

    addLog(`🚀 Starting pipeline for: "${topic}"`, "info");

    const response = await fetch("/api/pipeline/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic: topic.trim(), topicId: topicIdFromUrl || undefined }),
    });

    if (!response.ok) {
      const err = await response.json();
      addLog(`❌ Error: ${err.error}`, "error");
      setRunning(false);
      return;
    }

    // Read SSE stream
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) return;

    while (true) {
      const { done: streamDone, value } = await reader.read();
      if (streamDone) break;

      const text = decoder.decode(value);
      const lines = text.split("\n");

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        try {
          const event: PipelineEvent = JSON.parse(line.slice(6));

          if (event.runId && !runId) setRunId(event.runId);

          if (event.stage === "complete") {
            setDone(true);
            setRunning(false);
            addLog("🎉 Pipeline complete!", "success");
            continue;
          }

          if (event.stage === "error") {
            addLog(event.message, "error");
            setRunning(false);
            continue;
          }

          // Update stage
          if (event.status === "start") {
            updateStage(event.stage, { status: "running" });
          } else if (event.status === "done") {
            updateStage(event.stage, { status: "done", output: event.data });
            if (event.stage === "save" && event.data) {
              setResult(event.data as { title?: string; videoUrl?: string; thumbnailUrl?: string });
            }
          } else if (event.status === "error") {
            updateStage(event.stage, { status: "error" });
          }

          addStageMessage(event.stage, event.message);
          addLog(event.message, event.status === "done" ? "success" : event.status === "error" ? "error" : "progress");
        } catch {
          // ignore parse errors
        }
      }
    }

    setRunning(false);
    if (!done) setDone(true);
  }

  return (
    <div style={{ padding: "32px 24px", maxWidth: "1400px", margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "32px" }}>
        <div>
          <h1
            style={{
              fontFamily: "Outfit, sans-serif",
              fontSize: "28px",
              fontWeight: 800,
              background: "linear-gradient(135deg, #9c7aff, #00d4ff)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            ⚡ Pipeline Runner
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginTop: "4px" }}>
            Watch your YouTube Short come to life in real-time
          </p>
        </div>
        <Link href="/" style={{ color: "var(--text-secondary)", textDecoration: "none", fontSize: "13px" }}>
          ← Back to Dashboard
        </Link>
      </div>

      {/* ── Topic Input ── */}
      <div className="glass pipeline-node" style={{ padding: "20px", marginBottom: "24px" }}>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <input
            className="input"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder='Enter your story topic, e.g. "Scary nurse in abandoned hospital"'
            disabled={running}
            id="pipeline-topic-input"
            onKeyDown={(e) => e.key === "Enter" && !running && startPipeline()}
          />
          <button
            className="btn-primary"
            onClick={startPipeline}
            disabled={running || !topic.trim()}
            id="start-pipeline-btn"
            style={{ flexShrink: 0, padding: "10px 28px" }}
          >
            {running ? (
              <>
                <span className="animate-spin-slow" style={{ display: "inline-block" }}>⚙️</span>
                Running...
              </>
            ) : done ? (
              "🔄 Run Again"
            ) : (
              "⚡ Start Pipeline"
            )}
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: "24px" }}>
        {/* ── Stage List ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {STAGES.map((stage, i) => {
            const state = stages[stage.id];
            const isActive = state.status === "running";
            const isDone = state.status === "done";
            const isFailed = state.status === "error";

            return (
              <div
                key={stage.id}
                className={`pipeline-node ${isActive ? "active" : isDone ? "done" : isFailed ? "failed" : ""}`}
                style={{ padding: "14px 16px", display: "flex", alignItems: "flex-start", gap: "12px" }}
              >
                {/* Status icon */}
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "10px",
                    background: isDone
                      ? "rgba(16,185,129,0.15)"
                      : isFailed
                      ? "rgba(239,68,68,0.15)"
                      : isActive
                      ? `rgba(108,71,255,0.15)`
                      : "var(--bg-secondary)",
                    border: `1px solid ${isDone ? "var(--green)" : isFailed ? "var(--red)" : isActive ? "var(--purple)" : "var(--border)"}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "18px",
                    flexShrink: 0,
                    animation: isActive ? "pulse-glow 1.5s infinite" : undefined,
                    color: isActive ? "var(--purple)" : isDone ? "var(--green)" : "inherit",
                  }}
                >
                  {isDone ? "✅" : isFailed ? "❌" : isActive ? "⚙️" : stage.icon}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "13px", fontWeight: 600 }}>{stage.label}</span>
                    <span
                      className={`badge ${isActive ? "badge-running" : isDone ? "badge-done" : isFailed ? "badge-failed" : "badge-pending"}`}
                    >
                      {isActive ? "running" : isDone ? "done" : isFailed ? "failed" : "pending"}
                    </span>
                  </div>
                  {state.messages.length > 0 && (
                    <p
                      style={{
                        fontSize: "11px",
                        color: "var(--text-muted)",
                        marginTop: "4px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {state.messages[state.messages.length - 1]}
                    </p>
                  )}
                </div>

                {/* Progress connector */}
                {i < STAGES.length - 1 && (
                  <div
                    style={{
                      position: "absolute",
                      left: "33px",
                      bottom: "-9px",
                      width: "2px",
                      height: "9px",
                      background: isDone ? "var(--green)" : "var(--border)",
                      zIndex: 1,
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* ── Right Panel: Logs + Result ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Live Logs */}
          <div
            className="glass pipeline-node"
            style={{ padding: "20px", flex: 1 }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
              <h3 style={{ fontSize: "14px", fontWeight: 700 }}>📡 Live Logs</h3>
              {running && (
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--cyan)" }}>
                  <div
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      background: "var(--cyan)",
                      animation: "pulse-glow 1s infinite",
                      color: "var(--cyan)",
                    }}
                  />
                  Streaming
                </div>
              )}
            </div>
            <div
              style={{
                background: "var(--bg-primary)",
                borderRadius: "8px",
                padding: "12px",
                height: "320px",
                overflowY: "auto",
                fontFamily: "monospace",
                fontSize: "12px",
              }}
            >
              {logs.length === 0 && (
                <div style={{ color: "var(--text-muted)", padding: "20px", textAlign: "center" }}>
                  Pipeline logs will appear here...
                </div>
              )}
              {logs.map((log, i) => (
                <div
                  key={i}
                  className={`log-line ${log.type}`}
                  style={{
                    color:
                      log.type === "success"
                        ? "var(--green)"
                        : log.type === "error"
                        ? "var(--red)"
                        : log.type === "info"
                        ? "var(--cyan)"
                        : "var(--text-secondary)",
                  }}
                >
                  {log.text}
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          </div>

          {/* Result Panel */}
          {done && result && (
            <div
              className="glass-purple"
              style={{ padding: "24px", borderRadius: "16px", animation: "slide-in 0.4s ease" }}
            >
              <h3 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "16px", color: "var(--green)" }}>
                🎉 Pipeline Complete!
              </h3>
              <div style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
                {result.thumbnailUrl && (
                  <img
                    src={result.thumbnailUrl}
                    alt="Generated thumbnail"
                    style={{ width: "80px", height: "142px", objectFit: "cover", borderRadius: "8px" }}
                  />
                )}
                <div style={{ flex: 1 }}>
                  {result.title && (
                    <div style={{ fontSize: "18px", fontWeight: 700, marginBottom: "8px" }}>{result.title}</div>
                  )}
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    {result.videoUrl && (
                      <a
                        href={result.videoUrl}
                        download
                        className="btn-primary"
                        style={{ textDecoration: "none" }}
                        id="download-video-btn"
                      >
                        ⬇️ Download MP4
                      </a>
                    )}
                    {runId && (
                      <button
                        className="btn-secondary"
                        onClick={() => window.open(`/api/auth/youtube`, "_blank")}
                        id="youtube-upload-btn"
                      >
                        📤 Upload to YouTube
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PipelinePageWrapper() {
  return (
    <Suspense fallback={<div style={{ padding: "32px", color: "var(--text-muted)" }}>Loading pipeline...</div>}>
      <PipelinePage />
    </Suspense>
  );
}

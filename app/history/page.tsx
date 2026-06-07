"use client";

// app/history/page.tsx — Pipeline Run History
import { useState, useEffect } from "react";

interface Run {
  id: string;
  topic: string;
  status: "running" | "done" | "failed";
  stages: Record<string, { status: string; output?: unknown }>;
  result?: { title: string; videoUrl?: string; youtubeUrl?: string; thumbnailUrl?: string };
  createdAt: string;
  updatedAt: string;
}

const STAGE_LABELS: Record<string, string> = {
  script: "🧠 Script",
  images: "🖼️ Images",
  audio: "🎤 Audio",
  videos: "🎬 Videos",
  titles: "✍️ Titles",
  assemble: "🎞️ Assemble",
  save: "💾 Save",
  upload: "📤 YouTube",
};

export default function HistoryPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Run | null>(null);

  useEffect(() => {
    fetch("/api/runs")
      .then((r) => r.json())
      .then((data) => {
        setRuns(data);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
        <div style={{ color: "var(--text-muted)" }}>Loading history...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: "32px 24px", maxWidth: "1400px", margin: "0 auto" }}>
      <div style={{ marginBottom: "32px" }}>
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
          📋 Pipeline History
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginTop: "4px" }}>
          {runs.length} total runs
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 400px" : "1fr", gap: "24px" }}>
        {/* Run List */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {runs.length === 0 && (
            <div
              className="glass pipeline-node"
              style={{ padding: "48px", textAlign: "center", color: "var(--text-muted)" }}
            >
              <div style={{ fontSize: "48px", marginBottom: "16px" }}>🎬</div>
              <p>No pipeline runs yet. Start your first pipeline!</p>
              <a href="/pipeline" className="btn-primary" style={{ textDecoration: "none", display: "inline-flex", marginTop: "16px" }}>
                ⚡ Go to Pipeline
              </a>
            </div>
          )}
          {runs.map((run) => (
            <div
              key={run.id}
              className={`glass pipeline-node ${run.status === "done" ? "done" : run.status === "failed" ? "failed" : ""}`}
              style={{
                padding: "16px 20px",
                cursor: "pointer",
                border: selected?.id === run.id ? "1px solid var(--purple)" : undefined,
              }}
              onClick={() => setSelected(selected?.id === run.id ? null : run)}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                {run.result?.thumbnailUrl && (
                  <img
                    src={run.result.thumbnailUrl}
                    alt=""
                    style={{ width: "40px", height: "71px", objectFit: "cover", borderRadius: "6px", flexShrink: 0 }}
                  />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "14px", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {run.result?.title || run.topic}
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
                    Run ID: {run.id.slice(0, 8)}... · {new Date(run.createdAt).toLocaleString()}
                  </div>
                  {/* Stage progress */}
                  <div style={{ display: "flex", gap: "4px", marginTop: "8px", flexWrap: "wrap" }}>
                    {Object.entries(run.stages || {}).map(([stageId, stage]) => (
                      <span
                        key={stageId}
                        style={{
                          padding: "2px 7px",
                          borderRadius: "4px",
                          fontSize: "10px",
                          fontWeight: 600,
                          background:
                            stage.status === "done"
                              ? "rgba(16,185,129,0.15)"
                              : stage.status === "running"
                              ? "rgba(108,71,255,0.15)"
                              : stage.status === "failed"
                              ? "rgba(239,68,68,0.15)"
                              : "rgba(255,255,255,0.05)",
                          color:
                            stage.status === "done"
                              ? "var(--green)"
                              : stage.status === "running"
                              ? "var(--purple-light)"
                              : stage.status === "failed"
                              ? "var(--red)"
                              : "var(--text-muted)",
                        }}
                      >
                        {STAGE_LABELS[stageId] || stageId}
                      </span>
                    ))}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "8px" }}>
                  <span className={`badge badge-${run.status}`}>{run.status}</span>
                  {run.result?.youtubeUrl && (
                    <a
                      href={run.result.youtubeUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "#ff4444", fontSize: "20px", textDecoration: "none" }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      ▶
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Detail Panel */}
        {selected && (
          <div className="glass pipeline-node" style={{ padding: "24px", height: "fit-content", position: "sticky", top: "80px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
              <h3 style={{ fontSize: "15px", fontWeight: 700 }}>Run Details</h3>
              <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "18px" }}>×</button>
            </div>
            {selected.result?.thumbnailUrl && (
              <img
                src={selected.result.thumbnailUrl}
                alt=""
                style={{ width: "100%", aspectRatio: "9/16", objectFit: "cover", borderRadius: "8px", marginBottom: "16px" }}
              />
            )}
            <div style={{ fontSize: "15px", fontWeight: 600, marginBottom: "8px" }}>
              {selected.result?.title || selected.topic}
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "16px" }}>
              {new Date(selected.createdAt).toLocaleString()}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {selected.result?.videoUrl && (
                <a href={selected.result.videoUrl} download className="btn-primary" style={{ textDecoration: "none", justifyContent: "center" }}>
                  ⬇️ Download MP4
                </a>
              )}
              {selected.result?.youtubeUrl && (
                <a href={selected.result.youtubeUrl} target="_blank" rel="noreferrer" className="btn-secondary" style={{ textDecoration: "none", textAlign: "center" }}>
                  📺 View on YouTube
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

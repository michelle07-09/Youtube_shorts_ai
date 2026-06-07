// app/api/pipeline/run/route.ts
import { NextRequest } from "next/server";
import { getSettings, updateTopic } from "@/lib/db";
import { runPipeline, PipelineEvent } from "@/lib/pipeline-orchestrator";
import { createPipelineRunRecord } from "@/lib/pipeline-run";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes

export async function POST(req: NextRequest) {
  const { topicId, topic } = await req.json();

  if (!topic) {
    return new Response(JSON.stringify({ error: "topic is required" }), { status: 400 });
  }

  const settings = getSettings();

  if (!settings.openaiKey) {
    return new Response(JSON.stringify({ error: "OpenAI API key not configured. Go to Settings." }), { status: 400 });
  }

  const runId = createPipelineRunRecord(topicId || "manual", topic);

  if (topicId) {
    updateTopic(topicId, { status: "running" });
  }

  // Server-Sent Events stream
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      function send(data: PipelineEvent) {
        const line = `data: ${JSON.stringify({ runId, ...data })}\n\n`;
        controller.enqueue(encoder.encode(line));
      }

      try {
        await runPipeline(runId, topicId || "manual", topic, settings, send);
        send({ stage: "complete", status: "done", message: "🎉 Pipeline complete!", data: { runId } });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        send({ stage: "error", status: "error", message: `❌ ${message}` });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

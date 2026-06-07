// lib/pipeline-run.ts
// Helper to create a new pipeline run record in the database

import { v4 as uuidv4 } from "uuid";
import { createRun } from "@/lib/db";

/**
 * Creates a new pipeline run record and returns the generated runId.
 */
export function createPipelineRunRecord(topicId: string, topic: string): string {
  const runId = uuidv4();

  createRun({
    id: runId,
    topicId,
    topic,
    status: "running",
    stages: {
      script:   { status: "pending" },
      images:   { status: "pending" },
      audio:    { status: "pending" },
      videos:   { status: "pending" },
      titles:   { status: "pending" },
      assemble: { status: "pending" },
      save:     { status: "pending" },
      upload:   { status: "pending" },
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  return runId;
}

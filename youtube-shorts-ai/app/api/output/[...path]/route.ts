// app/api/output/[...path]/route.ts
// Serves generated files (videos, images, audio) from the OUTPUT_DIR volume.
// This replaces static serving from public/output/ when files live on a Railway volume.

import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";

export const runtime = "nodejs";

const MIME_TYPES: Record<string, string> = {
  ".mp4": "video/mp4",
  ".mp3": "audio/mpeg",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".json": "application/json",
  ".txt": "text/plain",
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params;
  const outputDir = process.env.OUTPUT_DIR || path.join(process.cwd(), "public", "output");
  const filePath = path.join(outputDir, ...segments);

  // Security: prevent path traversal
  const resolved = path.resolve(filePath);
  const resolvedOutput = path.resolve(outputDir);
  if (!resolved.startsWith(resolvedOutput)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  if (!fs.existsSync(resolved)) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const ext = path.extname(resolved).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  const stat = fs.statSync(resolved);

  // Handle Range requests for video streaming
  const range = req.headers.get("range");
  if (range && contentType.startsWith("video/")) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
    const chunkSize = end - start + 1;

    const stream = fs.createReadStream(resolved, { start, end });
    const readable = new ReadableStream({
      start(controller) {
        stream.on("data", (chunk) => controller.enqueue(chunk));
        stream.on("end", () => controller.close());
        stream.on("error", (err) => controller.error(err));
      },
    });

    return new Response(readable, {
      status: 206,
      headers: {
        "Content-Range": `bytes ${start}-${end}/${stat.size}`,
        "Accept-Ranges": "bytes",
        "Content-Length": String(chunkSize),
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
      },
    });
  }

  // Full file response
  const buffer = fs.readFileSync(resolved);
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(stat.size),
      "Cache-Control": "public, max-age=86400",
      "Content-Disposition": contentType.startsWith("video/")
        ? `inline; filename="${path.basename(resolved)}"`
        : "inline",
    },
  });
}

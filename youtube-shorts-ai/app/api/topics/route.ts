// app/api/topics/route.ts
import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { getTopics, addTopic, deleteTopic, updateTopic } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(getTopics());
}

export async function POST(req: NextRequest) {
  const { text } = await req.json();
  if (!text) return NextResponse.json({ error: "text required" }, { status: 400 });

  const topic = {
    id: uuidv4(),
    text: text.trim(),
    status: "pending" as const,
    createdAt: new Date().toISOString(),
  };

  addTopic(topic);
  return NextResponse.json(topic);
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  deleteTopic(id);
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest) {
  const { id, ...updates } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  updateTopic(id, updates);
  return NextResponse.json({ ok: true });
}

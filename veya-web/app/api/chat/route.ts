import OpenAI from "openai";
import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/getAuthUser";
import { consumeAiMessageForPlan, planLimitResponse } from "@/lib/planLimits";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Lightweight Responses API proxy. Requires a signed-in session or Bearer token
 * (same as other authenticated API routes) so the OpenAI key cannot be abused anonymously.
 */
export async function POST(req: Request) {
  const authUser = await getAuthUser(req);
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.OPENAI_API_KEY?.trim()) {
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  }

  let message: string;
  try {
    const body = (await req.json()) as { message?: unknown };
    message = typeof body?.message === "string" ? body.message : "";
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!message.trim()) {
    return NextResponse.json({ error: "Invalid message" }, { status: 400 });
  }

  try {
    await consumeAiMessageForPlan(authUser.id);
  } catch (e) {
    const limit = planLimitResponse(e);
    if (limit) return limit;
    throw e;
  }

  const model =
    process.env.OPENAI_CHAT_MODEL?.trim() || "gpt-5.4-nano";

  try {
    const response = await client.responses.create({
      model,
      input: message,
    });

    return NextResponse.json({
      reply: response.output_text,
    });
  } catch (e) {
    console.error("[POST /api/chat]", e);
    return NextResponse.json({ error: "AI request failed" }, { status: 500 });
  }
}

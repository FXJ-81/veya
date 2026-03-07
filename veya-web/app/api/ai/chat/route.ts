import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getAuthUser } from "@/lib/getAuthUser";
import { prisma } from "@/lib/prisma";

const systemPrompt = (userData: string) =>
  `You are Veya's AI Financial Coach. You are friendly, warm, and data-driven. You have full access to the user's subscription data: ${userData}. Always use real numbers from their data. Always end with one clear action step. Never be preachy. Be specific, never generic.`;

export async function POST(req: Request) {
  const authUser = await getAuthUser(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await prisma.user.findUnique({
    where: { id: authUser.id },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  }

  let body: { message: string; history?: { role: string; content: string }[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const subs = await prisma.subscription.findMany({
    where: { userId: user.id },
    orderBy: { nextRenewal: "asc" },
  });
  const userData = JSON.stringify(
    subs.map((s) => ({
      name: s.name,
      category: s.category,
      price: s.price,
      billingCycle: s.billingCycle,
      nextRenewal: s.nextRenewal.toISOString(),
      status: s.status,
    }))
  );

  const openai = new OpenAI({ apiKey });
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt(userData) },
    ...(body.history ?? []).map((m: { role: string; content: string }) => ({
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
    })),
    { role: "user", content: body.message },
  ];

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      max_tokens: 500,
    });
    const reply = completion.choices[0]?.message?.content ?? "I couldn't generate a response.";
    return NextResponse.json({ reply });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "AI request failed" },
      { status: 500 }
    );
  }
}

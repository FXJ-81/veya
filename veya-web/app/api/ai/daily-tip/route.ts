import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getAuthUser } from "@/lib/getAuthUser";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const authUser = await getAuthUser(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await prisma.user.findUnique({
    where: { id: authUser.id },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ tip: "Connect your subscriptions to get personalized tips." });
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
    }))
  );

  const openai = new OpenAI({ apiKey });
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are Veya's subscription coach. Using ONLY this JSON subscription data, output exactly one or two sentences: one concrete observation with real service names and dollar amounts, then one actionable step. No greeting, no emojis, no generic filler. Data: ${userData}`,
        },
        { role: "user", content: "Give me one quick tip to save money on my subscriptions today." },
      ],
      max_tokens: 150,
    });
    const tip = completion.choices[0]?.message?.content ?? "Review your subscriptions this week and cancel what you don't use.";
    return NextResponse.json({ tip });
  } catch {
    return NextResponse.json({
      tip: "Review your subscriptions this week and cancel what you don't use.",
    });
  }
}

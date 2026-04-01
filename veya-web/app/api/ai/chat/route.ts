import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getAuthUser } from "@/lib/getAuthUser";
import { prisma } from "@/lib/prisma";
import { pricePerMonth } from "@/lib/subscriptionBilling";

type ActionPayload =
  | { action: "create"; name: string; price: number; billingCycle: string; category: string }
  | { action: "cancel" | "pause" | "resume"; subscriptionId: string };

function extractTrailingJsonAction(reply: string): { text: string; action?: ActionPayload } {
  const trimmed = reply.trim();
  const lastOpen = trimmed.lastIndexOf("{");
  const lastClose = trimmed.lastIndexOf("}");
  if (lastOpen === -1 || lastClose === -1 || lastClose < lastOpen) {
    return { text: reply };
  }

  const jsonCandidate = trimmed.slice(lastOpen, lastClose + 1);
  try {
    const parsed = JSON.parse(jsonCandidate) as unknown;
    if (!parsed || typeof parsed !== "object") return { text: reply };
    const action = parsed as any;
    if (typeof action.action !== "string") return { text: reply };
    return {
      text: trimmed.slice(0, lastOpen).trimEnd(),
      action,
    };
  } catch {
    return { text: reply };
  }
}

function addCycle(from: Date, billingCycle: string): Date {
  const d = new Date(from);
  switch (billingCycle) {
    case "weekly":
      d.setDate(d.getDate() + 7);
      return d;
    case "yearly":
      d.setFullYear(d.getFullYear() + 1);
      return d;
    case "monthly":
    case "custom":
    default:
      d.setMonth(d.getMonth() + 1);
      return d;
  }
}

const systemPrompt = (subscriptionData: string, monthlyTotal: number) =>
  `You are Veya's AI Financial Coach. You help users manage their subscriptions. You have full access to the user's subscription data and can perform actions.

User's current subscriptions: ${subscriptionData}
User's monthly total: ${monthlyTotal}

You can perform these actions by including them in your response as JSON at the end:
- Create subscription: {"action":"create","name":"","price":0,"billingCycle":"","category":""}
- Cancel subscription: {"action":"cancel","subscriptionId":""}
- Pause subscription: {"action":"pause","subscriptionId":""}
- Resume subscription: {"action":"resume","subscriptionId":""}

Rules:
- Always use real data from the user's subscriptions
- Be concise and helpful
- Use $ amounts and real subscription names
- Always confirm destructive actions before doing them
- Never make up subscription data
- Format responses cleanly without raw markdown symbols`;

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

  let body: { message: string; conversationId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body?.message || typeof body.message !== "string") {
    return NextResponse.json({ error: "Invalid message" }, { status: 400 });
  }

  const subs = await prisma.subscription.findMany({
    where: { userId: user.id },
    orderBy: { nextRenewal: "asc" },
  });
  const monthlyTotal = subs
    .filter((s) => s.status === "active")
    .reduce((sum, s) => sum + pricePerMonth(s.price, s.billingCycle), 0);
  const subscriptionData = JSON.stringify(
    subs.map((s) => ({
      id: s.id,
      name: s.name,
      category: s.category,
      price: s.price,
      billingCycle: s.billingCycle,
      nextRenewal: s.nextRenewal.toISOString(),
      status: s.status,
    }))
  );

  // Use the conversationId sent by the client; fall back to creating a new one.
  let convo = body.conversationId
    ? await prisma.aIConversation.findFirst({
        where: { id: body.conversationId, userId: user.id },
      })
    : null;
  if (!convo) {
    convo = await prisma.aIConversation.create({
      data: { userId: user.id, messages: [] },
    });
    console.log("[/api/ai/chat] created new conversation:", convo.id);
  }

  const existingMessages = (convo.messages as any[]) ?? [];
  const userMsg = {
    id: crypto.randomUUID(),
    role: "user",
    content: body.message,
    createdAt: new Date().toISOString(),
    kind: "chat",
  };
  const withUser = [...existingMessages, userMsg];
  await prisma.aIConversation.update({
    where: { id: convo.id },
    data: { messages: withUser },
  });

  const normalizedUser = body.message.trim().toLowerCase();
  const lastAssistant = [...existingMessages].reverse().find((m) => m?.role === "assistant");
  const pendingAction = lastAssistant?.meta?.pendingAction as ActionPayload | undefined;
  const isAffirmative = normalizedUser === "yes" || normalizedUser === "y";

  if (pendingAction?.action === "cancel" && isAffirmative) {
    if (!pendingAction.subscriptionId) {
      const assistantMsg = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "I couldn't find which subscription to confirm. Try: “Cancel Netflix”.",
        createdAt: new Date().toISOString(),
        kind: "chat",
      };
      const finalMessages = [...withUser, assistantMsg];
      await prisma.aIConversation.update({
        where: { id: convo.id },
        data: { messages: finalMessages },
      });
      return NextResponse.json({ reply: assistantMsg.content, messages: finalMessages });
    }

    const target = await prisma.subscription.findFirst({
      where: { id: pendingAction.subscriptionId, userId: user.id },
    });
    if (!target) {
      const assistantMsg = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "That subscription no longer exists. Nothing to cancel.",
        createdAt: new Date().toISOString(),
        kind: "chat",
      };
      const finalMessages = [...withUser, assistantMsg];
      await prisma.aIConversation.update({
        where: { id: convo.id },
        data: { messages: finalMessages },
      });
      return NextResponse.json({ reply: assistantMsg.content, messages: finalMessages });
    }

    await prisma.subscription.update({
      where: { id: target.id },
      data: { status: "cancelled" },
    });

    const assistantMsg = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: `${target.name} has been cancelled ✅`,
      createdAt: new Date().toISOString(),
      kind: "chat",
      meta: { performedAction: pendingAction },
    };
    const actionMsg = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: `✅ Cancelled **${target.name}** ($${target.price}/${target.billingCycle})\n\n[View in subscriptions →](/subscriptions)`,
      createdAt: new Date().toISOString(),
      kind: "action",
      meta: { status: "success", link: "/subscriptions" },
    };
    const finalMessages = [...withUser, assistantMsg, actionMsg];
    await prisma.aIConversation.update({
      where: { id: convo.id },
      data: { messages: finalMessages },
    });
    return NextResponse.json({ reply: assistantMsg.content, messages: finalMessages, actionPerformed: true });
  }

  // Fast deterministic answers (no model) for common “read-only” questions
  if (
    normalizedUser.includes("show") && normalizedUser.includes("subscription") ||
    normalizedUser.includes("what subscriptions") ||
    normalizedUser.includes("my subscriptions")
  ) {
    const active = subs.filter((s) => s.status !== "cancelled");
    const list =
      active.length === 0
        ? "You don't have any subscriptions yet."
        : `Here are your subscriptions:\n\n${active
            .map((s) => `- **${s.name}** — $${s.price}/${s.billingCycle} (${s.status})`)
            .join("\n")}`;
    const assistantMsg = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: list,
      createdAt: new Date().toISOString(),
      kind: "chat",
    };
    const finalMessages = [...withUser, assistantMsg];
    await prisma.aIConversation.update({
      where: { id: convo.id },
      data: { messages: finalMessages },
    });
    return NextResponse.json({ reply: assistantMsg.content, messages: finalMessages });
  }

  if (
    normalizedUser.includes("how much am i spending") ||
    normalizedUser.includes("monthly total") ||
    normalizedUser.includes("spending summary")
  ) {
    const byCategory = new Map<string, number>();
    for (const s of subs.filter((x) => x.status === "active")) {
      const pm = pricePerMonth(s.price, s.billingCycle);
      byCategory.set(s.category, (byCategory.get(s.category) ?? 0) + pm);
    }
    const breakdown =
      byCategory.size === 0
        ? "No active subscriptions yet."
        : [...byCategory.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([cat, amt]) => `- **${cat}** — $${amt.toFixed(2)}/month`)
            .join("\n");
    const assistantMsg = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: `Your monthly total is **$${monthlyTotal.toFixed(2)}**.\n\nBy category:\n${breakdown}`,
      createdAt: new Date().toISOString(),
      kind: "chat",
    };
    const finalMessages = [...withUser, assistantMsg];
    await prisma.aIConversation.update({ where: { id: convo.id }, data: { messages: finalMessages } });
    return NextResponse.json({ reply: assistantMsg.content, messages: finalMessages });
  }

  if (normalizedUser.includes("most expensive") || normalizedUser.includes("cheapest")) {
    const active = subs.filter((s) => s.status === "active");
    const sorted =
      active.length === 0
        ? []
        : active
            .map((s) => ({ s, pm: pricePerMonth(s.price, s.billingCycle) }))
            .sort((a, b) => a.pm - b.pm);
    const wantCheapest = normalizedUser.includes("cheapest");
    const best = sorted.length ? (wantCheapest ? sorted[0] : sorted[sorted.length - 1]) : null;
    const assistantMsg = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: best
        ? `Your ${wantCheapest ? "cheapest" : "most expensive"} subscription (monthly-equivalent) is **${best.s.name}** at **$${best.pm.toFixed(2)}/month**.`
        : "You don't have any active subscriptions yet.",
      createdAt: new Date().toISOString(),
      kind: "chat",
    };
    const finalMessages = [...withUser, assistantMsg];
    await prisma.aIConversation.update({ where: { id: convo.id }, data: { messages: finalMessages } });
    return NextResponse.json({ reply: assistantMsg.content, messages: finalMessages });
  }

  if (normalizedUser.includes("renews this week") || normalizedUser.includes("renew") && normalizedUser.includes("week")) {
    const now = new Date();
    const end = new Date(now);
    end.setDate(end.getDate() + 7);
    const upcoming = subs.filter((s) => s.status === "active" && s.nextRenewal >= now && s.nextRenewal <= end);
    const assistantMsg = {
      id: crypto.randomUUID(),
      role: "assistant",
      content:
        upcoming.length === 0
          ? "Nothing renews in the next 7 days."
          : `Renews in the next 7 days:\n\n${upcoming
              .map((s) => `- **${s.name}** — ${s.nextRenewal.toLocaleDateString()} ($${s.price}/${s.billingCycle})`)
              .join("\n")}`,
      createdAt: new Date().toISOString(),
      kind: "chat",
    };
    const finalMessages = [...withUser, assistantMsg];
    await prisma.aIConversation.update({ where: { id: convo.id }, data: { messages: finalMessages } });
    return NextResponse.json({ reply: assistantMsg.content, messages: finalMessages });
  }

  const openai = new OpenAI({ apiKey });
  const historyForModel: OpenAI.Chat.ChatCompletionMessageParam[] = withUser
    .filter((m) => m && (m.role === "user" || m.role === "assistant"))
    .map((m) => ({ role: m.role, content: String(m.content ?? "") }));
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt(subscriptionData, Number(monthlyTotal.toFixed(2))) },
    ...historyForModel,
  ];

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      max_tokens: 500,
    });
    const rawReply = completion.choices[0]?.message?.content ?? "I couldn't generate a response.";
    const extracted = extractTrailingJsonAction(rawReply);
    const replyText = extracted.text || "Done.";
    const action = extracted.action;

    if (action?.action === "cancel") {
      const target = await prisma.subscription.findFirst({
        where: { id: action.subscriptionId, userId: user.id },
      });
      const prompt = target
        ? `Are you sure you want to cancel **${target.name}** ($${target.price}/${target.billingCycle})? Type **yes** to confirm.`
        : "Which subscription do you want to cancel? (Example: “Cancel Netflix”)";
      const assistantMsg = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: replyText && replyText !== "Done." ? `${replyText}\n\n${prompt}` : prompt,
        createdAt: new Date().toISOString(),
        kind: "chat",
        meta: { pendingAction: action },
      };
      const finalMessages = [...withUser, assistantMsg];
      await prisma.aIConversation.update({ where: { id: convo.id }, data: { messages: finalMessages } });
      return NextResponse.json({ reply: assistantMsg.content, messages: finalMessages });
    }

    if (action?.action === "pause" || action?.action === "resume") {
      const target = await prisma.subscription.findFirst({
        where: { id: action.subscriptionId, userId: user.id },
      });
      if (!target) {
        const assistantMsg = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "I couldn't find that subscription.",
          createdAt: new Date().toISOString(),
          kind: "chat",
        };
        const finalMessages = [...withUser, assistantMsg];
        await prisma.aIConversation.update({ where: { id: convo.id }, data: { messages: finalMessages } });
        return NextResponse.json({ reply: assistantMsg.content, messages: finalMessages });
      }
      const newStatus = action.action === "pause" ? "paused" : "active";
      await prisma.subscription.update({
        where: { id: target.id },
        data: { status: newStatus },
      });
      const assistantMsg = {
        id: crypto.randomUUID(),
        role: "assistant",
        content:
          replyText && replyText !== "Done."
            ? replyText
            : `${target.name} has been ${newStatus === "paused" ? "paused" : "resumed"} ✅`,
        createdAt: new Date().toISOString(),
        kind: "chat",
        meta: { performedAction: action },
      };
      const actionMsg = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `✅ ${newStatus === "paused" ? "Paused" : "Resumed"} **${target.name}**\n\n[View in subscriptions →](/subscriptions)`,
        createdAt: new Date().toISOString(),
        kind: "action",
        meta: { status: "success", link: "/subscriptions" },
      };
      const finalMessages = [...withUser, assistantMsg, actionMsg];
      await prisma.aIConversation.update({ where: { id: convo.id }, data: { messages: finalMessages } });
      return NextResponse.json({ reply: assistantMsg.content, messages: finalMessages, actionPerformed: true });
    }

    if (action?.action === "create") {
      const now = new Date();
      const billingCycle = action.billingCycle || "monthly";
      const created = await prisma.subscription.create({
        data: {
          userId: user.id,
          name: action.name,
          price: Number(action.price),
          billingCycle,
          category: action.category || "Other",
          startDate: now,
          nextRenewal: addCycle(now, billingCycle),
          status: "active",
          source: "manual",
          isShared: false,
        },
      });
      const assistantMsg = {
        id: crypto.randomUUID(),
        role: "assistant",
        content:
          replyText && replyText !== "Done."
            ? replyText
            : `Done! I've added ${created.name} ($${created.price}/${created.billingCycle}) to your subscriptions ✅`,
        createdAt: new Date().toISOString(),
        kind: "chat",
        meta: { performedAction: action, subscriptionId: created.id },
      };
      const actionMsg = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `✅ Added **${created.name}** ($${created.price}/${created.billingCycle})\n\n[View in subscriptions →](/subscriptions)`,
        createdAt: new Date().toISOString(),
        kind: "action",
        meta: { status: "success", link: "/subscriptions" },
      };
      const finalMessages = [...withUser, assistantMsg, actionMsg];
      await prisma.aIConversation.update({ where: { id: convo.id }, data: { messages: finalMessages } });
      return NextResponse.json({ reply: assistantMsg.content, messages: finalMessages, actionPerformed: true });
    }

    const assistantMsg = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: rawReply,
      createdAt: new Date().toISOString(),
      kind: "chat",
    };
    const finalMessages = [...withUser, assistantMsg];
    await prisma.aIConversation.update({
      where: { id: convo.id },
      data: { messages: finalMessages },
    });
    return NextResponse.json({ reply: rawReply, messages: finalMessages });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "AI request failed" },
      { status: 500 }
    );
  }
}

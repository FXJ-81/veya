import { NextResponse } from "next/server";
import OpenAI from "openai";
import { Prisma } from "@prisma/client";
import { getAuthUser } from "@/lib/getAuthUser";
import { prisma } from "@/lib/prisma";
import { pricePerMonth, hasSubscriptionStarted } from "@/lib/subscriptionBilling";
import { SUBSCRIPTION_CATEGORIES } from "@/lib/categories";
import { createSubscriptionForUser } from "@/lib/subscriptionCreateInternal";
import { consumeAiMessageForPlan, planLimitResponse } from "@/lib/planLimits";

// ─── Types ────────────────────────────────────────────────────────────────────

type ActionPayload = {
  action: string;
  // new-style: all extra data lives in `data`
  data?: Record<string, unknown>;
  // legacy fields kept for backward compat
  [key: string]: unknown;
};

type ChatMessage = Record<string, unknown>;

function toBillingCycle(value: string): "monthly" | "yearly" | "weekly" | "custom" {
  return value === "yearly" || value === "weekly" || value === "custom" ? value : "monthly";
}

function toConversationJson(messages: ChatMessage[]): Prisma.InputJsonValue {
  return messages as Prisma.InputJsonArray;
}

// ─── JSON extraction ──────────────────────────────────────────────────────────

function extractTrailingJsonAction(reply: string): { text: string; action?: ActionPayload } {
  // Find the outer {"action": block using brace-depth tracking so nested
  // objects like {"action":"createBudget","data":{"category":"X","limit":50}}
  // are parsed correctly (lastIndexOf("{") would land inside "data":{}).
  const start = reply.indexOf('{"action"');
  if (start === -1) return { text: reply };

  let depth = 0;
  let end = -1;
  for (let i = start; i < reply.length; i++) {
    if (reply[i] === "{") depth++;
    else if (reply[i] === "}") {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }
  if (end === -1) return { text: reply };

  const candidate = reply.slice(start, end + 1);
  try {
    const parsed = JSON.parse(candidate) as unknown;
    if (!parsed || typeof parsed !== "object") return { text: reply };
    const obj = parsed as Record<string, unknown>;
    if (typeof obj.action !== "string") return { text: reply };
    return { text: reply.slice(0, start).trimEnd(), action: obj as ActionPayload };
  } catch {
    return { text: reply };
  }
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function addCycle(from: Date, billingCycle: string): Date {
  const d = new Date(from);
  switch (billingCycle) {
    case "weekly":  d.setDate(d.getDate() + 7); return d;
    case "yearly":  d.setFullYear(d.getFullYear() + 1); return d;
    default:        d.setMonth(d.getMonth() + 1); return d;
  }
}

// ─── Message builders ─────────────────────────────────────────────────────────

function actionMsg(content: string, link: string) {
  return {
    id: crypto.randomUUID(),
    role: "assistant",
    content,
    createdAt: new Date().toISOString(),
    kind: "action",
    meta: { status: "success", link },
  };
}

function chatMsg(content: string, meta?: Record<string, unknown>) {
  return {
    id: crypto.randomUUID(),
    role: "assistant",
    content,
    createdAt: new Date().toISOString(),
    kind: "chat",
    ...(meta ? { meta } : {}),
  };
}

// ─── System prompt ────────────────────────────────────────────────────────────

function buildSystemPrompt(
  userName: string,
  subscriptionData: string,
  budgetData: string,
  monthlyTotal: number,
  categoryBreakdown: string
): string {
  return `You are Veya's AI Financial Coach. You have FULL control over ${userName}'s Veya account. You can perform any action they can do manually.

CURRENT DATA:
Subscriptions: ${subscriptionData}
Budgets: ${budgetData}
Monthly total: $${monthlyTotal.toFixed(2)}
Spending by category: ${categoryBreakdown}

AVAILABLE ACTIONS — append ONE JSON block at the very end of your response (no text after it):

Subscription actions (execute immediately):
{"action":"createSubscription","data":{"name":"","price":0,"category":"","billingCycle":"monthly","startDate":"YYYY-MM-DD","nextRenewal":"YYYY-MM-DD","notes":""}}
{"action":"editSubscription","data":{"id":"","updates":{"name":"","price":0,"category":"","billingCycle":"monthly","notes":""}}}
{"action":"pauseSubscription","data":{"id":""}}
{"action":"resumeSubscription","data":{"id":""}}

Budget actions (execute immediately):
{"action":"createBudget","data":{"category":"","limit":0}}
{"action":"updateBudget","data":{"id":"","limit":0}}

Destructive actions (MUST ask for confirmation first — include JSON so it's stored, user will type "yes"):
{"action":"cancelSubscription","data":{"id":""}}
{"action":"deleteBudget","data":{"id":""}}
{"action":"bulkPause","data":{"category":""}}
{"action":"bulkCancel","data":{"ids":[]}}

RULES:
- Valid subscription and budget category names (use exactly): ${SUBSCRIPTION_CATEGORIES.join(", ")}
- Always use the EXACT ids from the data above, never make up ids
- Be proactive: when answering a question, also suggest an action
- Be specific: use real names and real dollar amounts
- For destructive actions: describe what you'll do, ask for confirmation, include the action JSON
- For immediate actions: just do it and explain what you did
- For "help me save $X/month": find specific subscriptions totaling that amount, list them, ask if you should cancel
- For "pause all [category]": use bulkPause with the category name, ask for confirmation first
- For "cancel everything over $X": use bulkCancel with the ids of matching subs, ask for confirmation
- For "set budgets for all my categories": create ONE createBudget per category using current spend as the limit
- For "what should I cancel": rank by price, look for category duplicates, suggest specific ones with reasoning
- Format currency as $X.XX, be concise`;
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const authUser = await getAuthUser(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: authUser.id } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI not configured" }, { status: 503 });

  let body: { message: string; conversationId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body?.message || typeof body.message !== "string") {
    return NextResponse.json({ error: "Invalid message" }, { status: 400 });
  }

  try {
    await consumeAiMessageForPlan(authUser.id);
  } catch (e) {
    const limit = planLimitResponse(e);
    if (limit) return limit;
    console.error("[/api/ai/chat] usage limit check failed", e);
    return NextResponse.json({ error: "AI usage check failed" }, { status: 500 });
  }

  // ─── Load context ────────────────────────────────────────────────────────────

  const [subs, budgets] = await Promise.all([
    prisma.subscription.findMany({
      where: { userId: user.id },
      orderBy: { nextRenewal: "asc" },
    }),
    prisma.budget.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } }),
  ]);

  const activeSubs = subs.filter((s) => s.status === "active");
  const monthlyTotal = activeSubs
    .filter((s) => hasSubscriptionStarted(new Date(s.startDate)))
    .reduce((sum, s) => sum + pricePerMonth(s.price, s.billingCycle), 0);

  const byCat = new Map<string, number>();
  for (const s of activeSubs.filter((s) => hasSubscriptionStarted(new Date(s.startDate)))) {
    byCat.set(s.category, (byCat.get(s.category) ?? 0) + pricePerMonth(s.price, s.billingCycle));
  }

  const subscriptionData = JSON.stringify(
    subs.map((s) => ({
      id: s.id,
      name: s.name,
      category: s.category,
      price: s.price,
      billingCycle: s.billingCycle,
      monthlyEquivalent: Number(pricePerMonth(s.price, s.billingCycle).toFixed(2)),
      nextRenewal: s.nextRenewal.toISOString().slice(0, 10),
      status: s.status,
      notes: s.notes ?? undefined,
    }))
  );

  const budgetData = JSON.stringify(
    budgets.map((b) => ({
      id: b.id,
      category: b.category,
      limit: b.limit,
      period: b.period,
      currentSpend: Number((byCat.get(b.category) ?? 0).toFixed(2)),
    }))
  );

  const categoryBreakdown = JSON.stringify(
    [...byCat.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([cat, amt]) => ({ category: cat, monthly: Number(amt.toFixed(2)) }))
  );

  const userName = user.name?.split(" ")[0] ?? "there";

  // ─── Load / create conversation ──────────────────────────────────────────────

  let convo = body.conversationId
    ? await prisma.aIConversation.findFirst({ where: { id: body.conversationId, userId: user.id } })
    : null;
  if (!convo) {
    convo = await prisma.aIConversation.create({
      data: { userId: user.id, messages: [] as Prisma.InputJsonArray },
    });
  }

  const existingMessages = (convo.messages as ChatMessage[]) ?? [];
  const userMsgObj = {
    id: crypto.randomUUID(),
    role: "user",
    content: body.message,
    createdAt: new Date().toISOString(),
    kind: "chat",
  };
  const withUser = [...existingMessages, userMsgObj];
  await prisma.aIConversation.update({
    where: { id: convo.id },
    data: { messages: toConversationJson(withUser) },
  });

  // ─── Pending action confirmation ─────────────────────────────────────────────

  const normalizedUser = body.message.trim().toLowerCase();
  const lastAssistant = [...existingMessages].reverse().find((m) => m?.role === "assistant") as
    | Record<string, unknown>
    | undefined;
  const pendingAction = (lastAssistant?.meta as Record<string, unknown> | undefined)
    ?.pendingAction as ActionPayload | undefined;
  const isAffirmative = /^(yes|y|confirm|do it|ok|sure|go ahead|proceed|yep|yeah)$/i.test(
    normalizedUser.trim()
  );

  if (pendingAction && isAffirmative) {
    const result = await executePendingAction(pendingAction, user.id, withUser, convo.id);
    if (result) return result;
  }

  // ─── OpenAI call ─────────────────────────────────────────────────────────────

  const openai = new OpenAI({ apiKey });

  const historyForModel: OpenAI.Chat.ChatCompletionMessageParam[] = withUser
    .filter((m) => m && (m.role === "user" || m.role === "assistant"))
    .map((m) => ({ role: m.role as "user" | "assistant", content: String(m.content ?? "") }));

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: buildSystemPrompt(
        userName,
        subscriptionData,
        budgetData,
        Number(monthlyTotal.toFixed(2)),
        categoryBreakdown
      ),
    },
    ...historyForModel,
  ];

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      max_tokens: 800,
    });
    const rawReply = completion.choices[0]?.message?.content ?? "I couldn't generate a response.";
    const extracted = extractTrailingJsonAction(rawReply);
    const replyText = extracted.text || rawReply;
    const action = extracted.action;

    if (!action) {
      const msg = chatMsg(rawReply);
      const final = [...withUser, msg];
      await prisma.aIConversation.update({
        where: { id: convo.id },
        data: { messages: toConversationJson(final) },
      });
      return NextResponse.json({ reply: rawReply, messages: final, conversationId: convo.id });
    }

    return await executeAction(action, replyText, user.id, withUser, convo.id, subs, budgets);
  } catch (e) {
    console.error("[/api/ai/chat]", e);
    return NextResponse.json({ error: "AI request failed" }, { status: 500 });
  }
}

// ─── Execute a pending (confirmed) action ─────────────────────────────────────

async function executePendingAction(
  action: ActionPayload,
  userId: string,
  withUser: ChatMessage[],
  convoId: string
): Promise<NextResponse | null> {
  const data = (action.data ?? {}) as Record<string, unknown>;

  // ── cancelSubscription ──
  if (action.action === "cancelSubscription" || action.action === "cancel") {
    const id = (data.id as string | undefined) ?? (action.subscriptionId as string | undefined);
    if (!id) return null;
    const target = await prisma.subscription.findFirst({ where: { id, userId } });
    if (!target) {
      const msg = chatMsg("That subscription no longer exists.");
      const final = [...withUser, msg];
      await prisma.aIConversation.update({
        where: { id: convoId },
        data: { messages: toConversationJson(final) },
      });
      return NextResponse.json({ reply: msg.content, messages: final, conversationId: convoId });
    }
    await prisma.subscription.delete({ where: { id: target.id } });
    const confirm = chatMsg(`${target.name} has been cancelled ✅`);
    const success = actionMsg(
      `✅ Cancelled **${target.name}** ($${target.price.toFixed(2)}/${target.billingCycle})\n\n[View in subscriptions →](/subscriptions)`,
      "/subscriptions"
    );
    const final = [...withUser, confirm, success];
    await prisma.aIConversation.update({
      where: { id: convoId },
      data: { messages: toConversationJson(final) },
    });
    return NextResponse.json({ reply: confirm.content, messages: final, actionPerformed: true, conversationId: convoId });
  }

  // ── deleteBudget ──
  if (action.action === "deleteBudget") {
    const id = data.id as string | undefined;
    if (!id) return null;
    const target = await prisma.budget.findFirst({ where: { id, userId } });
    if (!target) {
      const msg = chatMsg("That budget no longer exists.");
      const final = [...withUser, msg];
      await prisma.aIConversation.update({
        where: { id: convoId },
        data: { messages: toConversationJson(final) },
      });
      return NextResponse.json({ reply: msg.content, messages: final, conversationId: convoId });
    }
    await prisma.budget.delete({ where: { id: target.id } });
    const confirm = chatMsg(`Budget for **${target.category}** deleted ✅`);
    const success = actionMsg(
      `✅ Deleted **${target.category}** budget (was $${target.limit.toFixed(2)}/month)\n\n[View in analytics →](/analytics)`,
      "/analytics"
    );
    const final = [...withUser, confirm, success];
    await prisma.aIConversation.update({
      where: { id: convoId },
      data: { messages: toConversationJson(final) },
    });
    return NextResponse.json({ reply: confirm.content, messages: final, actionPerformed: true, conversationId: convoId });
  }

  // ── bulkPause ──
  if (action.action === "bulkPause") {
    const category = data.category as string | undefined;
    if (!category) return null;
    const targets = await prisma.subscription.findMany({
      where: { userId, category, status: "active" },
    });
    if (targets.length === 0) {
      const msg = chatMsg(`No active subscriptions found in the **${category}** category.`);
      const final = [...withUser, msg];
      await prisma.aIConversation.update({
        where: { id: convoId },
        data: { messages: toConversationJson(final) },
      });
      return NextResponse.json({ reply: msg.content, messages: final, conversationId: convoId });
    }
    await Promise.all(
      targets.map((t) => prisma.subscription.update({ where: { id: t.id }, data: { status: "paused" } }))
    );
    const names = targets.map((t) => t.name).join(", ");
    const confirm = chatMsg(`Paused ${targets.length} subscription(s) in **${category}**: ${names} ✅`);
    const success = actionMsg(
      `✅ Paused ${targets.length} **${category}** subscription(s)\n\n[View in subscriptions →](/subscriptions)`,
      "/subscriptions"
    );
    const final = [...withUser, confirm, success];
    await prisma.aIConversation.update({
      where: { id: convoId },
      data: { messages: toConversationJson(final) },
    });
    return NextResponse.json({ reply: confirm.content, messages: final, actionPerformed: true, conversationId: convoId });
  }

  // ── bulkCancel ──
  if (action.action === "bulkCancel") {
    const ids = (data.ids as string[] | undefined) ?? [];
    if (!ids.length) return null;
    const targets = await prisma.subscription.findMany({ where: { id: { in: ids }, userId } });
    if (targets.length === 0) {
      const msg = chatMsg("None of those subscriptions were found.");
      const final = [...withUser, msg];
      await prisma.aIConversation.update({
        where: { id: convoId },
        data: { messages: toConversationJson(final) },
      });
      return NextResponse.json({ reply: msg.content, messages: final, conversationId: convoId });
    }
    await prisma.subscription.deleteMany({ where: { id: { in: targets.map((t) => t.id) } } });
    const names = targets.map((t) => t.name).join(", ");
    const saved = targets.reduce((sum, t) => sum + pricePerMonth(t.price, t.billingCycle), 0);
    const confirm = chatMsg(
      `Cancelled ${targets.length} subscription(s): ${names}. You'll save $${saved.toFixed(2)}/month ✅`
    );
    const success = actionMsg(
      `✅ Cancelled ${targets.length} subscription(s) — saving **$${saved.toFixed(2)}/month**\n\n[View in subscriptions →](/subscriptions)`,
      "/subscriptions"
    );
    const final = [...withUser, confirm, success];
    await prisma.aIConversation.update({
      where: { id: convoId },
      data: { messages: toConversationJson(final) },
    });
    return NextResponse.json({ reply: confirm.content, messages: final, actionPerformed: true, conversationId: convoId });
  }

  return null;
}

// ─── Execute an immediate or confirmed action from OpenAI response ─────────────

async function executeAction(
  action: ActionPayload,
  replyText: string,
  userId: string,
  withUser: ChatMessage[],
  convoId: string,
  subs: Awaited<ReturnType<typeof prisma.subscription.findMany>>,
  budgets: Awaited<ReturnType<typeof prisma.budget.findMany>>
): Promise<NextResponse> {
  const data = (action.data ?? {}) as Record<string, unknown>;

  const save = async (msgs: ChatMessage[], actionPerformed = false) => {
    await prisma.aIConversation.update({
      where: { id: convoId },
      data: { messages: toConversationJson(msgs) },
    });
    const lastMsg = msgs[msgs.length - 1] as ChatMessage;
    return NextResponse.json({ reply: lastMsg.content, messages: msgs, actionPerformed, conversationId: convoId });
  };

  // ── Destructive: needs confirmation ──────────────────────────────────────────

  if (
    action.action === "cancelSubscription" ||
    action.action === "cancel" ||
    action.action === "deleteBudget" ||
    action.action === "bulkPause" ||
    action.action === "bulkCancel"
  ) {
    const msg = chatMsg(
      replyText || "Please confirm by typing **yes**.",
      { pendingAction: action }
    );
    const final = [...withUser, msg];
    return save(final, false);
  }

  // ── createSubscription ───────────────────────────────────────────────────────

  if (action.action === "createSubscription" || action.action === "create") {
    const name = (data.name as string | undefined) ?? (action.name as string | undefined) ?? "Subscription";
    const price = Number(data.price ?? action.price ?? 0);
    const billingCycle = toBillingCycle(
      (data.billingCycle as string | undefined) ?? (action.billingCycle as string | undefined) ?? "monthly",
    );
    const category = (data.category as string | undefined) ?? (action.category as string | undefined) ?? "Other";
    const notes = data.notes as string | undefined;
    const startDate = data.startDate ? new Date(data.startDate as string) : new Date();
    const nextRenewal = data.nextRenewal
      ? new Date(data.nextRenewal as string)
      : addCycle(startDate, billingCycle);

    let created: Awaited<ReturnType<typeof createSubscriptionForUser>>;
    try {
      created = await createSubscriptionForUser(userId, {
        name,
        price,
        billingCycle,
        category,
        startDate,
        nextRenewal,
        status: "active",
        source: "manual",
        isShared: false,
        notes,
      });
    } catch (e) {
      const limit = planLimitResponse(e);
      if (limit) return limit;
      throw e;
    }
    const chat = chatMsg(replyText || `Added **${created.name}** ✅`);
    const success = actionMsg(
      `✅ Added **${created.name}** ($${created.price.toFixed(2)}/${created.billingCycle})\n\n[View in subscriptions →](/subscriptions)`,
      "/subscriptions"
    );
    const final = [...withUser, chat, success];
    return save(final, true);
  }

  // ── editSubscription ─────────────────────────────────────────────────────────

  if (action.action === "editSubscription") {
    const id = data.id as string | undefined;
    const updates = (data.updates as Record<string, unknown>) ?? {};
    if (!id) {
      const msg = chatMsg("I need a subscription ID to edit. Please specify which subscription.");
      return save([...withUser, msg]);
    }
    const target = await prisma.subscription.findFirst({ where: { id, userId } });
    if (!target) {
      const msg = chatMsg("That subscription wasn't found.");
      return save([...withUser, msg]);
    }
    const updateData: Record<string, unknown> = {};
    if (updates.name)         updateData.name = String(updates.name);
    if (updates.price)        updateData.price = Number(updates.price);
    if (updates.category)     updateData.category = String(updates.category);
    if (updates.billingCycle) updateData.billingCycle = String(updates.billingCycle);
    if (updates.notes !== undefined) updateData.notes = String(updates.notes);
    if (updates.nextRenewal)  updateData.nextRenewal = new Date(updates.nextRenewal as string);
    const updated = await prisma.subscription.update({ where: { id: target.id }, data: updateData });
    const chat = chatMsg(replyText || `Updated **${updated.name}** ✅`);
    const success = actionMsg(
      `✅ Updated **${updated.name}**\n\n[View in subscriptions →](/subscriptions)`,
      "/subscriptions"
    );
    const final = [...withUser, chat, success];
    return save(final, true);
  }

  // ── pauseSubscription ────────────────────────────────────────────────────────

  if (action.action === "pauseSubscription" || action.action === "pause") {
    const id = (data.id as string | undefined) ?? (action.subscriptionId as string | undefined);
    if (!id) {
      const msg = chatMsg("Which subscription would you like to pause? Please be more specific.");
      return save([...withUser, msg]);
    }
    const target = await prisma.subscription.findFirst({ where: { id, userId } });
    if (!target) {
      const msg = chatMsg("That subscription wasn't found.");
      return save([...withUser, msg]);
    }
    await prisma.subscription.update({ where: { id: target.id }, data: { status: "paused" } });
    const chat = chatMsg(replyText || `Paused **${target.name}** ✅`);
    const success = actionMsg(
      `✅ Paused **${target.name}** ($${target.price.toFixed(2)}/${target.billingCycle})\n\n[View in subscriptions →](/subscriptions)`,
      "/subscriptions"
    );
    const final = [...withUser, chat, success];
    return save(final, true);
  }

  // ── resumeSubscription ───────────────────────────────────────────────────────

  if (action.action === "resumeSubscription" || action.action === "resume") {
    const id = (data.id as string | undefined) ?? (action.subscriptionId as string | undefined);
    if (!id) {
      const msg = chatMsg("Which subscription would you like to resume?");
      return save([...withUser, msg]);
    }
    const target = await prisma.subscription.findFirst({ where: { id, userId } });
    if (!target) {
      const msg = chatMsg("That subscription wasn't found.");
      return save([...withUser, msg]);
    }
    await prisma.subscription.update({ where: { id: target.id }, data: { status: "active" } });
    const chat = chatMsg(replyText || `Resumed **${target.name}** ✅`);
    const success = actionMsg(
      `✅ Resumed **${target.name}** ($${target.price.toFixed(2)}/${target.billingCycle})\n\n[View in subscriptions →](/subscriptions)`,
      "/subscriptions"
    );
    const final = [...withUser, chat, success];
    return save(final, true);
  }

  // ── createBudget ─────────────────────────────────────────────────────────────

  if (action.action === "createBudget") {
    const category = data.category as string | undefined;
    const limit = Number(data.limit ?? 0);
    if (!category || limit <= 0) {
      const msg = chatMsg("I need a category and a positive limit to create a budget.");
      return save([...withUser, msg]);
    }
    const existing = budgets.find((b) => b.category === category);
    if (existing) {
      // Update instead of duplicate
      await prisma.budget.update({ where: { id: existing.id }, data: { limit } });
      const chat = chatMsg(replyText || `Updated **${category}** budget to $${limit.toFixed(2)}/month ✅`);
      const success = actionMsg(
        `✅ Updated **${category}** budget → $${limit.toFixed(2)}/month\n\n[View in analytics →](/analytics)`,
        "/analytics"
      );
      return save([...withUser, chat, success], true);
    }
    const created = await prisma.budget.create({
      data: { userId, category, limit, period: "monthly" },
    });
    const chat = chatMsg(replyText || `Created **${created.category}** budget at $${created.limit.toFixed(2)}/month ✅`);
    const success = actionMsg(
      `✅ Created **${created.category}** budget — $${created.limit.toFixed(2)}/month\n\n[View in analytics →](/analytics)`,
      "/analytics"
    );
    const final = [...withUser, chat, success];
    return save(final, true);
  }

  // ── updateBudget ─────────────────────────────────────────────────────────────

  if (action.action === "updateBudget") {
    const id = data.id as string | undefined;
    const limit = Number(data.limit ?? 0);
    if (!id || limit <= 0) {
      const msg = chatMsg("I need a budget ID and a positive limit to update.");
      return save([...withUser, msg]);
    }
    const target = await prisma.budget.findFirst({ where: { id, userId } });
    if (!target) {
      const msg = chatMsg("That budget wasn't found.");
      return save([...withUser, msg]);
    }
    const updated = await prisma.budget.update({ where: { id: target.id }, data: { limit } });
    const chat = chatMsg(replyText || `Updated **${updated.category}** budget to $${updated.limit.toFixed(2)}/month ✅`);
    const success = actionMsg(
      `✅ Updated **${updated.category}** budget → $${updated.limit.toFixed(2)}/month\n\n[View in analytics →](/analytics)`,
      "/analytics"
    );
    const final = [...withUser, chat, success];
    return save(final, true);
  }

  // ── Fallback: no recognized action — treat as plain chat ─────────────────────

  const msg = chatMsg(replyText);
  const final = [...withUser, msg];
  await prisma.aIConversation.update({
    where: { id: convoId },
    data: { messages: toConversationJson(final) },
  });
  return NextResponse.json({ reply: replyText, messages: final, conversationId: convoId });
}

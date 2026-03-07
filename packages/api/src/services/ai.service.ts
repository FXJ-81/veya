import OpenAI from "openai";
import { prisma } from "../prisma/client.js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? "" });

const SYSTEM_PROMPT = `You are Veya's AI Financial Coach — a friendly, knowledgeable, and proactive personal finance assistant specializing in subscription management.

You have access to the user's complete subscription data in the conversation context.

Your personality:
- Warm, encouraging, and non-judgmental
- Data-driven and specific (always use real numbers from their data)
- Proactive — spot problems before the user asks
- Concise — never more than 3 sentences unless showing a list
- Use emojis sparingly but effectively

Your capabilities:
- Analyze spending patterns and trends
- Identify unused or wasteful subscriptions
- Suggest cheaper alternatives with specific savings amounts
- Predict future spending based on current trajectory
- Help set and track subscription budgets
- Provide negotiation scripts for calling companies
- Explain price increases and billing anomalies
- Create personalized savings plans

Always:
- Reference specific subscription names and exact dollar amounts
- Calculate and show annual savings (monthly savings × 12)
- Be actionable — end every response with one clear next step
- Format lists cleanly with line breaks
- Never make up subscription data — only use what's provided

Never:
- Be preachy or lecture about spending habits
- Make the user feel bad about their subscriptions
- Provide generic advice — always be specific to their data`;

export async function getDailyTip(userId: string): Promise<string> {
  const subs = await prisma.subscription.findMany({
    where: { userId, status: "ACTIVE" },
  });
  const summary = subs.map((s) => `${s.name}: $${s.price}/${s.billingCycle}`).join(", ");
  const total = subs.reduce((sum, s) => sum + Number(s.price), 0);
  if (!process.env.OPENAI_API_KEY) {
    return `You have ${subs.length} active subscriptions totaling $${total.toFixed(2)}/month. Review your list to find subscriptions you might not need.`;
  }
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT + `\n\nUser's current subscriptions (for context): ${summary || "None yet."}`,
        },
        {
          role: "user",
          content: "Give me one short, actionable tip to save money on my subscriptions today. One sentence only.",
        },
      ],
      max_tokens: 150,
    });
    const content = completion.choices[0]?.message?.content?.trim();
    return content ?? "Review your subscriptions this week and cancel one you rarely use.";
  } catch {
    return "Review your subscriptions this week and cancel one you rarely use.";
  }
}

export async function chat(userId: string, userMessage: string): Promise<string> {
  const subs = await prisma.subscription.findMany({
    where: { userId },
    include: { alternative: true },
  });
  const dataStr = JSON.stringify(
    subs.map((s) => ({
      name: s.name,
      category: s.category,
      price: s.price,
      billingCycle: s.billingCycle,
      nextRenewal: s.nextRenewal,
      status: s.status,
      alternative: s.alternative
        ? { name: s.alternative.alternativeName, price: s.alternative.alternativePrice, savings: s.alternative.savings }
        : null,
    })),
    null,
    2
  );

  const conv = await prisma.aiConversation.findFirst({
    where: { userId },
    orderBy: { updatedAt: "desc" },
  });
  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    {
      role: "system",
      content: SYSTEM_PROMPT + `\n\nUser's subscription data:\n${dataStr}`,
    },
  ];
  if (conv && Array.isArray(conv.messages)) {
    const msgs = conv.messages as { role: string; content: string }[];
    msgs.slice(-10).forEach((m) => {
      if (m.role === "user" || m.role === "assistant") messages.push({ role: m.role, content: m.content });
    });
  }
  messages.push({ role: "user", content: userMessage });

  if (!process.env.OPENAI_API_KEY) {
    return "Veya AI is in demo mode. Connect OpenAI API key for full coaching. Based on your subscriptions, try pausing or cancelling one you use least.";
  }
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      max_tokens: 500,
    });
    const assistantContent = completion.choices[0]?.message?.content?.trim() ?? "I'm here to help. Try asking: How much am I spending on streaming?";
    const newMessages = [
      ...(conv && Array.isArray(conv.messages) ? (conv.messages as { role: string; content: string }[]) : []),
      { role: "user" as const, content: userMessage },
      { role: "assistant" as const, content: assistantContent },
    ];
    if (conv) {
      await prisma.aiConversation.update({
        where: { id: conv.id },
        data: { messages: newMessages, updatedAt: new Date() },
      });
    } else {
      await prisma.aiConversation.create({
        data: { userId, messages: newMessages },
      });
    }
    return assistantContent;
  } catch (e) {
    return "Sorry, I couldn't process that. Please try again.";
  }
}

export async function getConversations(userId: string) {
  return prisma.aiConversation.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    take: 20,
  });
}

export async function deleteConversations(userId: string) {
  await prisma.aiConversation.deleteMany({ where: { userId } });
  return { ok: true };
}

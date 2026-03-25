import { prisma } from "@/lib/prisma";
import { type DiscoverSuggestion } from "@/lib/parseSubscriptionEmail";
import { google } from "googleapis";
import type { gmail_v1 } from "googleapis";
import { DOMAIN_CATALOG, normalizeSenderDomain } from "@/lib/knownSubscriptionDomains";
import {
  analyzeUnclearSubscriptionEmail,
  buildLogoUrlForDomain,
  extractEmailDomain,
  extractPricesFromText,
  extractSenderDisplayName,
  inferBillingCycle,
  parseDateFromEmail,
  pickReasonablePrice,
  resolveServiceNameAndCategory,
  SUBSCRIPTION_KEYWORD_RE,
} from "@/lib/subscriptionEmailAnalyze";

export function normalizeSubName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Gmail access: dedicated connect flow or Google sign-in with Gmail scope */
export async function getAccountWithGmailAccess(userId: string) {
  const gmailOnly = await prisma.account.findFirst({
    where: { userId, provider: "google-gmail", refresh_token: { not: null } },
  });
  if (gmailOnly) return gmailOnly;
  return prisma.account.findFirst({
    where: { userId, provider: "google", refresh_token: { not: null } },
  });
}

const MAX_MESSAGES = 1000;
const OPENAI_CAP = 25;
const FETCH_CONCURRENCY = 8;

const gmailScanLocks = new Map<string, Promise<{ suggestions: DiscoverSuggestion[]; connected: boolean; error?: string }>>();

function collectBodyText(part: gmail_v1.Schema$MessagePart | undefined): string {
  if (!part) return "";
  const chunks: string[] = [];
  if (part.body?.data) {
    const mt = part.mimeType ?? "";
    if (mt === "text/plain" || mt === "text/html") {
      try {
        const raw = Buffer.from(part.body.data, "base64url").toString("utf-8");
        chunks.push(mt === "text/html" ? raw.replace(/<[^>]+>/g, " ") : raw);
      } catch {
        // ignore
      }
    }
  }
  if (part.parts) {
    for (const p of part.parts) {
      chunks.push(collectBodyText(p));
    }
  }
  return chunks.join("\n");
}

function buildSearchQueries(afterStr: string): string[] {
  return [
    `after:${afterStr} subscription receipt`,
    `after:${afterStr} billing invoice payment`,
    `after:${afterStr} your subscription`,
    `after:${afterStr} monthly charge`,
    `after:${afterStr} (from:openai.com OR from:apple.com OR from:netflix.com OR from:spotify.com OR from:google.com OR from:amazon.com OR from:hulu.com OR from:disneyplus.com OR from:microsoft.com OR from:adobe.com OR from:dropbox.com OR from:notion.so OR from:github.com OR from:linkedin.com OR from:duolingo.com OR from:nytimes.com OR from:claude.ai OR from:anthropic.com)`,
  ];
}

async function listMessageIds(
  gmail: gmail_v1.Gmail,
  q: string,
  cap: number
): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;
  while (ids.length < cap) {
    const take = Math.min(500, cap - ids.length);
    const res = await gmail.users.messages.list({
      userId: "me",
      q,
      maxResults: take,
      pageToken,
    });
    const batch = res.data.messages ?? [];
    for (const m of batch) {
      if (m.id && ids.length < cap) ids.push(m.id);
    }
    pageToken = res.data.nextPageToken ?? undefined;
    if (!pageToken || batch.length === 0) break;
  }
  return ids;
}

async function parseMessageToSuggestion(
  gmail: gmail_v1.Gmail,
  messageId: string,
  openaiBudget: { n: number }
): Promise<DiscoverSuggestion | null> {
  let msgRes: gmail_v1.Schema$Message;
  try {
    const res = await gmail.users.messages.get({
      userId: "me",
      id: messageId,
      format: "full",
    });
    msgRes = res.data;
  } catch {
    return null;
  }

  const payload = msgRes.payload;
  const headers = payload?.headers ?? [];
  const subject = headers.find((h) => h.name?.toLowerCase() === "subject")?.value ?? "";
  const from = headers.find((h) => h.name?.toLowerCase() === "from")?.value ?? "";
  const snippet = msgRes.snippet ?? "";
  const internalMs = msgRes.internalDate ? parseInt(msgRes.internalDate, 10) : undefined;

  const bodyText = collectBodyText(payload).slice(0, 12_000);
  const combined = `${subject}\n${snippet}\n${bodyText}`;

  const rawDomain = extractEmailDomain(from);
  const catalogRoot = rawDomain ? normalizeSenderDomain(rawDomain) : null;
  const inCatalog = !!(catalogRoot && DOMAIN_CATALOG[catalogRoot]);

  const hasKeyword = SUBSCRIPTION_KEYWORD_RE.test(combined);
  const amounts = extractPricesFromText(combined);

  if (!inCatalog && !hasKeyword) return null;
  if (inCatalog && !hasKeyword && amounts.length === 0) {
    let ai: Awaited<ReturnType<typeof analyzeUnclearSubscriptionEmail>> = null;
    if (openaiBudget.n < OPENAI_CAP) {
      openaiBudget.n += 1;
      ai = await analyzeUnclearSubscriptionEmail(subject, bodyText.slice(0, 200) || snippet);
    }
    const dates = parseDateFromEmail(combined, internalMs);
    if (ai) {
      const bc =
        ai.billingCycle === "yearly" || ai.billingCycle === "weekly" ? ai.billingCycle : "monthly";
      return {
        name: ai.name,
        category: ai.category,
        price: ai.price,
        billingCycle: bc,
        nextRenewal: dates.nextRenewal,
        startDate: dates.startDate,
        logoUrl: buildLogoUrlForDomain(rawDomain ?? catalogRoot ?? "google.com"),
      };
    }
    const resolved = resolveServiceNameAndCategory(catalogRoot!, subject, combined);
    const hint = DOMAIN_CATALOG[catalogRoot!]?.priceHint ?? 9.99;
    const billingCycle = inferBillingCycle(combined, hint);
    return {
      name: resolved.name,
      category: resolved.category,
      price: hint,
      billingCycle,
      nextRenewal: dates.nextRenewal,
      startDate: dates.startDate,
      logoUrl: buildLogoUrlForDomain(rawDomain ?? catalogRoot ?? "google.com"),
    };
  }

  let price = pickReasonablePrice(
    amounts,
    inCatalog && catalogRoot ? DOMAIN_CATALOG[catalogRoot]?.priceHint : undefined
  );

  let name: string;
  let category: string;

  if (inCatalog && catalogRoot) {
    const resolved = resolveServiceNameAndCategory(catalogRoot, subject, combined);
    name = resolved.name;
    category = resolved.category;
  } else {
    name = extractSenderDisplayName(from);
    if (name.length < 2 && rawDomain) {
      const base = rawDomain.split(".")[0] ?? rawDomain;
      name = base.charAt(0).toUpperCase() + base.slice(1);
    }
    category = "Other";
  }

  if (price === 0) {
    if (openaiBudget.n < OPENAI_CAP) {
      openaiBudget.n += 1;
      const ai = await analyzeUnclearSubscriptionEmail(subject, bodyText.slice(0, 200) || snippet);
      if (ai) {
        name = ai.name;
        category = ai.category;
        price = ai.price;
      }
    }
    if (price === 0 && inCatalog && catalogRoot) {
      const hint = DOMAIN_CATALOG[catalogRoot]?.priceHint;
      price = hint ?? 9.99;
    }
  }

  if (price === 0) return null;

  const billingCycle = inferBillingCycle(combined, price);
  const dates = parseDateFromEmail(combined, internalMs);
  const logoDomain = catalogRoot ?? rawDomain ?? "google.com";

  return {
    name,
    category,
    price,
    billingCycle,
    nextRenewal: dates.nextRenewal,
    startDate: dates.startDate,
    logoUrl: buildLogoUrlForDomain(logoDomain),
  };
}

async function runPool<T>(
  items: string[],
  concurrency: number,
  worker: (id: string) => Promise<T | null>
): Promise<T[]> {
  const out: T[] = [];
  let index = 0;

  async function runOne() {
    while (index < items.length) {
      const i = index++;
      const id = items[i]!;
      const r = await worker(id);
      if (r !== null) out.push(r);
    }
  }

  const runners = Array.from({ length: Math.min(concurrency, items.length || 1) }, () => runOne());
  await Promise.all(runners);
  return out;
}

async function scanGmailInboxInternal(
  userId: string
): Promise<{ suggestions: DiscoverSuggestion[]; connected: boolean; error?: string }> {
  const account = await getAccountWithGmailAccess(userId);
  if (!account?.refresh_token) {
    return { suggestions: [], connected: false };
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const redirectUri = `${baseUrl}/api/auth/callback/google`;
  if (!clientId || !clientSecret) {
    return { suggestions: [], connected: true, error: "Gmail not configured" };
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  oauth2Client.setCredentials({
    refresh_token: account.refresh_token,
    access_token: account.access_token ?? undefined,
  });

  if (account.expires_at && account.expires_at * 1000 < Date.now() + 60_000) {
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      if (credentials.access_token) {
        await prisma.account.update({
          where: { id: account.id },
          data: {
            access_token: credentials.access_token,
            expires_at: credentials.expiry_date ? Math.floor(credentials.expiry_date / 1000) : null,
          },
        });
      }
    } catch {
      return {
        suggestions: [],
        connected: false,
        error: "Gmail session expired. Please connect Gmail again.",
      };
    }
  }

  try {
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    const after = new Date();
    after.setMonth(after.getMonth() - 24);
    const y = after.getFullYear();
    const mo = String(after.getMonth() + 1).padStart(2, "0");
    const day = String(after.getDate()).padStart(2, "0");
    const afterStr = `${y}/${mo}/${day}`;

    const idSet = new Set<string>();
    for (const q of buildSearchQueries(afterStr)) {
      const ids = await listMessageIds(gmail, q, MAX_MESSAGES - idSet.size);
      for (const id of ids) {
        idSet.add(id);
        if (idSet.size >= MAX_MESSAGES) break;
      }
      if (idSet.size >= MAX_MESSAGES) break;
    }

    const messageIds = [...idSet];
    const openaiBudget = { n: 0 };

    const rawSuggestions = await runPool(messageIds, FETCH_CONCURRENCY, (id) =>
      parseMessageToSuggestion(gmail, id, openaiBudget)
    );

    const seen = new Set<string>();
    const deduped: DiscoverSuggestion[] = [];
    for (const s of rawSuggestions) {
      const key = normalizeSubName(s.name);
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(s);
    }

    return { suggestions: deduped, connected: true };
  } catch (e) {
    console.error("[gmailScan] Gmail API error:", e);
    return {
      suggestions: [],
      connected: true,
      error: "Failed to scan inbox. Try again or reconnect Gmail.",
    };
  }
}

export async function scanGmailInbox(
  userId: string
): Promise<{ suggestions: DiscoverSuggestion[]; connected: boolean; error?: string }> {
  const existing = gmailScanLocks.get(userId);
  if (existing) return existing;

  const p = scanGmailInboxInternal(userId);
  gmailScanLocks.set(userId, p);
  try {
    return await p;
  } finally {
    gmailScanLocks.delete(userId);
  }
}

export type GmailImportResult = {
  imported: number;
  updated: number;
  skippedDuplicates: number;
  newNames: string[];
  skippedNames: string[];
};

export async function importSuggestionsAsSubscriptions(
  userId: string,
  suggestions: DiscoverSuggestion[]
): Promise<GmailImportResult> {
  const existing = await prisma.subscription.findMany({
    where: { userId, status: { in: ["active", "paused"] } },
    select: { id: true, name: true, price: true, logoUrl: true, category: true },
  });

  const byNorm = new Map<string, (typeof existing)[0]>();
  for (const row of existing) {
    byNorm.set(normalizeSubName(row.name), row);
  }

  let imported = 0;
  let updated = 0;
  const newNames: string[] = [];
  const skippedNames: string[] = [];

  for (const s of suggestions) {
    const key = normalizeSubName(s.name);
    const row = byNorm.get(key);

    if (row) {
      skippedNames.push(s.name);
      const price = s.price > 0 ? s.price : row.price;
      const patch: { price?: number; logoUrl?: string | null; category?: string } = {};
      if (Math.abs(row.price - price) > 0.009) {
        patch.price = price;
      }
      if (s.logoUrl && !row.logoUrl) {
        patch.logoUrl = s.logoUrl;
      }
      if (s.category && s.category !== row.category) {
        patch.category = s.category;
      }
      if (Object.keys(patch).length > 0) {
        await prisma.subscription.update({
          where: { id: row.id },
          data: patch,
        });
        if (patch.price !== undefined) updated++;
      }
      continue;
    }

    const price = s.price > 0 ? s.price : 9.99;
    await prisma.subscription.create({
      data: {
        userId,
        name: s.name,
        category: s.category || "Other",
        price,
        billingCycle: s.billingCycle,
        startDate: new Date(s.startDate),
        nextRenewal: new Date(s.nextRenewal),
        status: "active",
        notes: "Found via Gmail scan",
        logoUrl: s.logoUrl ?? null,
      },
    });
    byNorm.set(key, {
      id: "local",
      name: s.name,
      price,
      logoUrl: s.logoUrl ?? null,
      category: s.category,
    });
    imported++;
    newNames.push(s.name);
  }

  return {
    imported,
    updated,
    skippedDuplicates: skippedNames.length,
    newNames,
    skippedNames,
  };
}

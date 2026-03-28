import { prisma } from "@/lib/prisma";
import { google } from "googleapis";
import type { gmail_v1 } from "googleapis";
import { clearbitLogoUrl, normalizeSenderDomain } from "@/lib/knownSubscriptionDomains";
import { parseDateFromEmail, extractSenderDisplayName } from "@/lib/subscriptionEmailAnalyze";
import type { DiscoverSuggestion } from "@/lib/parseSubscriptionEmail";
import { scoreSubscription } from "@/lib/emailSubscription/scoreSubscription";
import { normalizeEmailBody, stripHtmlToPlain } from "@/lib/emailSubscription/normalize";
import { resolveServiceNameAndCategory } from "@/lib/emailSubscription/resolveMerchant";

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

const MAX_TOTAL_IDS = 320;
const PER_QUERY_CAP = 36;
const FETCH_CONCURRENCY = 6;

/** Minimum score to allow generic merchant name fallback when catalog resolver returns null */
const MERCHANT_FALLBACK_MIN_SCORE = 52;

const STRICT_PRICE_RE = /\$\s*(\d{1,3}(?:,\d{3})*|\d+)(?:\.(\d{2}))?\b/g;

const gmailScanLocks = new Map<
  string,
  Promise<{ candidates: GmailScanCandidate[]; connected: boolean; error?: string }>
>();

const importLocks = new Map<string, Promise<GmailImportResult>>();

export type GmailScanCandidate = {
  messageId: string;
  name: string;
  category: string;
  price: number;
  billingCycle: "monthly" | "yearly";
  monthlyEquivalent: number;
  logoUrl: string;
  emailDate: string;
  senderDomain: string;
};

export type GmailImportResult = {
  imported: number;
  updated: number;
  skippedDuplicates: number;
  newNames: string[];
  skippedNames: string[];
};

function gmailSearchQueries(afterStr: string): string[] {
  return [
    `after:${afterStr} from:apple.com subject:(receipt OR invoice OR subscription)`,
    `after:${afterStr} from:openai.com subject:(receipt OR invoice OR subscription)`,
    `after:${afterStr} from:netflix.com subject:(receipt OR invoice)`,
    `after:${afterStr} from:spotify.com subject:(receipt OR invoice)`,
    `after:${afterStr} from:google.com subject:(Google One OR YouTube Premium OR receipt)`,
    `after:${afterStr} from:amazon.com subject:(Prime OR membership)`,
    `after:${afterStr} from:hulu.com subject:(receipt OR invoice)`,
    `after:${afterStr} from:disneyplus.com subject:(receipt OR invoice)`,
    `after:${afterStr} from:microsoft.com subject:(subscription OR receipt)`,
    `after:${afterStr} from:adobe.com subject:(receipt OR invoice)`,
    `after:${afterStr} from:dropbox.com subject:(receipt OR invoice)`,
    `after:${afterStr} from:github.com subject:(receipt OR invoice)`,
    `after:${afterStr} from:anthropic.com subject:(receipt OR invoice)`,
    // Broader billing phrases — scoring pipeline filters false positives
    `after:${afterStr} subject:(membership renewed OR "auto-renew" OR "recurring payment")`,
    `after:${afterStr} subject:("next billing" OR "upcoming charge" OR "plan renewed")`,
  ];
}

/**
 * Walk MIME parts; use stronger HTML stripping than a single tag regex for scoring input.
 */
function collectBodyText(part: gmail_v1.Schema$MessagePart | undefined): string {
  if (!part) return "";
  const chunks: string[] = [];
  if (part.body?.data) {
    const mt = part.mimeType ?? "";
    if (mt === "text/plain" || mt === "text/html") {
      try {
        const raw = Buffer.from(part.body.data, "base64url").toString("utf-8");
        chunks.push(mt === "text/html" ? stripHtmlToPlain(raw) : raw);
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

function extractStrictDollarAmount(subject: string, bodyWindow: string): number | null {
  for (const text of [subject, bodyWindow]) {
    STRICT_PRICE_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = STRICT_PRICE_RE.exec(text)) !== null) {
      const intPart = (m[1] ?? "").replace(/,/g, "");
      const dec = m[2];
      const val = dec !== undefined ? parseFloat(`${intPart}.${dec}`) : parseFloat(intPart);
      if (Number.isFinite(val) && val >= 0.49 && val <= 200) {
        return Math.round(val * 100) / 100;
      }
    }
  }
  return null;
}

function inferBillingCycle(subject: string, bodyHead: string, amount: number): "monthly" | "yearly" {
  const s = `${subject}\n${bodyHead}`.toLowerCase();
  if (/\b(annual|yearly|year)\b/.test(s)) return "yearly";
  const cents = Math.round(amount * 100);
  if (amount > 50 && cents % 1200 === 0) return "yearly";
  return "monthly";
}

function monthlyEquivalent(price: number, cycle: "monthly" | "yearly"): number {
  return cycle === "yearly" ? price / 12 : price;
}

function passesSubscriptionPriceRules(price: number, cycle: "monthly" | "yearly"): boolean {
  if (price < 0.49 || price > 200) return false;
  const eq = monthlyEquivalent(price, cycle);
  return eq >= 0.49 && eq <= 99.99;
}

function extractEmailDomain(fromHeader: string): string | null {
  const emailMatch = fromHeader.match(/<([^>]+)>/);
  const email = emailMatch ? emailMatch[1] : fromHeader;
  const at = email.lastIndexOf("@");
  if (at === -1) return null;
  return email.slice(at + 1).trim().toLowerCase();
}

async function listMessageIdsForQuery(
  gmail: gmail_v1.Gmail,
  q: string,
  cap: number
): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;
  while (ids.length < cap) {
    const take = Math.min(50, cap - ids.length);
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

export async function parseGmailMessageToCandidate(
  gmail: gmail_v1.Gmail,
  messageId: string
): Promise<GmailScanCandidate | null> {
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
  const internalMs = msgRes.internalDate ? parseInt(msgRes.internalDate, 10) : undefined;
  const snippet = msgRes.snippet ?? "";

  const rawBody = collectBodyText(payload);
  const bodyNorm = normalizeEmailBody(rawBody);

  const scored = scoreSubscription({
    fromHeader: from,
    subject,
    bodyText: rawBody,
    snippet,
  });

  if (scored.hardReject || !scored.isSubscription) {
    return null;
  }

  const rawDomain = extractEmailDomain(from);
  if (!rawDomain) return null;
  const root = normalizeSenderDomain(rawDomain);
  if (!root) return null;

  const bodyLower = bodyNorm.toLowerCase();
  let resolved = resolveServiceNameAndCategory(root, subject, bodyLower);
  if (!resolved) {
    if (scored.score < MERCHANT_FALLBACK_MIN_SCORE) return null;
    const display = extractSenderDisplayName(from);
    const name =
      display.length >= 2 ? display : root.split(".")[0]!.replace(/^\w/, (c) => c.toUpperCase());
    resolved = { name, category: "Other" };
  }

  const billingWindow = bodyNorm.slice(0, 8000);
  const amount = extractStrictDollarAmount(subject, billingWindow);
  if (amount === null) return null;

  const billingCycle = inferBillingCycle(subject, billingWindow.slice(0, 2500), amount);
  if (!passesSubscriptionPriceRules(amount, billingCycle)) return null;

  const emailDate = internalMs
    ? new Date(internalMs).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  return {
    messageId,
    name: resolved.name,
    category: resolved.category,
    price: amount,
    billingCycle,
    monthlyEquivalent: monthlyEquivalent(amount, billingCycle),
    logoUrl: clearbitLogoUrl(root),
    emailDate,
    senderDomain: root,
  };
}

function dedupeCandidates(rows: GmailScanCandidate[]): GmailScanCandidate[] {
  const best = new Map<string, GmailScanCandidate>();
  for (const c of rows) {
    const key = `${normalizeSubName(c.name)}|${c.billingCycle}`;
    const prev = best.get(key);
    if (!prev || c.emailDate > prev.emailDate) best.set(key, c);
  }
  return [...best.values()].sort((a, b) => a.name.localeCompare(b.name));
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

async function getGmailClientForUser(
  userId: string
): Promise<
  | { ok: true; gmail: gmail_v1.Gmail }
  | { ok: false; connected: boolean; error?: string }
> {
  const account = await getAccountWithGmailAccess(userId);
  if (!account?.refresh_token) {
    return { ok: false, connected: false };
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const redirectUri = `${baseUrl}/api/auth/callback/google`;
  if (!clientId || !clientSecret) {
    return { ok: false, connected: true, error: "Gmail not configured" };
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
        ok: false,
        connected: false,
        error: "Gmail session expired. Please connect Gmail again.",
      };
    }
  }

  return { ok: true, gmail: google.gmail({ version: "v1", auth: oauth2Client }) };
}

async function scanGmailInboxInternal(
  userId: string
): Promise<{ candidates: GmailScanCandidate[]; connected: boolean; error?: string }> {
  const client = await getGmailClientForUser(userId);
  if (!client.ok) {
    return { candidates: [], connected: client.connected, error: client.error };
  }
  const { gmail } = client;

  try {
    const after = new Date();
    after.setMonth(after.getMonth() - 24);
    const y = after.getFullYear();
    const mo = String(after.getMonth() + 1).padStart(2, "0");
    const day = String(after.getDate()).padStart(2, "0");
    const afterStr = `${y}/${mo}/${day}`;

    const idSet = new Set<string>();
    for (const q of gmailSearchQueries(afterStr)) {
      const room = MAX_TOTAL_IDS - idSet.size;
      if (room <= 0) break;
      const ids = await listMessageIdsForQuery(gmail, q, Math.min(PER_QUERY_CAP, room));
      for (const id of ids) {
        idSet.add(id);
        if (idSet.size >= MAX_TOTAL_IDS) break;
      }
    }

    const messageIds = [...idSet];
    const raw = await runPool(messageIds, FETCH_CONCURRENCY, (id) =>
      parseGmailMessageToCandidate(gmail, id)
    );
    const candidates = dedupeCandidates(raw);

    return { candidates, connected: true };
  } catch (e) {
    console.error("[gmailScan] Gmail API error:", e);
    return {
      candidates: [],
      connected: true,
      error: "Failed to scan inbox. Try again or reconnect Gmail.",
    };
  }
}

export async function scanGmailInbox(userId: string): Promise<{
  candidates: GmailScanCandidate[];
  connected: boolean;
  error?: string;
}> {
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

/** Back-compat shape for GET /api/subscriptions/scan-email */
export function candidateToDiscoverSuggestion(c: GmailScanCandidate): DiscoverSuggestion {
  const internalMs = Date.parse(`${c.emailDate}T12:00:00Z`);
  const dates = parseDateFromEmail("", Number.isNaN(internalMs) ? undefined : internalMs);
  return {
    name: c.name,
    category: c.category,
    price: c.price,
    billingCycle: c.billingCycle,
    nextRenewal: dates.nextRenewal,
    startDate: dates.startDate,
    logoUrl: c.logoUrl,
  };
}

async function importGmailMessageIdsInternal(
  userId: string,
  messageIds: string[]
): Promise<GmailImportResult> {
  const client = await getGmailClientForUser(userId);
  if (!client.ok) {
    return { imported: 0, updated: 0, skippedDuplicates: 0, newNames: [], skippedNames: [] };
  }
  const { gmail } = client;

  const existing = await prisma.subscription.findMany({
    where: { userId, status: { in: ["active", "paused"] } },
    select: { name: true },
  });

  const existingNorm = new Set(existing.map((r) => normalizeSubName(r.name)));

  let imported = 0;
  const newNames: string[] = [];
  const skippedNames: string[] = [];

  const uniqueIds = [...new Set(messageIds)];

  for (const mid of uniqueIds) {
    const c = await parseGmailMessageToCandidate(gmail, mid);
    if (!c) continue;

    const key = normalizeSubName(c.name);
    if (existingNorm.has(key)) {
      skippedNames.push(c.name);
      continue;
    }

    const internalMs = Date.parse(`${c.emailDate}T12:00:00Z`);
    const dates = parseDateFromEmail("", Number.isNaN(internalMs) ? undefined : internalMs);

    await prisma.subscription.create({
      data: {
        userId,
        name: c.name,
        category: c.category,
        price: c.price,
        billingCycle: c.billingCycle,
        startDate: new Date(dates.startDate),
        nextRenewal: new Date(dates.nextRenewal),
        status: "active",
        notes: "Added from Gmail",
        logoUrl: c.logoUrl ?? null,
        source: "gmail",
      },
    });
    existingNorm.add(key);
    imported++;
    newNames.push(c.name);
  }

  return {
    imported,
    updated: 0,
    skippedDuplicates: skippedNames.length,
    newNames,
    skippedNames,
  };
}

export async function importGmailMessageIds(
  userId: string,
  messageIds: string[]
): Promise<GmailImportResult> {
  const key = `${userId}:import`;
  const existing = importLocks.get(key);
  if (existing) return existing;

  const p = importGmailMessageIdsInternal(userId, messageIds);
  importLocks.set(key, p);
  try {
    return await p;
  } finally {
    importLocks.delete(key);
  }
}

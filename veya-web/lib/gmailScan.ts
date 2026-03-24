import { prisma } from "@/lib/prisma";
import {
  parseSubscriptionEmailText,
  type DiscoverSuggestion,
} from "@/lib/parseSubscriptionEmail";
import { google } from "googleapis";

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

export async function scanGmailInbox(
  userId: string
): Promise<{ suggestions: DiscoverSuggestion[]; connected: boolean; error?: string }> {
  const account = await getAccountWithGmailAccess(userId);
  if (!account?.refresh_token) {
    return { suggestions: [], connected: false };
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const redirectUri = `${baseUrl}/api/auth/connect-gmail/callback`;
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
    const listRes = await gmail.users.messages.list({
      userId: "me",
      q: "subscription OR receipt OR billing OR renewal OR \"your payment\" OR \"monthly charge\"",
      maxResults: 25,
    });
    const messages = listRes.data.messages ?? [];
    const textParts: string[] = [];
    for (const m of messages.slice(0, 15)) {
      try {
        const msgRes = await gmail.users.messages.get({ userId: "me", id: m.id! });
        const snippet = msgRes.data.snippet;
        const payload = msgRes.data.payload;
        if (snippet) textParts.push(snippet);
        if (payload?.headers) {
          const subj = payload.headers.find((h) => h.name?.toLowerCase() === "subject")?.value ?? "";
          const from = payload.headers.find((h) => h.name?.toLowerCase() === "from")?.value ?? "";
          textParts.push(`Subject: ${subj} From: ${from}`);
        }
        if (payload?.body?.data) {
          try {
            const body = Buffer.from(payload.body.data, "base64url").toString("utf-8");
            textParts.push(body.slice(0, 2000));
          } catch {
            // ignore
          }
        }
        if (payload?.parts) {
          for (const part of payload.parts) {
            if (part.body?.data && (part.mimeType === "text/plain" || part.mimeType === "text/html")) {
              try {
                const partBody = Buffer.from(part.body.data, "base64url").toString("utf-8");
                textParts.push(partBody.slice(0, 3000).replace(/<[^>]+>/g, " "));
              } catch {
                // ignore
              }
            }
          }
        }
      } catch {
        // skip message
      }
    }
    const combined = textParts.join("\n");
    const suggestions = parseSubscriptionEmailText(combined);
    const seen = new Set<string>();
    const deduped = suggestions.filter((s) => {
      const key = `${normalizeSubName(s.name)}-${s.category}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
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

export async function importSuggestionsAsSubscriptions(
  userId: string,
  suggestions: DiscoverSuggestion[]
): Promise<{ imported: number }> {
  const existing = await prisma.subscription.findMany({
    where: { userId, status: { in: ["active", "paused"] } },
    select: { name: true },
  });
  const existingNorm = new Set(existing.map((e) => normalizeSubName(e.name)));

  let imported = 0;
  for (const s of suggestions) {
    const key = normalizeSubName(s.name);
    if (existingNorm.has(key)) continue;
    const fuzzyDup = [...existingNorm].some(
      (ex) => ex === key || (key.length > 2 && (ex.includes(key) || key.includes(ex)))
    );
    if (fuzzyDup) continue;

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
      },
    });
    existingNorm.add(key);
    imported++;
  }
  return { imported };
}

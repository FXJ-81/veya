import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/getAuthUser";
import { prisma } from "@/lib/prisma";
import { parseSubscriptionEmailText } from "@/lib/parseSubscriptionEmail";
import { google } from "googleapis";

export async function GET(req: Request) {
  const authUser = await getAuthUser(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const account = await prisma.account.findFirst({
    where: {
      userId: authUser.id,
      provider: "google-gmail",
    },
  });
  if (!account?.refresh_token) {
    return NextResponse.json(
      { error: "Gmail not connected", connected: false, suggestions: [] },
      { status: 200 }
    );
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const redirectUri = `${baseUrl}/api/auth/connect-gmail/callback`;
  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: "Gmail not configured", connected: true, suggestions: [] },
      { status: 503 }
    );
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
    } catch (e) {
      console.error("[scan-email] refresh token failed:", e);
      return NextResponse.json(
        { error: "Gmail session expired. Please connect Gmail again.", connected: false, suggestions: [] },
        { status: 200 }
      );
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
            // ignore decode errors
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
        // skip single message errors
      }
    }
    const combined = textParts.join("\n");
    const suggestions = parseSubscriptionEmailText(combined);
    const seen = new Set<string>();
    const deduped = suggestions.filter((s) => {
      const key = `${s.name}-${s.category}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return NextResponse.json({
      connected: true,
      suggestions: deduped,
    });
  } catch (e) {
    console.error("[scan-email] Gmail API error:", e);
    return NextResponse.json(
      { error: "Failed to scan inbox. Try again or reconnect Gmail.", connected: true, suggestions: [] },
      { status: 500 }
    );
  }
}

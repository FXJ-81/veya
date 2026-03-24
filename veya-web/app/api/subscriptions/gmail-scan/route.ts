import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/getAuthUser";
import { prisma } from "@/lib/prisma";
import {
  getAccountWithGmailAccess,
  importSuggestionsAsSubscriptions,
  scanGmailInbox,
} from "@/lib/gmailScan";

async function ensureSettings(userId: string) {
  await prisma.userSettings.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });
}

/**
 * POST /api/subscriptions/gmail-scan
 * Body: { mode?: "first-auto" | "manual" }
 * - first-auto: only runs if gmail first-scan not completed; marks complete after run (or skip via settings)
 * - manual: rescan anytime when Gmail connected
 */
export async function POST(req: Request) {
  const authUser = await getAuthUser(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { mode?: string } = {};
  try {
    body = await req.json();
  } catch {
    // empty body ok
  }
  const mode = body.mode === "first-auto" ? "first-auto" : "manual";

  await ensureSettings(authUser.id);
  const settings = await prisma.userSettings.findUnique({ where: { userId: authUser.id } });
  const firstDone = !!settings?.gmailFirstScanCompletedAt;

  if (mode === "first-auto" && firstDone) {
    return NextResponse.json({
      skipped: true,
      message: "First scan already completed",
      imported: 0,
      found: 0,
    });
  }

  const account = await getAccountWithGmailAccess(authUser.id);
  if (!account?.refresh_token) {
    if (mode === "first-auto") {
      return NextResponse.json({
        ok: false,
        needsGmail: true,
        imported: 0,
        found: 0,
        connected: false,
      });
    }
    return NextResponse.json(
      { error: "Gmail not connected", imported: 0, found: 0, connected: false },
      { status: 400 }
    );
  }

  const { suggestions, connected, error } = await scanGmailInbox(authUser.id);
  if (!connected || error) {
    await prisma.userSettings.update({
      where: { userId: authUser.id },
      data: {
        ...(mode === "first-auto" ? { gmailFirstScanCompletedAt: new Date() } : {}),
        lastGmailScanAt: new Date(),
        lastGmailScanFoundCount: 0,
      },
    });
    return NextResponse.json({
      ok: false,
      error: error ?? "Scan failed",
      imported: 0,
      found: 0,
      connected: !!connected,
    });
  }

  const { imported } = await importSuggestionsAsSubscriptions(authUser.id, suggestions);
  const found = suggestions.length;

  await prisma.userSettings.update({
    where: { userId: authUser.id },
    data: {
      lastGmailScanAt: new Date(),
      lastGmailScanFoundCount: imported,
      ...(mode === "first-auto" || !firstDone
        ? { gmailFirstScanCompletedAt: new Date() }
        : {}),
    },
  });

  return NextResponse.json({
    ok: true,
    imported,
    found,
    connected: true,
    firstAutoCompleted: mode === "first-auto" || !firstDone,
  });
}

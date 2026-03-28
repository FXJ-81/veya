import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/getAuthUser";
import { prisma } from "@/lib/prisma";
import { getAccountWithGmailAccess, importGmailMessageIds, scanGmailInbox } from "@/lib/gmailScan";

async function ensureSettings(userId: string) {
  await prisma.userSettings.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });
}

async function markFirstAutoComplete(userId: string) {
  await prisma.userSettings.update({
    where: { userId },
    data: {
      hasAutoScanned: true,
      gmailFirstScanCompletedAt: new Date(),
    },
  });
}

const scanBodySchema = z.object({
  action: z.literal("scan"),
  mode: z.enum(["first-auto", "manual"]).optional(),
});

const importBodySchema = z.object({
  action: z.literal("import"),
  messageIds: z.array(z.string().min(1)),
  firstAutoComplete: z.boolean().optional(),
});

const dismissBodySchema = z.object({
  action: z.literal("dismiss-first-auto"),
});

const bodySchema = z.discriminatedUnion("action", [
  scanBodySchema,
  importBodySchema,
  dismissBodySchema,
]);

/**
 * POST /api/subscriptions/gmail-scan
 * - { action: "scan", mode?: "first-auto" | "manual" } — returns candidates (no DB subscriptions)
 * - { action: "import", messageIds, firstAutoComplete? } — add selected; optional first-time completion
 * - { action: "dismiss-first-auto" } — skip adding; mark first auto flow done
 */
export async function POST(req: Request) {
  const authUser = await getAuthUser(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let json: unknown = {};
  try {
    const text = await req.text();
    if (text.trim()) json = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (
    json &&
    typeof json === "object" &&
    json !== null &&
    !("action" in json)
  ) {
    const legacy = json as { mode?: string };
    json = {
      action: "scan",
      mode: legacy.mode === "first-auto" ? "first-auto" : "manual",
    };
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  await ensureSettings(authUser.id);
  const settings = await prisma.userSettings.findUnique({ where: { userId: authUser.id } });

  if (parsed.data.action === "dismiss-first-auto") {
    await markFirstAutoComplete(authUser.id);
    return NextResponse.json({ ok: true, dismissed: true });
  }

  if (parsed.data.action === "import") {
    const account = await getAccountWithGmailAccess(authUser.id);
    if (!account?.refresh_token) {
      return NextResponse.json(
        { ok: false, error: "Gmail not connected", imported: 0 },
        { status: 400 }
      );
    }

    const result = await importGmailMessageIds(authUser.id, parsed.data.messageIds);

    await prisma.userSettings.update({
      where: { userId: authUser.id },
      data: {
        lastGmailScanAt: new Date(),
        lastGmailScanFoundCount: result.imported,
      },
    });

    if (parsed.data.firstAutoComplete) {
      await markFirstAutoComplete(authUser.id);
    }

    return NextResponse.json({
      ok: true,
      imported: result.imported,
      updated: result.updated,
      skippedDuplicates: result.skippedDuplicates,
      newSubscriptionNames: result.newNames,
      skippedNames: result.skippedNames,
    });
  }

  const mode = parsed.data.mode ?? "manual";
  const hasAutoScanned = !!settings?.hasAutoScanned;

  if (mode === "first-auto" && hasAutoScanned) {
    return NextResponse.json({
      skipped: true,
      message: "Auto scan already completed",
      ok: true,
      candidates: [],
      found: 0,
    });
  }

  const account = await getAccountWithGmailAccess(authUser.id);
  if (!account?.refresh_token) {
    if (mode === "first-auto") {
      return NextResponse.json({
        ok: false,
        needsGmail: true,
        candidates: [],
        found: 0,
        connected: false,
      });
    }
    return NextResponse.json(
      { ok: false, error: "Gmail not connected", candidates: [], found: 0, connected: false },
      { status: 400 }
    );
  }

  const { candidates, connected, error } = await scanGmailInbox(authUser.id);

  await prisma.userSettings.update({
    where: { userId: authUser.id },
    data: {
      lastGmailScanAt: new Date(),
      lastGmailScanFoundCount: candidates.length,
    },
  });

  if (!connected || error) {
    return NextResponse.json({
      ok: false,
      error: error ?? "Scan failed",
      candidates: [],
      found: 0,
      connected: !!connected,
    });
  }

  return NextResponse.json({
    ok: true,
    candidates,
    found: candidates.length,
    connected: true,
  });
}

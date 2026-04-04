import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/getAuthUser";
import { findAccountWithGmailAccess, summarizeGmailConnection } from "@/lib/gmailAccount";
import { prisma } from "@/lib/prisma";
import { getPlaidClient } from "@/lib/plaidServer";

async function ensureSettings(userId: string) {
  return prisma.userSettings.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });
}

/** GET — Gmail / first-scan status + Plaid bank accounts */
export async function GET(req: Request) {
  const authUser = await getAuthUser(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await ensureSettings(authUser.id);
  const settings = await prisma.userSettings.findUnique({ where: { userId: authUser.id } });

  const plaidAccounts = await prisma.plaidAccount.findMany({
    where: { userId: authUser.id },
    orderBy: { createdAt: "asc" },
    select: { id: true, bankName: true, lastSync: true, itemId: true },
  });

  const gmailAccount = await findAccountWithGmailAccess(authUser.id);
  const summary = summarizeGmailConnection(gmailAccount);
  const gmailConnected = summary.gmailConnected;

  if (process.env.NODE_ENV === "development") {
    console.log("[settings/gmail GET] Gmail connection", {
      userId: authUser.id,
      ...summary,
    });
  }

  return NextResponse.json({
    gmailConnected,
    plaidLinked: plaidAccounts.length > 0,
    plaidAccounts: plaidAccounts.map((a) => ({
      id: a.id,
      bankName: a.bankName ?? "Bank",
      lastSync: a.lastSync?.toISOString() ?? null,
    })),
    hasAutoScanned: settings?.hasAutoScanned ?? false,
    gmailFirstScanCompletedAt: settings?.gmailFirstScanCompletedAt?.toISOString() ?? null,
    lastGmailScanAt: settings?.lastGmailScanAt?.toISOString() ?? null,
    lastGmailScanFoundCount: settings?.lastGmailScanFoundCount ?? 0,
  });
}

/** PATCH — skip first-time prompt, disconnect Gmail, or disconnect Plaid (one or all) */
export async function PATCH(req: Request) {
  const authUser = await getAuthUser(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    skipFirstScan?: boolean;
    disconnectGmail?: boolean;
    disconnectPlaid?: boolean;
    disconnectPlaidAccountId?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  await ensureSettings(authUser.id);

  if (body.skipFirstScan) {
    await prisma.userSettings.update({
      where: { userId: authUser.id },
      data: {
        hasAutoScanned: true,
        gmailFirstScanCompletedAt: new Date(),
      },
    });
    return NextResponse.json({ ok: true });
  }

  if (body.disconnectPlaid || body.disconnectPlaidAccountId) {
    const plaid = (() => {
      try {
        return getPlaidClient();
      } catch {
        return null;
      }
    })();

    const removeRemote = async (accessToken: string) => {
      if (!plaid) return;
      try {
        await plaid.itemRemove({ access_token: accessToken });
      } catch (e) {
        console.error("[settings/gmail PATCH] itemRemove", e);
      }
    };

    if (body.disconnectPlaidAccountId) {
      const row = await prisma.plaidAccount.findFirst({
        where: { id: body.disconnectPlaidAccountId, userId: authUser.id },
      });
      if (row) {
        await removeRemote(row.accessToken);
        await prisma.plaidAccount.delete({ where: { id: row.id } });
      }
      return NextResponse.json({ ok: true, disconnectedPlaid: true });
    }

    if (body.disconnectPlaid) {
      const rows = await prisma.plaidAccount.findMany({
        where: { userId: authUser.id },
      });
      for (const row of rows) {
        await removeRemote(row.accessToken);
      }
      await prisma.plaidAccount.deleteMany({ where: { userId: authUser.id } });
      return NextResponse.json({ ok: true, disconnectedPlaid: true });
    }
  }

  if (body.disconnectGmail) {
    await prisma.account.updateMany({
      where: { userId: authUser.id, provider: "google" },
      data: { refresh_token: null, access_token: null, expires_at: null },
    });
    await prisma.account.deleteMany({
      where: { userId: authUser.id, provider: "google-gmail" },
    });
    return NextResponse.json({ ok: true, disconnected: true });
  }

  return NextResponse.json({ error: "No action" }, { status: 400 });
}

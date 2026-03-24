import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/getAuthUser";
import { prisma } from "@/lib/prisma";

async function ensureSettings(userId: string) {
  return prisma.userSettings.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });
}

/** GET — Gmail / first-scan status for dashboard & settings */
export async function GET(req: Request) {
  const authUser = await getAuthUser(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await ensureSettings(authUser.id);
  const settings = await prisma.userSettings.findUnique({ where: { userId: authUser.id } });

  const gmailAccount = await prisma.account.findFirst({
    where: {
      userId: authUser.id,
      OR: [{ provider: "google-gmail" }, { provider: "google" }],
      refresh_token: { not: null },
    },
  });
  const gmailConnected = !!gmailAccount?.refresh_token;

  return NextResponse.json({
    gmailConnected,
    gmailFirstScanCompletedAt: settings?.gmailFirstScanCompletedAt?.toISOString() ?? null,
    lastGmailScanAt: settings?.lastGmailScanAt?.toISOString() ?? null,
    lastGmailScanFoundCount: settings?.lastGmailScanFoundCount ?? 0,
  });
}

/** PATCH — skip first-time prompt, or disconnect Gmail tokens */
export async function PATCH(req: Request) {
  const authUser = await getAuthUser(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { skipFirstScan?: boolean; disconnectGmail?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  await ensureSettings(authUser.id);

  if (body.skipFirstScan) {
    await prisma.userSettings.update({
      where: { userId: authUser.id },
      data: { gmailFirstScanCompletedAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  }

  if (body.disconnectGmail) {
    // Remove dedicated Gmail OAuth row; Google sign-in Gmail uses the `google` account (re-connect via Connect Gmail)
    await prisma.account.deleteMany({
      where: { userId: authUser.id, provider: "google-gmail" },
    });
    return NextResponse.json({ ok: true, disconnected: true });
  }

  return NextResponse.json({ error: "No action" }, { status: 400 });
}

import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/getAuthUser";
import { prisma } from "@/lib/prisma";
import {
  mergeNotificationPrefs,
  NOTIFICATION_PREF_KEYS,
  type NotificationPrefKey,
} from "@/lib/notificationPrefs";

async function ensureSettings(userId: string) {
  return prisma.userSettings.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });
}

export async function GET(req: Request) {
  const authUser = await getAuthUser(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await ensureSettings(authUser.id);
  const row = await prisma.userSettings.findUnique({ where: { userId: authUser.id } });
  return NextResponse.json({ prefs: mergeNotificationPrefs(row?.notificationPrefs) });
}

export async function PATCH(req: Request) {
  const authUser = await getAuthUser(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  await ensureSettings(authUser.id);
  const row = await prisma.userSettings.findUnique({ where: { userId: authUser.id } });
  const current = mergeNotificationPrefs(row?.notificationPrefs);
  const patch = body as Record<string, unknown>;

  const next: Record<NotificationPrefKey, boolean> = { ...current };
  for (const key of NOTIFICATION_PREF_KEYS) {
    if (key in patch) next[key] = Boolean(patch[key]);
  }

  await prisma.userSettings.update({
    where: { userId: authUser.id },
    data: { notificationPrefs: next as object },
  });

  return NextResponse.json({ prefs: next });
}

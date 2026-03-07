import { prisma } from "../prisma/client.js";

export async function getNotifications(userId: string, limit = 50) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { sentAt: "desc" },
    take: limit,
  });
}

export async function markRead(id: string, userId: string) {
  await prisma.notification.updateMany({
    where: { id, userId },
    data: { read: true },
  });
  return { ok: true };
}

export async function markAllRead(userId: string) {
  await prisma.notification.updateMany({
    where: { userId },
    data: { read: true },
  });
  return { ok: true };
}

export async function getSettings(userId: string) {
  const settings = await prisma.userSettings.findUnique({
    where: { userId },
  });
  const prefs = (settings?.notificationPrefs as Record<string, unknown>) ?? {};
  return {
    renewalReminder: prefs.renewalReminder ?? 1,
    weeklySummary: prefs.weeklySummary ?? true,
    monthlyReport: prefs.monthlyReport ?? true,
    savingsOpportunity: prefs.savingsOpportunity ?? true,
    budgetAlert: prefs.budgetAlert ?? true,
    quietHoursStart: prefs.quietHoursStart ?? 22,
    quietHoursEnd: prefs.quietHoursEnd ?? 8,
  };
}

export async function updateSettings(userId: string, prefs: Record<string, unknown>) {
  const prefsJson = prefs as object;
  await prisma.userSettings.upsert({
    where: { userId },
    create: { userId, notificationPrefs: prefsJson, appearance: {} },
    update: { notificationPrefs: prefsJson },
  });
  return getSettings(userId);
}

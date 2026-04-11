import { prisma } from "@/lib/prisma";
import { startOfLocalDay } from "@/lib/subscriptionBilling";

/** Logical kind from stored notification type (e.g. `renewal:subId:date` → `renewal`). */
export function notificationTypeFamily(fullType: string): string {
  if (fullType === "welcome") return "welcome";
  const i = fullType.indexOf(":");
  return i === -1 ? fullType : fullType.slice(0, i);
}

/**
 * True if an equivalent notification already exists today (local calendar day on `sentAt`).
 * - For `renewal` and `new_subscription`: same userId, same title, same day, and type prefix matches (stops duplicate merchants from multiple rows).
 * - Otherwise: same userId, same full type, same title, same day (per spec).
 */
export async function hasDuplicateNotificationToday(
  userId: string,
  fullType: string,
  title: string,
): Promise<boolean> {
  const family = notificationTypeFamily(fullType);
  const dayStart = startOfLocalDay(new Date());
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  const sentAt = { gte: dayStart, lt: dayEnd };

  if (family === "renewal" || family === "new_subscription") {
    const n = await prisma.notification.findFirst({
      where: {
        userId,
        title,
        sentAt,
        type: { startsWith: `${family}:` },
      },
    });
    return !!n;
  }

  const n = await prisma.notification.findFirst({
    where: {
      userId,
      type: fullType,
      title,
      sentAt,
    },
  });
  return !!n;
}

import { prisma } from "@/lib/prisma";
import { mergeNotificationPrefs } from "@/lib/notificationPrefs";
import { formatCurrency } from "@/lib/utils";
import { pricePerMonth } from "@/lib/subscriptionBilling";
import { hasDuplicateNotificationToday } from "@/lib/notificationDedupe";
import { sendNewSubscriptionEmail } from "@/lib/notificationEmails";

export type CreateSubscriptionInput = {
  name: string;
  category: string;
  price: number;
  billingCycle: "monthly" | "yearly" | "weekly" | "custom";
  startDate: Date;
  nextRenewal: Date;
  status?: string;
  notes?: string | null;
  isShared?: boolean;
  color?: string | null;
  source?: "manual" | "gmail" | "plaid";
};

/**
 * Create a subscription row and run Plaid "new subscription" notifications when applicable.
 * Used by HTTP POST and background Plaid sync (same behavior).
 */
export async function createSubscriptionForUser(
  userId: string,
  data: CreateSubscriptionInput,
): Promise<Awaited<ReturnType<typeof prisma.subscription.create>>> {
  const source = data.source ?? "manual";
  const sub = await prisma.subscription.create({
    data: {
      userId,
      name: data.name,
      category: data.category,
      price: data.price,
      billingCycle: data.billingCycle,
      startDate: data.startDate,
      nextRenewal: data.nextRenewal,
      status: data.status ?? "active",
      notes: data.notes ?? undefined,
      isShared: data.isShared ?? false,
      color: data.color ?? undefined,
      source,
    },
  });

  if (source === "plaid") {
    const settings = await prisma.userSettings.findUnique({ where: { userId } });
    const prefs = mergeNotificationPrefs(settings?.notificationPrefs);
    if (prefs.newSubscriptionDetected) {
      const typeKey = `new_subscription:${sub.id}`;
      const monthly = pricePerMonth(sub.price, sub.billingCycle);
      const title = `New subscription detected: ${sub.name} (${formatCurrency(monthly)}/mo)`;
      if (!(await hasDuplicateNotificationToday(userId, typeKey, title))) {
        await prisma.notification.create({
          data: {
            userId,
            type: typeKey,
            title,
            body: "Added from your bank transactions.",
            read: false,
          },
        });
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { email: true, name: true },
        });
        if (user?.email) {
          await sendNewSubscriptionEmail({
            to: user.email,
            recipientName: user.name,
            subName: sub.name,
            monthlyAmount: monthly,
          });
        }
      }
    }
  }

  return sub;
}

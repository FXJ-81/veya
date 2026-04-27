/**
 * Generates in-app notifications and related emails for one user (welcome, renewal reminders,
 * budget alerts, monthly summary). Invoked from `POST /api/notifications/generate` (e.g. cron or client).
 *
 * Renewal emails: exactly **one** per subscription per renewal UTC date, only when **7 days**
 * before renewal, respecting `renewalReminders` prefs and `renewal_reminder:*` idempotency keys.
 */
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import { mergeNotificationPrefs } from "@/lib/notificationPrefs";
import {
  hasSubscriptionStarted,
  pricePerMonth,
  startOfLocalDay,
  utcCalendarDateKey,
  utcCalendarDaysUntilRenewal,
  formatRenewalDateDisplayUtc,
} from "@/lib/subscriptionBilling";
import { hasDuplicateNotificationToday } from "@/lib/notificationDedupe";
import {
  sendRenewalReminderEmail,
  sendBudgetExceededEmail,
  sendMonthlySummaryEmail,
} from "@/lib/notificationEmails";

function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Whole calendar days from `from` (local start of day) to `nextRenewal` (local start of day). */
function calendarDaysUntilRenewal(nextRenewal: Date, from: Date = new Date()): number {
  const a = startOfLocalDay(from).getTime();
  const b = startOfLocalDay(nextRenewal).getTime();
  return Math.round((b - a) / 86400000);
}

/** One 7-day renewal reminder per subscription per renewal UTC date (idempotency key). */
function renewalReminderTypeKey(subscriptionId: string, renewalUtcDateKey: string): string {
  return `renewal_reminder:${subscriptionId}:${renewalUtcDateKey}`;
}

function monthDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export async function generateNotificationsForUser(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, plan: true },
  });
  if (!user?.email) return;

  await prisma.userSettings.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });

  const settings = await prisma.userSettings.findUnique({ where: { userId } });
  const prefs = mergeNotificationPrefs(settings?.notificationPrefs);
  const premium = user.plan === "premium";

  const welcome = await prisma.notification.findFirst({
    where: { userId, type: "welcome" },
  });
  if (!welcome) {
    const wType = "welcome";
    const wTitle = "Welcome to Veya!";
    if (!(await hasDuplicateNotificationToday(userId, wType, wTitle))) {
      await prisma.notification.create({
        data: {
          userId,
          type: wType,
          title: wTitle,
          body: "Connect your bank to get started.",
          read: false,
        },
      });
    }
  }

  if (premium && prefs.renewalReminders) {
    const subs = await prisma.subscription.findMany({
      where: { userId, status: "active" },
    });
    const asOf = new Date();
    for (const sub of subs) {
      const next = new Date(sub.nextRenewal);
      if (Number.isNaN(next.getTime())) continue;

      const days = utcCalendarDaysUntilRenewal(next, asOf);
      if (days !== 7) continue;

      const renewalKey = utcCalendarDateKey(next);
      if (!renewalKey) continue;

      const typeKey = renewalReminderTypeKey(sub.id, renewalKey);
      const renewalLabel = formatRenewalDateDisplayUtc(next);
      if (!renewalLabel) continue;

      const monthly = pricePerMonth(sub.price, sub.billingCycle);
      const priceLabel = formatCurrency(monthly);
      const title = `Upcoming renewal: ${sub.name} on ${renewalLabel}`;

      const alreadySent = await prisma.notification.findFirst({
        where: { userId, type: typeKey },
        select: { id: true },
      });
      if (alreadySent) continue;

      await sendRenewalReminderEmail({
        to: user.email,
        recipientName: user.name,
        subName: sub.name,
        renewalDate: next,
        renewalLabel,
        monthlyAmount: monthly,
      });

      await prisma.notification.create({
        data: {
          userId,
          type: typeKey,
          title,
          body: `Renews on ${renewalLabel} (${priceLabel}/mo est.).`,
          read: false,
        },
      });
    }
  }

  if (premium && prefs.budgetAlerts) {
    const todayKey = localDateKey(new Date());
    const [budgets, subs] = await Promise.all([
      prisma.budget.findMany({ where: { userId } }),
      prisma.subscription.findMany({
        where: { userId, status: "active" },
        select: { category: true, price: true, billingCycle: true, startDate: true },
      }),
    ]);

    const spendByCategory = new Map<string, number>();
    let totalMonthlySpend = 0;
    for (const sub of subs) {
      if (!hasSubscriptionStarted(new Date(sub.startDate))) continue;
      const monthly = pricePerMonth(sub.price, sub.billingCycle);
      spendByCategory.set(sub.category, (spendByCategory.get(sub.category) ?? 0) + monthly);
      totalMonthlySpend += monthly;
    }

    for (const b of budgets) {
      const spent =
        b.category === "__total__"
          ? totalMonthlySpend
          : (spendByCategory.get(b.category) ?? 0);
      const percentage = b.limit > 0 ? (spent / b.limit) * 100 : 0;
      if (percentage < 100) continue;

      const typeKey = `budget:${b.id}:${todayKey}`;
      const label =
        b.category === "__total__" ? "Total subscriptions" : b.category;
      const title = `You've exceeded your ${label} budget`;

      if (await hasDuplicateNotificationToday(userId, typeKey, title)) continue;

      await prisma.notification.create({
        data: {
          userId,
          type: typeKey,
          title,
          body: `Spending is over your ${formatCurrency(b.limit)} limit.`,
          read: false,
        },
      });

      await sendBudgetExceededEmail({
        to: user.email,
        recipientName: user.name,
        categoryLabel: label,
        limit: b.limit,
        spent,
      });
    }
  }

  if (premium && prefs.weeklySpendingSummary) {
    const now = new Date();
    if (now.getDate() === 1) {
      const monthKey = monthDateKey(now);
      const typeKey = `monthly:${monthKey}`;
      const title = "Monthly spending summary";

      const allSubs = await prisma.subscription.findMany({
        where: { userId, status: "active" },
      });

      const spendByCategory = new Map<string, number>();
      let totalMonthly = 0;
      for (const s of allSubs) {
        if (!hasSubscriptionStarted(new Date(s.startDate))) continue;
        const m = pricePerMonth(s.price, s.billingCycle);
        spendByCategory.set(s.category, (spendByCategory.get(s.category) ?? 0) + m);
        totalMonthly += m;
      }

      const renewingNames = allSubs
        .filter((s) => {
          const d = calendarDaysUntilRenewal(new Date(s.nextRenewal));
          return d >= 0 && d <= 31;
        })
        .map((s) => s.name);
      const renewingThisMonthList =
        renewingNames.length > 0 ? renewingNames.join(", ") : "None";

      const budgets = await prisma.budget.findMany({ where: { userId } });
      let anyOver = false;
      for (const b of budgets) {
        const spent =
          b.category === "__total__"
            ? totalMonthly
            : (spendByCategory.get(b.category) ?? 0);
        const pct = b.limit > 0 ? (spent / b.limit) * 100 : 0;
        if (pct >= 100) anyOver = true;
      }
      const budgetStatusLine = anyOver ? "Over budget" : "On track";

      if (await hasDuplicateNotificationToday(userId, typeKey, title)) {
        /* skip */
      } else {
        await prisma.notification.create({
          data: {
            userId,
            type: typeKey,
            title,
            body: `Your subscriptions total about ${formatCurrency(totalMonthly)}/mo right now.`,
            read: false,
          },
        });

        await sendMonthlySummaryEmail({
          to: user.email,
          recipientName: user.name,
          totalMonthly,
          activeCount: allSubs.length,
          renewingThisMonthList,
          budgetStatusLine,
        });
      }
    }
  }
}

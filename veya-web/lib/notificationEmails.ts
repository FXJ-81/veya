/**
 * Veya transactional notification emails.
 *
 * Every email here uses the shared `renderEmailLayout` design so the inbox experience
 * stays visually consistent. Each template still has purpose-specific copy and a tailored
 * summary card. Plain-text fallbacks are included for accessibility and deliverability.
 */
import { getGoogleOAuthOrigin } from "@/lib/googleOAuthCallback";
import { formatCurrency } from "@/lib/utils";
import { sendEmail } from "@/lib/sendEmail";
import { utcCalendarDateKey } from "@/lib/subscriptionBilling";
import {
  defaultSettingsUrl,
  escapeHtml,
  firstNameRaw,
  renderEmailLayout,
  renderEmailPlainText,
  renderSummaryCard,
  sanitizeSubject,
} from "@/lib/emailLayout";

const REASON_NOTES = {
  renewal:
    "You're receiving this because Renewal reminders are turned on in your Veya notification settings.",
  budget:
    "You're receiving this because Budget alerts are turned on in your Veya notification settings.",
  newSub:
    "You're receiving this because Bank-detected subscription alerts are turned on in your Veya notification settings.",
  monthly:
    "You're receiving this because Monthly summary emails are turned on in your Veya notification settings.",
} as const;

const MANAGE_PREFS_LABEL = "Manage notification preferences";

/* -------------------------------------------------------------------------- */
/*  Renewal reminder                                                           */
/* -------------------------------------------------------------------------- */

export async function sendRenewalReminderEmail(opts: {
  to: string;
  recipientName: string | null | undefined;
  subName: string;
  renewalDate: Date;
  renewalLabel: string;
  monthlyAmount: number;
}): Promise<void> {
  if (!utcCalendarDateKey(opts.renewalDate)) return;

  const origin = getGoogleOAuthOrigin();
  const subscriptionsUrl = `${origin}/subscriptions`;
  const settingsUrl = defaultSettingsUrl();
  const monthlyAmountLabel = formatCurrency(opts.monthlyAmount);
  const subSafe = escapeHtml(opts.subName);

  const subject = sanitizeSubject(
    `Renews in 7 days: ${opts.subName} on ${opts.renewalLabel}`,
  );

  const summaryCard = renderSummaryCard({
    rows: [
      { label: "Subscription", value: subSafe },
      { label: "Renews on", value: escapeHtml(opts.renewalLabel) },
      {
        label: "Estimated monthly cost",
        value: `${escapeHtml(monthlyAmountLabel)} <span style="color:#64748b;font-size:13px;font-weight:500;"> / month</span>`,
        helper:
          "Yearly and custom plans are shown as a monthly equivalent so you can compare spend at a glance.",
      },
    ],
  });

  const html = renderEmailLayout({
    preheader: `${opts.subName} renews on ${opts.renewalLabel}. Review or pause it before you're charged.`,
    category: "Renewal reminder",
    title: `${opts.subName} renews in 7 days`,
    greeting: `Hi ${firstNameRaw(opts.recipientName)},`,
    intro:
      "This is a heads-up from Veya before your subscription renews. Review the details below — you can pause, cancel, or update tracking in a couple of taps.",
    contentHtml: summaryCard,
    cta: { href: subscriptionsUrl, label: "View in Veya" },
    ctaNote:
      "Open your subscriptions to update the renewal date, change the price, or stop tracking it before you're charged.",
    reasonNote: REASON_NOTES.renewal,
    manageLink: { href: settingsUrl, label: MANAGE_PREFS_LABEL },
    supportLine: "Need help? Reply to this email — we read every message.",
  });

  const text = renderEmailPlainText({
    title: `${opts.subName} renews in 7 days`,
    greeting: `Hi ${firstNameRaw(opts.recipientName)},`,
    intro:
      "Here's a heads-up before your subscription renews. You can pause, cancel, or update tracking inside Veya at any time.",
    lines: [
      `Subscription: ${opts.subName}`,
      `Renews on: ${opts.renewalLabel}`,
      `Estimated monthly cost: ${monthlyAmountLabel} / month`,
    ],
    cta: { href: subscriptionsUrl, label: "View in Veya" },
    reasonNote: REASON_NOTES.renewal,
    manageLink: { href: settingsUrl, label: MANAGE_PREFS_LABEL },
  });

  await sendEmail({ to: opts.to, subject, html, text });
}

/* -------------------------------------------------------------------------- */
/*  Budget exceeded                                                            */
/* -------------------------------------------------------------------------- */

export async function sendBudgetExceededEmail(opts: {
  to: string;
  recipientName: string | null | undefined;
  categoryLabel: string;
  limit: number;
  spent: number;
}): Promise<void> {
  const origin = getGoogleOAuthOrigin();
  const analyticsUrl = `${origin}/analytics`;
  const settingsUrl = defaultSettingsUrl();

  const overPct =
    opts.limit > 0
      ? Math.max(0, Math.round(((opts.spent - opts.limit) / opts.limit) * 100))
      : 0;
  const limitLabel = formatCurrency(opts.limit);
  const spentLabel = formatCurrency(opts.spent);
  const overLabel = formatCurrency(Math.max(0, opts.spent - opts.limit));

  const subject = sanitizeSubject(
    `${opts.categoryLabel} budget is over by ${overLabel}`,
  );

  const summaryCard = renderSummaryCard({
    rows: [
      { label: "Category", value: escapeHtml(opts.categoryLabel) },
      { label: "Budget limit", value: escapeHtml(limitLabel) },
      {
        label: "Current spend",
        value: `${escapeHtml(spentLabel)} <span style="color:#dc2626;font-size:13px;font-weight:600;"> · ${overPct}% over</span>`,
        helper: `That's ${overLabel} above your monthly cap.`,
      },
    ],
  });

  const html = renderEmailLayout({
    preheader: `Your ${opts.categoryLabel} category is ${overPct}% over its budget limit.`,
    category: "Budget alert",
    title: "You're over budget this month",
    greeting: `Hi ${firstNameRaw(opts.recipientName)},`,
    intro: `Your <strong>${escapeHtml(opts.categoryLabel)}</strong> spending has crossed its monthly limit. Take a look in Veya to see which subscriptions are driving it and adjust the cap if it no longer fits.`,
    contentHtml: summaryCard,
    cta: { href: analyticsUrl, label: "Review your budget" },
    ctaNote: "Open Analytics to see a breakdown by category and subscription.",
    reasonNote: REASON_NOTES.budget,
    manageLink: { href: settingsUrl, label: MANAGE_PREFS_LABEL },
  });

  const text = renderEmailPlainText({
    title: "You're over budget this month",
    greeting: `Hi ${firstNameRaw(opts.recipientName)},`,
    intro: `Your ${opts.categoryLabel} spending has crossed its monthly limit.`,
    lines: [
      `Category: ${opts.categoryLabel}`,
      `Budget limit: ${limitLabel}`,
      `Current spend: ${spentLabel} (${overPct}% over)`,
    ],
    cta: { href: analyticsUrl, label: "Review your budget" },
    reasonNote: REASON_NOTES.budget,
    manageLink: { href: settingsUrl, label: MANAGE_PREFS_LABEL },
  });

  await sendEmail({ to: opts.to, subject, html, text });
}

/* -------------------------------------------------------------------------- */
/*  New subscription detected                                                  */
/* -------------------------------------------------------------------------- */

export async function sendNewSubscriptionEmail(opts: {
  to: string;
  recipientName: string | null | undefined;
  subName: string;
  monthlyAmount: number;
}): Promise<void> {
  const origin = getGoogleOAuthOrigin();
  const subscriptionsUrl = `${origin}/subscriptions`;
  const settingsUrl = defaultSettingsUrl();
  const monthlyAmountLabel = formatCurrency(opts.monthlyAmount);

  const subject = sanitizeSubject(
    `New subscription detected: ${opts.subName}`,
  );

  const summaryCard = renderSummaryCard({
    rows: [
      { label: "Subscription", value: escapeHtml(opts.subName) },
      {
        label: "Estimated cost",
        value: `${escapeHtml(monthlyAmountLabel)} <span style="color:#64748b;font-size:13px;font-weight:500;"> / month</span>`,
        helper: "Detected from a recurring charge in your linked accounts.",
      },
    ],
  });

  const html = renderEmailLayout({
    preheader: `Veya detected a new subscription — ${opts.subName} for about ${monthlyAmountLabel}/month.`,
    category: "New subscription",
    title: "We found a new subscription",
    greeting: `Hi ${firstNameRaw(opts.recipientName)},`,
    intro:
      "Veya spotted a recurring charge in your linked accounts that looks like a new subscription. Confirm the details below — keep it tracked, edit the cost, or remove it if it's not yours.",
    contentHtml: summaryCard,
    cta: { href: subscriptionsUrl, label: "Review in Veya" },
    ctaNote:
      "Confirming new subscriptions keeps your monthly total accurate so you never miss a renewal.",
    reasonNote: REASON_NOTES.newSub,
    manageLink: { href: settingsUrl, label: MANAGE_PREFS_LABEL },
  });

  const text = renderEmailPlainText({
    title: "We found a new subscription",
    greeting: `Hi ${firstNameRaw(opts.recipientName)},`,
    intro:
      "Veya spotted a recurring charge that looks like a new subscription. Review it inside the app to keep your monthly total accurate.",
    lines: [
      `Subscription: ${opts.subName}`,
      `Estimated cost: ${monthlyAmountLabel} / month`,
    ],
    cta: { href: subscriptionsUrl, label: "Review in Veya" },
    reasonNote: REASON_NOTES.newSub,
    manageLink: { href: settingsUrl, label: MANAGE_PREFS_LABEL },
  });

  await sendEmail({ to: opts.to, subject, html, text });
}

/* -------------------------------------------------------------------------- */
/*  Monthly summary                                                            */
/* -------------------------------------------------------------------------- */

export async function sendMonthlySummaryEmail(opts: {
  to: string;
  recipientName: string | null | undefined;
  totalMonthly: number;
  activeCount: number;
  renewingThisMonthList: string;
  budgetStatusLine: string;
}): Promise<void> {
  const origin = getGoogleOAuthOrigin();
  const dashboardUrl = `${origin}/dashboard`;
  const settingsUrl = defaultSettingsUrl();
  const totalLabel = formatCurrency(opts.totalMonthly);
  const monthLabel = new Date().toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const subject = sanitizeSubject(
    `Your ${monthLabel} subscription summary`,
  );

  const renewingValue = opts.renewingThisMonthList?.trim()
    ? escapeHtml(opts.renewingThisMonthList)
    : '<span style="color:#64748b;font-weight:500;">No renewals scheduled</span>';

  const budgetValue = formatBudgetStatusValue(opts.budgetStatusLine);

  const summaryCard = renderSummaryCard({
    heading: `${monthLabel} at a glance`,
    rows: [
      {
        label: "Estimated monthly spend",
        value: escapeHtml(totalLabel),
        helper: "Across every active subscription you're tracking.",
      },
      {
        label: "Active subscriptions",
        value: String(opts.activeCount),
      },
      {
        label: "Renewing this month",
        value: renewingValue,
      },
      {
        label: "Budget status",
        value: budgetValue,
      },
    ],
  });

  const html = renderEmailLayout({
    preheader: `Your ${monthLabel} subscription summary from Veya — ${totalLabel}/month across ${opts.activeCount} active subscriptions.`,
    category: "Monthly summary",
    title: `Your ${monthLabel} subscription summary`,
    greeting: `Hi ${firstNameRaw(opts.recipientName)},`,
    intro:
      "Here's a quick look at your subscriptions for the month — what you're spending, what's coming up, and how your budgets are tracking.",
    contentHtml: summaryCard,
    cta: { href: dashboardUrl, label: "Open dashboard" },
    ctaNote:
      "See the full breakdown by category, upcoming renewals, and AI Coach suggestions.",
    reasonNote: REASON_NOTES.monthly,
    manageLink: { href: settingsUrl, label: MANAGE_PREFS_LABEL },
  });

  const text = renderEmailPlainText({
    title: `Your ${monthLabel} subscription summary`,
    greeting: `Hi ${firstNameRaw(opts.recipientName)},`,
    intro:
      "Here's a quick look at your subscriptions for the month — what you're spending, what's coming up, and how your budgets are tracking.",
    lines: [
      `Estimated monthly spend: ${totalLabel}`,
      `Active subscriptions: ${opts.activeCount}`,
      `Renewing this month: ${opts.renewingThisMonthList || "None"}`,
      `Budget status: ${opts.budgetStatusLine}`,
    ],
    cta: { href: dashboardUrl, label: "Open dashboard" },
    reasonNote: REASON_NOTES.monthly,
    manageLink: { href: settingsUrl, label: MANAGE_PREFS_LABEL },
  });

  await sendEmail({ to: opts.to, subject, html, text });
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function formatBudgetStatusValue(status: string): string {
  const normalized = status.trim().toLowerCase();
  if (normalized === "over budget") {
    return '<span style="color:#dc2626;">Over budget</span>';
  }
  if (normalized === "on track") {
    return '<span style="color:#15803d;">On track</span>';
  }
  return escapeHtml(status);
}

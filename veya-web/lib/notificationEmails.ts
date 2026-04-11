import { getGoogleOAuthOrigin } from "@/lib/googleOAuthCallback";
import { formatCurrency, formatDate } from "@/lib/utils";
import { sendEmail } from "@/lib/sendEmail";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function ctaButton(href: string, label: string): string {
  return `<p style="margin:20px 0;"><a href="${href}" style="display:inline-block;padding:12px 20px;background:#16a34a;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;">${label}</a></p>`;
}

function managePrefsFooter(): string {
  const origin = getGoogleOAuthOrigin();
  const settingsUrl = `${origin}/settings`;
  const display = settingsUrl.replace(/^https:\/\//, "");
  return `<p style="margin-top:20px;font-size:13px;color:#666;">Manage your notification preferences in Veya Settings → <a href="${settingsUrl}">${display}</a></p>`;
}

function firstName(name: string | null | undefined): string {
  const n = name?.trim();
  if (!n) return "there";
  return escapeHtml(n.split(/\s+/)[0] ?? "there");
}

function renewalDayPhrase(days: number): string {
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}

function renewalSubject(subName: string, days: number): string {
  const safe = subName.replace(/[\r\n]/g, " ").slice(0, 200);
  if (days === 0) return `⏰ ${safe} renews today — Veya`;
  if (days === 1) return `⏰ ${safe} renews tomorrow — Veya`;
  return `⏰ ${safe} renews in ${days} days — Veya`;
}

export async function sendRenewalReminderEmail(opts: {
  to: string;
  recipientName: string | null | undefined;
  subName: string;
  days: number;
  renewalDate: Date;
  monthlyAmount: number;
}): Promise<void> {
  const origin = getGoogleOAuthOrigin();
  const phrase = renewalDayPhrase(opts.days);
  const subject = renewalSubject(opts.subName, opts.days);
  const subSafe = escapeHtml(opts.subName);
  const html = `
<p>Hi ${firstName(opts.recipientName)},</p>
<p>Just a heads up — your ${subSafe} subscription renews ${phrase} on ${formatDate(opts.renewalDate)} for ${formatCurrency(opts.monthlyAmount)}.</p>
${ctaButton(`${origin}/subscriptions`, "View in Veya →")}
<p>— The Veya Team</p>
<p style="font-size:13px;color:#666;">You're receiving this because renewal reminders are enabled. Manage preferences in Settings.</p>
${managePrefsFooter()}
`;
  await sendEmail(opts.to, subject, html.trim());
}

export async function sendBudgetExceededEmail(opts: {
  to: string;
  recipientName: string | null | undefined;
  categoryLabel: string;
  limit: number;
  spent: number;
}): Promise<void> {
  const origin = getGoogleOAuthOrigin();
  const overPct =
    opts.limit > 0 ? Math.max(0, Math.round(((opts.spent - opts.limit) / opts.limit) * 100)) : 0;
  const catSafe = escapeHtml(opts.categoryLabel);
  const subject = `🚨 Budget exceeded — ${opts.categoryLabel.replace(/[\r\n]/g, " ").slice(0, 120)} — Veya`;
  const html = `
<p>Hi ${firstName(opts.recipientName)},</p>
<p>You've exceeded your ${catSafe} budget limit of ${formatCurrency(opts.limit)}. Current spend: ${formatCurrency(opts.spent)} (${overPct}% over limit).</p>
${ctaButton(`${origin}/analytics`, "View Budget →")}
<p>— The Veya Team</p>
${managePrefsFooter()}
`;
  await sendEmail(opts.to, subject, html.trim());
}

export async function sendNewSubscriptionEmail(opts: {
  to: string;
  recipientName: string | null | undefined;
  subName: string;
  monthlyAmount: number;
}): Promise<void> {
  const origin = getGoogleOAuthOrigin();
  const subject = "✅ New subscription detected — Veya";
  const subSafe = escapeHtml(opts.subName);
  const html = `
<p>Hi ${firstName(opts.recipientName)},</p>
<p>We detected a new subscription from your bank:<br/><strong>${subSafe}</strong> — ${formatCurrency(opts.monthlyAmount)}/month</p>
${ctaButton(`${origin}/subscriptions`, "View Subscriptions →")}
<p>— The Veya Team</p>
${managePrefsFooter()}
`;
  await sendEmail(opts.to, subject, html.trim());
}

export async function sendWeeklySummaryEmail(opts: {
  to: string;
  recipientName: string | null | undefined;
  totalMonthly: number;
  activeCount: number;
  renewingThisWeekList: string;
  budgetStatusLine: string;
}): Promise<void> {
  const origin = getGoogleOAuthOrigin();
  const subject = "📊 Your weekly Veya summary";
  const listSafe = escapeHtml(opts.renewingThisWeekList);
  const budgetSafe = escapeHtml(opts.budgetStatusLine);
  const html = `
<p>Hi ${firstName(opts.recipientName)},</p>
<p>Here's your subscription summary for this week:</p>
<ul style="padding-left:20px;">
  <li>Total monthly spend: ${formatCurrency(opts.totalMonthly)}</li>
  <li>Active subscriptions: ${opts.activeCount}</li>
  <li>Renewing this week: ${listSafe}</li>
  <li>Budget status: ${budgetSafe}</li>
</ul>
${ctaButton(`${origin}/dashboard`, "View Dashboard →")}
<p>— The Veya Team</p>
${managePrefsFooter()}
`;
  await sendEmail(opts.to, subject, html.trim());
}

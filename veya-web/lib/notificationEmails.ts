import { getGoogleOAuthOrigin } from "@/lib/googleOAuthCallback";
import { formatCurrency, formatDate } from "@/lib/utils";
import { sendEmail } from "@/lib/sendEmail";
import { utcCalendarDateKey } from "@/lib/subscriptionBilling";

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
  return `<p style="margin:24px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;color:#64748b;">Manage your notification preferences: <a href="${settingsUrl}" style="color:#2563eb;text-decoration:underline;">Open Settings</a></p>`;
}

function firstName(name: string | null | undefined): string {
  const n = name?.trim();
  if (!n) return "there";
  return escapeHtml(n.split(/\s+/)[0] ?? "there");
}

function renewalReminderSubject(subName: string, renewalLabel: string): string {
  const name = subName.replace(/[\r\n]/g, " ").trim().slice(0, 72);
  const when = renewalLabel.replace(/[\r\n]/g, " ").trim().slice(0, 40);
  return `Upcoming renewal: ${name} on ${when}`;
}

function buildRenewalReminderEmailHtml(opts: {
  recipientName: string | null | undefined;
  subName: string;
  renewalLabel: string;
  monthlyAmountLabel: string;
  subscriptionsUrl: string;
  settingsUrl: string;
}): string {
  const subSafe = escapeHtml(opts.subName);
  const renewalSafe = escapeHtml(opts.renewalLabel);
  const amountSafe = escapeHtml(opts.monthlyAmountLabel);
  const veyaWordmark = "Veya";

  return `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0;padding:0;background-color:#f1f5f9;">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
        <tr>
          <td style="background-color:#0f172a;padding:20px 28px;">
            <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:600;letter-spacing:0.02em;color:#f8fafc;">${veyaWordmark}</p>
            <p style="margin:8px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.4;color:#94a3b8;">Subscription renewal reminder</p>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 28px 8px;font-family:Arial,Helvetica,sans-serif;">
            <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;font-weight:600;color:#0f172a;">Your subscription renews in one week</h1>
            <p style="margin:0;font-size:15px;line-height:1.6;color:#334155;">Hello ${firstName(opts.recipientName)},</p>
            <p style="margin:16px 0 0;font-size:15px;line-height:1.6;color:#334155;">This is a scheduled reminder from Veya. One of your subscriptions is set to renew in <strong style="color:#0f172a;">seven days</strong>. Review the details below and open Veya if you need to make changes.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:8px 28px 24px;font-family:Arial,Helvetica,sans-serif;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;">
              <tr>
                <td style="padding:18px 20px;">
                  <p style="margin:0 0 6px;font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#64748b;">Subscription</p>
                  <p style="margin:0;font-size:17px;font-weight:600;color:#0f172a;">${subSafe}</p>
                  <p style="margin:16px 0 6px;font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#64748b;">Renewal date</p>
                  <p style="margin:0;font-size:15px;color:#1e293b;">${renewalSafe}</p>
                  <p style="margin:16px 0 6px;font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#64748b;">Estimated monthly cost</p>
                  <p style="margin:0;font-size:15px;color:#1e293b;">${amountSafe}<span style="color:#64748b;font-size:13px;"> / month</span></p>
                  <p style="margin:12px 0 0;font-size:12px;line-height:1.5;color:#64748b;">Yearly or custom plans are shown as a monthly equivalent so you can compare spend at a glance.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:0 28px 28px;font-family:Arial,Helvetica,sans-serif;">
            <a href="${opts.subscriptionsUrl}" style="display:inline-block;padding:14px 28px;background-color:#16a34a;color:#ffffff;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600;">View in Veya</a>
            <p style="margin:20px 0 0;font-size:13px;line-height:1.55;color:#64748b;max-width:480px;">Open your subscriptions list to update the renewal date, pause or cancel tracking, or adjust notes before you are charged.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:0 28px 28px;font-family:Arial,Helvetica,sans-serif;border-top:1px solid #e2e8f0;">
            <p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#94a3b8;">You are receiving this message because <strong style="color:#64748b;">Renewal reminders</strong> is turned on in your Veya account. If you no longer want these emails, you can turn that option off in Settings.</p>
            <p style="margin:12px 0 0;font-size:13px;line-height:1.5;"><a href="${opts.settingsUrl}" style="color:#2563eb;text-decoration:underline;">Notification preferences</a></p>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 28px 24px;background-color:#f8fafc;font-family:Arial,Helvetica,sans-serif;">
            <p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;">Sent by Veya · This is an automated billing reminder, not a receipt or invoice from your provider.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
`.trim();
}

export async function sendRenewalReminderEmail(opts: {
  to: string;
  recipientName: string | null | undefined;
  subName: string;
  renewalDate: Date;
  renewalLabel: string;
  monthlyAmount: number;
}): Promise<void> {
  const origin = getGoogleOAuthOrigin();
  if (!utcCalendarDateKey(opts.renewalDate)) return;

  const subject = `${renewalReminderSubject(opts.subName, opts.renewalLabel)} — Veya`;
  const monthlyAmountLabel = formatCurrency(opts.monthlyAmount);
  const html = buildRenewalReminderEmailHtml({
    recipientName: opts.recipientName,
    subName: opts.subName,
    renewalLabel: opts.renewalLabel,
    monthlyAmountLabel,
    subscriptionsUrl: `${origin}/subscriptions`,
    settingsUrl: `${origin}/settings`,
  });
  await sendEmail(opts.to, subject, html);
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

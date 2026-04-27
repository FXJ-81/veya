/**
 * Auth-related transactional emails (password reset, account verification, etc.).
 *
 * Uses the shared Veya email design system so the layout matches every other
 * transactional email the product sends.
 */
import { sendEmail } from "@/lib/sendEmail";
import {
  escapeHtml,
  firstNameRaw,
  renderEmailLayout,
  renderEmailPlainText,
  renderSummaryCard,
  sanitizeSubject,
} from "@/lib/emailLayout";

const SUPPORT_LINE_AUTH = "Didn't request this? You can safely ignore this email.";

export async function sendPasswordResetEmail(opts: {
  to: string;
  recipientName: string | null | undefined;
  resetLink: string;
  expiresInHours: number;
}): Promise<void> {
  const expiresLabel =
    opts.expiresInHours === 1 ? "1 hour" : `${opts.expiresInHours} hours`;

  const subject = sanitizeSubject("Reset your Veya password");

  const summaryCard = renderSummaryCard({
    rows: [
      { label: "Account", value: escapeHtml(opts.to) },
      {
        label: "Link expires in",
        value: escapeHtml(expiresLabel),
        helper: "For your security, this link can only be used once.",
      },
    ],
  });

  const html = renderEmailLayout({
    preheader: `Reset your Veya password. This link expires in ${expiresLabel}.`,
    category: "Account security",
    title: "Reset your password",
    greeting: `Hi ${firstNameRaw(opts.recipientName)},`,
    intro:
      "We received a request to reset the password on your Veya account. Use the button below to choose a new one.",
    contentHtml: summaryCard,
    cta: { href: opts.resetLink, label: "Reset password" },
    ctaNote: `This link expires in ${expiresLabel} and can only be used once.`,
    outroHtml: `<p style="margin:0;">If you didn't request a password reset, you can safely ignore this email — your current password will keep working. For your security, never forward this link to anyone.</p>`,
    supportLine: SUPPORT_LINE_AUTH,
  });

  const text = renderEmailPlainText({
    title: "Reset your Veya password",
    greeting: `Hi ${firstNameRaw(opts.recipientName)},`,
    intro:
      "We received a request to reset the password on your Veya account. Use the link below to choose a new one.",
    lines: [
      `Account: ${opts.to}`,
      `Link expires in: ${expiresLabel}`,
      "",
      "If you didn't request a password reset, you can safely ignore this email.",
    ],
    cta: { href: opts.resetLink, label: "Reset password" },
    supportLine: SUPPORT_LINE_AUTH,
  });

  await sendEmail({
    to: opts.to,
    subject,
    html,
    text,
    fromName: "Veya Security",
  });
}

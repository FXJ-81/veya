/**
 * Support / contact confirmation emails.
 *
 * After a user submits the in-app support form, we send a polished confirmation so they
 * know the message landed and what to expect next. Uses the shared Veya email layout.
 */
import { sendEmail } from "@/lib/sendEmail";
import {
  defaultSettingsUrl,
  escapeHtml,
  firstNameRaw,
  renderEmailLayout,
  renderEmailPlainText,
  renderSummaryCard,
  sanitizeSubject,
} from "@/lib/emailLayout";

export type SupportTopic =
  | "Support"
  | "Bug Report"
  | "Billing"
  | "Feature Request"
  | "General Question";

const TOPIC_LABEL: Record<SupportTopic, string> = {
  Support: "Support request",
  "Bug Report": "Bug report",
  Billing: "Billing question",
  "Feature Request": "Feature request",
  "General Question": "General question",
};

function trimMessagePreview(message: string, maxChars = 280): string {
  const collapsed = message.replace(/\s+/g, " ").trim();
  if (collapsed.length <= maxChars) return collapsed;
  return `${collapsed.slice(0, maxChars - 1)}…`;
}

export async function sendSupportFeedbackConfirmation(opts: {
  to: string;
  recipientName: string | null | undefined;
  topic: SupportTopic;
  message: string;
  submittedAt: Date;
}): Promise<void> {
  const topicLabel = TOPIC_LABEL[opts.topic] ?? "Message received";
  const subject = sanitizeSubject(`We received your ${topicLabel.toLowerCase()}`);

  const submittedLabel = opts.submittedAt.toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  const messagePreview = trimMessagePreview(opts.message);

  const summaryCard = renderSummaryCard({
    rows: [
      { label: "Topic", value: escapeHtml(topicLabel) },
      { label: "Submitted", value: escapeHtml(submittedLabel) },
      {
        label: "Your message",
        value: `<span style="font-weight:500;color:#1f2937;font-size:14px;line-height:1.6;">${escapeHtml(messagePreview)}</span>`,
      },
    ],
  });

  const settingsUrl = defaultSettingsUrl();

  const html = renderEmailLayout({
    preheader: `Thanks for reaching out — we received your ${topicLabel.toLowerCase()} and will follow up soon.`,
    category: "Support",
    title: "We've got your message",
    greeting: `Hi ${firstNameRaw(opts.recipientName)},`,
    intro:
      "Thanks for getting in touch with the Veya team. We've received your message and will reply as soon as we've taken a look.",
    contentHtml: summaryCard,
    cta: { href: settingsUrl, label: "Open Veya" },
    ctaNote: "We typically reply within one business day.",
    outroHtml:
      "<p style=\"margin:0;\">If you need to add more context, just reply to this email — your reply will be added to the same thread.</p>",
    supportLine: "Need to share more details? Reply directly to this email.",
  });

  const text = renderEmailPlainText({
    title: "We've got your message",
    greeting: `Hi ${firstNameRaw(opts.recipientName)},`,
    intro:
      "Thanks for getting in touch with the Veya team. We've received your message and will reply as soon as we've taken a look.",
    lines: [
      `Topic: ${topicLabel}`,
      `Submitted: ${submittedLabel}`,
      "",
      "Your message:",
      messagePreview,
    ],
    cta: { href: settingsUrl, label: "Open Veya" },
    supportLine: "Need to share more details? Reply directly to this email.",
  });

  await sendEmail({
    to: opts.to,
    subject,
    html,
    text,
    fromName: "Veya Support",
    replyTo: process.env.SUPPORT_REPLY_TO?.trim() || undefined,
  });
}

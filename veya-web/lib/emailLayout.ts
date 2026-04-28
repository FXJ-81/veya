/**
 * Veya email design system.
 *
 * One reusable, branded HTML layout for every transactional email the app sends.
 * The goal is a polished, app-quality look that renders reliably in Gmail, Apple Mail,
 * Outlook, and mobile clients, while staying readable as plain text.
 *
 * Usage:
 *   const html = renderEmailLayout({ preheader, title, intro, contentHtml, cta });
 *   const text = renderEmailPlainText({ title, intro, lines, cta });
 *   await sendEmail({ to, subject, html, text });
 *
 * Avoid <style> blocks or external CSS — many clients strip them. All styling is
 * inlined and uses a single 560px-wide table-based layout that collapses cleanly
 * on small screens.
 */

import { getGoogleOAuthOrigin } from "@/lib/googleOAuthCallback";

const BRAND = {
  name: "Veya",
  tagline: "Manage your money",
  primary: "#5b6ef5",
  primaryHover: "#4554e0",
  ink: "#0f172a",
  text: "#1f2937",
  textMuted: "#475569",
  textSubtle: "#64748b",
  textFaint: "#94a3b8",
  border: "#e2e8f0",
  surface: "#f4f5fb",
  card: "#ffffff",
  cardSoft: "#f8fafc",
} as const;

const FONT_STACK =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";

export interface EmailCta {
  href: string;
  label: string;
}

export interface EmailLayoutOptions {
  /** Hidden inbox preview text (≤ 140 chars). */
  preheader: string;
  /** Optional category label shown next to the wordmark in the header. */
  category?: string;
  /** Main heading at the top of the email body. */
  title: string;
  /** Optional greeting line, e.g. "Hello Sam,". Rendered as plain text. */
  greeting?: string;
  /** First paragraph(s) of body copy. Plain text or simple HTML allowed. */
  intro?: string;
  /** Optional pre-rendered HTML block (e.g. summary card). */
  contentHtml?: string;
  /** Primary call-to-action button. */
  cta?: EmailCta;
  /** Short note shown beneath the CTA. */
  ctaNote?: string;
  /** Final body paragraph (e.g. fallback / security explanation). */
  outroHtml?: string;
  /** Footer note explaining why the user is receiving this email. */
  reasonNote?: string;
  /** Settings / manage-preferences link in the footer. */
  manageLink?: EmailCta;
  /** Override "Need help?" support line. Defaults to support@. */
  supportLine?: string;
}

/** HTML-escape a user-supplied string so it cannot break the layout or inject markup. */
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Raw (unescaped) first name, suitable for plain-text emails. */
export function firstNameRaw(name: string | null | undefined): string {
  const trimmed = name?.trim();
  if (!trimmed) return "there";
  return trimmed.split(/\s+/)[0] ?? "there";
}

/** HTML-escaped first name for use inside HTML email greetings. */
export function firstNameOrThere(name: string | null | undefined): string {
  return escapeHtml(firstNameRaw(name));
}

/** A summary card rendered with table-based layout for inbox-safe styling. */
export function renderSummaryCard(opts: {
  heading?: string;
  rows: Array<{ label: string; value: string; helper?: string }>;
}): string {
  const headingHtml = opts.heading
    ? `<p style="margin:0 0 14px;font-family:${FONT_STACK};font-size:13px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:${BRAND.textSubtle};">${escapeHtml(opts.heading)}</p>`
    : "";

  const rowsHtml = opts.rows
    .map((row, idx) => {
      const helper = row.helper
        ? `<p style="margin:6px 0 0;font-family:${FONT_STACK};font-size:12px;line-height:1.5;color:${BRAND.textSubtle};">${escapeHtml(row.helper)}</p>`
        : "";
      const spacing = idx === 0 ? "0" : "16px";
      return `
        <tr>
          <td style="padding-top:${spacing};">
            <p style="margin:0 0 4px;font-family:${FONT_STACK};font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:${BRAND.textSubtle};">${escapeHtml(row.label)}</p>
            <p style="margin:0;font-family:${FONT_STACK};font-size:16px;line-height:1.45;color:${BRAND.ink};font-weight:600;">${row.value}</p>
            ${helper}
          </td>
        </tr>`;
    })
    .join("");

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:${BRAND.cardSoft};border:1px solid ${BRAND.border};border-radius:12px;">
      <tr>
        <td style="padding:20px 22px;">
          ${headingHtml}
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            ${rowsHtml}
          </table>
        </td>
      </tr>
    </table>`.trim();
}

/** Subject-safe single-line text (no newlines, length-capped). */
export function sanitizeSubject(subject: string, maxLen = 140): string {
  return subject.replace(/[\r\n\t]/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLen);
}

/** Default settings URL used in footers / manage-prefs links. */
export function defaultSettingsUrl(): string {
  return `${getGoogleOAuthOrigin()}/settings`;
}

/** Default support email line used in footers. */
export function defaultSupportLine(): string {
  return "Questions? Reply to this email and our team will help.";
}

/** Render a Veya-branded HTML email body. Always returns a complete HTML document. */
export function renderEmailLayout(opts: EmailLayoutOptions): string {
  const preheader = escapeHtml(opts.preheader.slice(0, 200));
  const category = opts.category ? escapeHtml(opts.category) : "";
  const title = escapeHtml(opts.title);
  const greetingHtml = opts.greeting
    ? `<p style="margin:0 0 16px;font-family:${FONT_STACK};font-size:15px;line-height:1.6;color:${BRAND.text};">${escapeHtml(opts.greeting)}</p>`
    : "";
  const introHtml = opts.intro
    ? `<p style="margin:0 0 20px;font-family:${FONT_STACK};font-size:15px;line-height:1.65;color:${BRAND.text};">${opts.intro}</p>`
    : "";
  const contentBlock = opts.contentHtml
    ? `<div style="margin:0 0 24px;">${opts.contentHtml}</div>`
    : "";
  const ctaBlock = opts.cta
    ? renderCtaBlock(opts.cta, opts.ctaNote)
    : "";
  const outroBlock = opts.outroHtml
    ? `<div style="margin:0 0 8px;font-family:${FONT_STACK};font-size:14px;line-height:1.65;color:${BRAND.textMuted};">${opts.outroHtml}</div>`
    : "";
  const supportLine = opts.supportLine ?? defaultSupportLine();
  const supportBlock = supportLine
    ? `<p style="margin:24px 0 0;font-family:${FONT_STACK};font-size:13px;line-height:1.6;color:${BRAND.textSubtle};">${escapeHtml(supportLine)}</p>`
    : "";
  const reasonBlock = opts.reasonNote
    ? `<p style="margin:0 0 12px;font-family:${FONT_STACK};font-size:12px;line-height:1.6;color:${BRAND.textFaint};">${escapeHtml(opts.reasonNote)}</p>`
    : "";
  const manageBlock = opts.manageLink
    ? `<p style="margin:0 0 4px;font-family:${FONT_STACK};font-size:13px;line-height:1.55;"><a href="${opts.manageLink.href}" style="color:${BRAND.primary};text-decoration:underline;">${escapeHtml(opts.manageLink.label)}</a></p>`
    : "";
  const categoryHtml = category
    ? `<p style="margin:6px 0 0;font-family:${FONT_STACK};font-size:13px;line-height:1.4;color:#cbd5f5;">${category}</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="color-scheme" content="light only" />
  <meta name="supported-color-schemes" content="light only" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:${BRAND.surface};font-family:${FONT_STACK};color:${BRAND.text};-webkit-font-smoothing:antialiased;">
  <div style="display:none !important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;">${preheader}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:${BRAND.surface};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background-color:${BRAND.card};border-radius:14px;overflow:hidden;border:1px solid ${BRAND.border};box-shadow:0 1px 2px rgba(15,23,42,0.04);">
          <tr>
            <td style="background-color:${BRAND.ink};padding:22px 28px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="vertical-align:middle;">
                    <p style="margin:0;font-family:${FONT_STACK};font-size:20px;font-weight:700;letter-spacing:-0.01em;color:#ffffff;">${BRAND.name}</p>
                    ${categoryHtml}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 28px 8px;">
              <h1 style="margin:0 0 18px;font-family:${FONT_STACK};font-size:22px;line-height:1.3;font-weight:700;color:${BRAND.ink};">${title}</h1>
              ${greetingHtml}
              ${introHtml}
              ${contentBlock}
              ${ctaBlock}
              ${outroBlock}
              ${supportBlock}
            </td>
          </tr>
          <tr>
            <td style="padding:24px 28px 28px;border-top:1px solid ${BRAND.border};background-color:${BRAND.cardSoft};">
              ${reasonBlock}
              ${manageBlock}
              <p style="margin:0;font-family:${FONT_STACK};font-size:12px;line-height:1.6;color:${BRAND.textFaint};">Sent by ${BRAND.name} · ${BRAND.tagline}</p>
            </td>
          </tr>
        </table>
        <p style="margin:16px 0 0;font-family:${FONT_STACK};font-size:11px;line-height:1.5;color:${BRAND.textFaint};">© ${new Date().getFullYear()} ${BRAND.name}. All rights reserved.</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function renderCtaBlock(cta: EmailCta, note?: string): string {
  const noteHtml = note
    ? `<p style="margin:14px 0 0;font-family:${FONT_STACK};font-size:13px;line-height:1.6;color:${BRAND.textSubtle};">${escapeHtml(note)}</p>`
    : "";
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:8px 0 24px;">
      <tr>
        <td bgcolor="${BRAND.primary}" style="border-radius:10px;">
          <a href="${cta.href}" style="display:inline-block;padding:14px 26px;font-family:${FONT_STACK};font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;background-color:${BRAND.primary};border:1px solid ${BRAND.primaryHover};">${escapeHtml(cta.label)}</a>
        </td>
      </tr>
    </table>
    ${noteHtml}`.trim();
}

export interface PlainTextOptions {
  title: string;
  greeting?: string;
  intro?: string;
  /** Bullet-style or label/value lines. Use empty strings as paragraph breaks. */
  lines?: string[];
  cta?: EmailCta;
  outro?: string;
  supportLine?: string;
  reasonNote?: string;
  manageLink?: EmailCta;
}

/** Render a clean plain-text fallback. Mirrors the HTML structure for screen readers and clients without HTML support. */
export function renderEmailPlainText(opts: PlainTextOptions): string {
  const parts: string[] = [];
  parts.push(opts.title);
  parts.push("");
  if (opts.greeting) {
    parts.push(opts.greeting);
    parts.push("");
  }
  if (opts.intro) {
    parts.push(stripHtmlForText(opts.intro));
    parts.push("");
  }
  if (opts.lines?.length) {
    for (const line of opts.lines) parts.push(line);
    parts.push("");
  }
  if (opts.cta) {
    parts.push(`${opts.cta.label}: ${opts.cta.href}`);
    parts.push("");
  }
  if (opts.outro) {
    parts.push(stripHtmlForText(opts.outro));
    parts.push("");
  }
  parts.push(opts.supportLine ?? defaultSupportLine());
  if (opts.reasonNote) {
    parts.push("");
    parts.push(opts.reasonNote);
  }
  if (opts.manageLink) {
    parts.push(`${opts.manageLink.label}: ${opts.manageLink.href}`);
  }
  parts.push("");
  parts.push(`— ${BRAND.name}`);
  return parts.join("\n");
}

/** Best-effort HTML → text for the small amount of inline HTML used in emails. */
function stripHtmlForText(html: string): string {
  return html
    .replace(/<br\s*\/?>(?!\n)/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export const VEYA_BRAND = BRAND;

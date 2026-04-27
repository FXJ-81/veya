import sgMail from "@sendgrid/mail";

const DEFAULT_BRAND_NAME = "Veya";
const DEFAULT_FROM_ADDRESS = "noreply@veya-beta.vercel.app";
const DEFAULT_FROM = `${DEFAULT_BRAND_NAME} <${DEFAULT_FROM_ADDRESS}>`;

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  /** Optional plain-text fallback. Strongly recommended for deliverability. */
  text?: string;
  /** Optional sender name override (e.g. "Veya Support"). */
  fromName?: string;
  /** Optional reply-to address. Useful for support flows where users may reply. */
  replyTo?: string;
}

/**
 * Resolve the configured "from" header. Accepts either a bare email address
 * (e.g. veyafinance@gmail.com) or a fully-formatted `Name <email>` string.
 * Always returns a value with a friendly display name so inbox previews look polished.
 */
function resolveFrom(fromName?: string): string {
  const raw =
    process.env.EMAIL_FROM?.trim() ||
    process.env.SENDGRID_FROM_EMAIL?.trim() ||
    "";

  const brandedName = fromName?.trim() || process.env.EMAIL_FROM_NAME?.trim() || DEFAULT_BRAND_NAME;

  if (!raw) {
    return `${brandedName} <${DEFAULT_FROM_ADDRESS}>`;
  }

  // If the env value is already formatted as "Name <email>", optionally swap the name.
  const namedMatch = raw.match(/^(.*?)<\s*([^>]+)\s*>\s*$/);
  if (namedMatch) {
    const existingName = namedMatch[1].trim().replace(/^"|"$/g, "");
    const address = namedMatch[2].trim();
    const finalName = fromName?.trim() || existingName || brandedName;
    return `${finalName} <${address}>`;
  }

  // Bare email address — wrap with the branded display name.
  if (/^[^\s@]+@[^\s@]+$/.test(raw)) {
    return `${brandedName} <${raw}>`;
  }

  // Fall back to the literal value if it is something unexpected.
  return raw || DEFAULT_FROM;
}

/**
 * Send an email via SendGrid using the Veya branded sender. Failures are logged but never thrown
 * so transactional flows (signup, sync, notifications) keep working when the email layer is down.
 */
export async function sendEmail(options: SendEmailOptions): Promise<void>;
/** @deprecated Positional form kept for legacy callers. Prefer the options object. */
export async function sendEmail(to: string, subject: string, htmlBody: string): Promise<void>;
export async function sendEmail(
  toOrOptions: string | SendEmailOptions,
  subject?: string,
  htmlBody?: string,
): Promise<void> {
  const opts: SendEmailOptions =
    typeof toOrOptions === "string"
      ? { to: toOrOptions, subject: subject ?? "", html: htmlBody ?? "" }
      : toOrOptions;

  const apiKey = process.env.SENDGRID_API_KEY?.trim();
  const from = resolveFrom(opts.fromName);

  if (!apiKey) {
    console.warn("[sendEmail] SENDGRID_API_KEY not set; skipping send");
    return;
  }

  const to = opts.to?.trim();
  if (!to) {
    console.warn("[sendEmail] missing recipient; skipping send");
    return;
  }

  const subjectClean = (opts.subject ?? "").replace(/[\r\n]/g, " ").trim();
  if (!subjectClean) {
    console.warn("[sendEmail] missing subject; skipping send");
    return;
  }

  try {
    sgMail.setApiKey(apiKey);
    await sgMail.send({
      to,
      from,
      subject: subjectClean,
      html: opts.html,
      ...(opts.text ? { text: opts.text } : {}),
      ...(opts.replyTo ? { replyTo: opts.replyTo } : {}),
    });
  } catch (err: unknown) {
    const msg =
      err && typeof err === "object" && "response" in err
        ? (err as { response?: { body?: { errors?: unknown } } }).response?.body?.errors
        : err instanceof Error
          ? err.message
          : String(err);
    console.error("[sendEmail] SendGrid error:", msg || err);
  }
}

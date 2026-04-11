import sgMail from "@sendgrid/mail";

const DEFAULT_FROM = "Veya <noreply@veya-beta.vercel.app>";

/**
 * Send email via SendGrid. Failures are logged; never throws.
 */
export async function sendEmail(to: string, subject: string, htmlBody: string): Promise<void> {
  const apiKey = process.env.SENDGRID_API_KEY?.trim();
  const from =
    process.env.EMAIL_FROM?.trim() ||
    process.env.SENDGRID_FROM_EMAIL?.trim() ||
    DEFAULT_FROM;

  if (!apiKey) {
    console.warn("[sendEmail] SENDGRID_API_KEY not set; skipping send");
    return;
  }

  if (!to?.trim()) {
    console.warn("[sendEmail] missing recipient; skipping send");
    return;
  }

  try {
    sgMail.setApiKey(apiKey);
    await sgMail.send({
      to: to.trim(),
      from,
      subject,
      html: htmlBody,
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

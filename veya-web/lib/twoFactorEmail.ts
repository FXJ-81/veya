import sgMail from "@sendgrid/mail";
import { prisma } from "./prisma";

const EXPIRY_MS = 10 * 60 * 1000;

function buildHtml(name: string, code: string) {
  return `
<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#111118;color:#f8f8ff;border-radius:16px">
  <h1 style="font-size:22px;font-weight:700;margin:0 0 8px">Your Veya login code</h1>
  <p style="color:#b0b0c8;margin:0 0 24px">Hi ${name},</p>
  <p style="color:#b0b0c8;margin:0 0 24px">Your Veya verification code is:</p>
  <div style="font-size:40px;font-weight:800;letter-spacing:12px;text-align:center;background:#1a1a26;border-radius:12px;padding:20px 0;margin:0 0 24px;color:#f8f8ff">${code}</div>
  <p style="color:#9090aa;font-size:14px;margin:0 0 8px">This code expires in 10 minutes.</p>
  <p style="color:#9090aa;font-size:14px;margin:0">If you didn&apos;t try to log in, please secure your account immediately.</p>
  <p style="color:#9090aa;font-size:14px;margin:24px 0 0">— The Veya Team</p>
</div>`;
}

function buildText(name: string, code: string) {
  return `Hi ${name},\n\nYour Veya verification code is:\n\n${code}\n\nThis code expires in 10 minutes.\nIf you didn't try to log in, please secure your account immediately.\n\n— The Veya Team`;
}

/** Generates and emails a 2FA code. Returns an error string on failure. */
export async function sendTwoFactorCode(
  userId: string,
  email: string,
  name: string,
  subject = "Your Veya verification code"
): Promise<{ error?: string }> {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    return { error: "Email not configured. Set SENDGRID_API_KEY." };
  }

  const { randomInt } = await import("crypto");
  const code = String(randomInt(100000, 1000000));
  const expires = new Date(Date.now() + EXPIRY_MS);

  await prisma.user.update({
    where: { id: userId },
    data: { twoFactorCode: code, twoFactorExpiry: expires },
  });

  const fromEmail = (process.env.SENDGRID_FROM_EMAIL || "").trim() || "noreply@veya.app";
  if (!process.env.SENDGRID_FROM_EMAIL?.trim()) {
    console.warn("[twoFactorEmail] SENDGRID_FROM_EMAIL is not set.");
  }

  sgMail.setApiKey(apiKey);
  try {
    await sgMail.send({
      to: email,
      from: fromEmail,
      subject,
      text: buildText(name, code),
      html: buildHtml(name, code),
    });
    return {};
  } catch (err: unknown) {
    const msg =
      err && typeof err === "object" && "response" in err
        ? (err as { response?: { body?: { errors?: unknown } } }).response?.body?.errors
        : err instanceof Error
          ? err.message
          : String(err);
    console.error("[twoFactorEmail] SendGrid error:", msg || err);
    const isDev = process.env.NODE_ENV !== "production";
    return {
      error: isDev && msg
        ? `Email failed: ${JSON.stringify(msg)}`
        : "Failed to send email. Try again later.",
    };
  }
}

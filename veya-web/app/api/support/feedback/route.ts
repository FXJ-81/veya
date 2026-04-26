/**
 * Support & Feedback (Settings page)
 *
 * Accepts JSON from the native form, validates it, rate-limits by user, then POSTs the payload
 * to a Google Apps Script Web App (`SUPPORT_FEEDBACK_WEBAPP_URL`). The script appends a row
 * to Google Sheets. Secrets stay on the server; the browser never sees the webhook URL.
 *
 * Env: SUPPORT_FEEDBACK_WEBAPP_URL (required), optional SUPPORT_FEEDBACK_WEBAPP_SECRET,
 *      or GOOGLE_APPS_SCRIPT_SUPPORT_URL as an alias for the web app URL.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/getAuthUser";
import {
  forwardSupportFeedbackToIngest,
  resolveSupportFeedbackWebappUrl,
} from "@/lib/supportFeedbackIngest";

/** Fields the Settings form sends; stricter rules are enforced here than in HTML5 alone. */
const bodySchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  name: z.string().trim().min(1, "Name is required.").max(200),
  topic: z.enum(["Support", "Bug Report", "Billing", "Feature Request", "General Question"]),
  message: z.string().trim().min(10, "Please enter at least 10 characters.").max(8000),
});

/** Written to the Sheet so you can filter rows that came from this UI vs other channels. */
const SOURCE_LABEL = "settings_support_form";

/** In-memory cooldown per user (best-effort on a warm serverless instance). */
const lastSubmitByUser = new Map<string, number>();
const COOLDOWN_MS = 5000;

export async function POST(req: Request) {
  // --- Auth: feedback is only for signed-in users (matches Settings visibility). ---
  const authUser = await getAuthUser(req);
  if (!authUser) {
    return NextResponse.json({ error: "You must be signed in to send feedback." }, { status: 401 });
  }

  // --- Server-side anti-spam: short cooldown per account. ---
  const now = Date.now();
  const prev = lastSubmitByUser.get(authUser.id) ?? 0;
  if (now - prev < COOLDOWN_MS) {
    return NextResponse.json(
      { error: "Please wait a few seconds before sending another message." },
      { status: 429 },
    );
  }

  // --- Parse and validate body (Zod returns user-facing strings on failure). ---
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    const first = parsed.error.flatten().fieldErrors;
    const msg =
      Object.values(first).flat()[0] ?? parsed.error.errors[0]?.message ?? "Invalid input.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  // --- Ingest URL must be configured on the server (never rely on the client for this). ---
  const webappUrl = resolveSupportFeedbackWebappUrl();
  if (!webappUrl) {
    console.error(
      "[support/feedback] Missing env: set SUPPORT_FEEDBACK_WEBAPP_URL (or alias GOOGLE_APPS_SCRIPT_SUPPORT_URL)",
    );
    const isProd = process.env.NODE_ENV === "production";
    return NextResponse.json(
      {
        error: "Support messaging isn’t connected yet.",
        code: "MISSING_SUPPORT_INGEST",
        ...(!isProd
          ? {
              details:
                "Add SUPPORT_FEEDBACK_WEBAPP_URL to your server environment (Vercel → Settings → Environment Variables, or .env locally). It must be the Google Apps Script Web app URL that appends rows to your Sheet. Copy the script from veya-web/scripts/support-feedback-ingest.gs into a script bound to your spreadsheet, deploy as a Web app, then paste the deployment URL. Optional: SUPPORT_FEEDBACK_WEBAPP_SECRET on the server and INGEST_SECRET in the script’s Project Settings → Script properties (same value).",
            }
          : {}),
      },
      { status: 503 },
    );
  }

  // --- Build payload: timestamp is authoritative from the server clock. ---
  const submittedAt = new Date().toISOString();
  const secret = process.env.SUPPORT_FEEDBACK_WEBAPP_SECRET?.trim();
  const payload = {
    submittedAt,
    userId: authUser.id,
    email: parsed.data.email,
    name: parsed.data.name,
    topic: parsed.data.topic,
    message: parsed.data.message,
    source: SOURCE_LABEL,
    ...(secret ? { ingestSecret: secret } : {}),
  };

  // --- Forward to Google Apps Script; success requires HTTP 200 + JSON { ok: true }. ---
  const ingest = await forwardSupportFeedbackToIngest(webappUrl, payload);
  if (!ingest.ok) {
    console.error("[support/feedback] ingest failed", {
      reason: ingest.reason,
      status: ingest.status,
    });
    return NextResponse.json(
      {
        error: "Could not save your message. Please try again in a moment.",
        code: "INGEST_FAILED",
        details:
          ingest.reason === "invalid_json"
            ? "The feedback service returned an unexpected response. Check the Apps Script deployment and execution logs."
            : undefined,
      },
      { status: 502 },
    );
  }

  // Only record cooldown after a successful ingest (failed attempts can retry sooner).
  lastSubmitByUser.set(authUser.id, now);
  console.log("[support/feedback] saved", { userId: authUser.id, topic: parsed.data.topic });
  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/getAuthUser";
import {
  forwardSupportFeedbackToIngest,
  resolveSupportFeedbackWebappUrl,
} from "@/lib/supportFeedbackIngest";

const bodySchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  name: z.string().trim().min(1, "Name is required.").max(200),
  topic: z.enum(["Support", "Bug Report", "Billing", "Feature Request", "General Question"]),
  message: z.string().trim().min(10, "Please enter at least 10 characters.").max(8000),
});

const SOURCE_LABEL = "settings_support_form";

/** In-memory cooldown per user (best-effort on a warm instance). */
const lastSubmitByUser = new Map<string, number>();
const COOLDOWN_MS = 5000;

export async function POST(req: Request) {
  const authUser = await getAuthUser(req);
  if (!authUser) {
    return NextResponse.json({ error: "You must be signed in to send feedback." }, { status: 401 });
  }

  const now = Date.now();
  const prev = lastSubmitByUser.get(authUser.id) ?? 0;
  if (now - prev < COOLDOWN_MS) {
    return NextResponse.json(
      { error: "Please wait a few seconds before sending another message." },
      { status: 429 },
    );
  }

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

  const webappUrl = resolveSupportFeedbackWebappUrl();
  if (!webappUrl) {
    console.error(
      "[support/feedback] Missing env: set SUPPORT_FEEDBACK_WEBAPP_URL (or alias GOOGLE_APPS_SCRIPT_SUPPORT_URL)",
    );
    return NextResponse.json(
      {
        error: "Support messaging isn’t connected yet.",
        code: "MISSING_SUPPORT_INGEST",
        details:
          "Add SUPPORT_FEEDBACK_WEBAPP_URL to your server environment (Vercel → Settings → Environment Variables, or .env locally). It must be the Google Apps Script Web app URL that appends rows to your Sheet. Copy the script from veya-web/scripts/support-feedback-ingest.gs into a script bound to your spreadsheet, deploy as a Web app, then paste the deployment URL. Optional: SUPPORT_FEEDBACK_WEBAPP_SECRET on the server and INGEST_SECRET in the script’s Project Settings → Script properties (same value).",
      },
      { status: 503 },
    );
  }

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

  const ingest = await forwardSupportFeedbackToIngest(webappUrl, payload);
  if (!ingest.ok) {
    console.error("[support/feedback] ingest failed", ingest);
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

  lastSubmitByUser.set(authUser.id, now);
  console.log("[support/feedback] saved", { userId: authUser.id, topic: parsed.data.topic });
  return NextResponse.json({ ok: true });
}

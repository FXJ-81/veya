/**
 * Server-side forward of Support & Feedback submissions to a Google Apps Script Web App
 * that appends rows to Google Sheets.
 *
 * Contract: the Web App must respond with HTTP 200 and a JSON body `{ "ok": true }` on success
 * so Veya can distinguish a real append from HTML error pages or misconfigured deployments.
 */

export type SupportFeedbackIngestPayload = {
  submittedAt: string;
  email: string;
  name: string;
  topic: string;
  message: string;
  userId: string;
  /** Fixed label so the Sheet can filter by channel. */
  source: string;
  /** When SUPPORT_FEEDBACK_WEBAPP_SECRET is set, the API adds this for the script to verify. */
  ingestSecret?: string;
};

export type SupportIngestResult =
  | { ok: true }
  | { ok: false; reason: "http_error" | "invalid_json" | "upstream_rejected"; status: number; snippet: string };

/**
 * POST JSON to the Apps Script deployment URL and require `{ "ok": true }` in the response body.
 */
export async function forwardSupportFeedbackToIngest(
  webappUrl: string,
  payload: SupportFeedbackIngestPayload,
): Promise<SupportIngestResult> {
  // 1) POST JSON (server → Google; avoids browser CORS and keeps secrets off the client).
  let res: Response;
  try {
    res = await fetch(webappUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.error("[supportFeedbackIngest] fetch threw", e);
    return {
      ok: false,
      reason: "http_error",
      status: 0,
      snippet: String(e instanceof Error ? e.message : e),
    };
  }

  // 2) Apps Script returns JSON text; non-JSON usually means wrong URL or HTML error page.
  const text = await res.text();
  let parsed: { ok?: boolean; error?: string } | null = null;
  try {
    parsed = JSON.parse(text) as { ok?: boolean; error?: string };
  } catch {
    console.error("[supportFeedbackIngest] non-JSON response", res.status, text.slice(0, 400));
    return { ok: false, reason: "invalid_json", status: res.status, snippet: text.slice(0, 300) };
  }

  // 3) HTTP status must be OK (some misconfigs return 200 with ok:false in JSON).
  if (!res.ok) {
    console.error("[supportFeedbackIngest] HTTP error", res.status, text.slice(0, 400));
    return { ok: false, reason: "http_error", status: res.status, snippet: text.slice(0, 300) };
  }

  if (parsed?.ok !== true) {
    console.error("[supportFeedbackIngest] upstream ok!==true", text.slice(0, 400));
    return {
      ok: false,
      reason: "upstream_rejected",
      status: res.status,
      snippet: text.slice(0, 300),
    };
  }

  return { ok: true };
}

/** Canonical URL; GOOGLE_APPS_SCRIPT_SUPPORT_URL is accepted as an alias. */
export function resolveSupportFeedbackWebappUrl(): string | undefined {
  const a = process.env.SUPPORT_FEEDBACK_WEBAPP_URL?.trim();
  const b = process.env.GOOGLE_APPS_SCRIPT_SUPPORT_URL?.trim();
  return a || b || undefined;
}

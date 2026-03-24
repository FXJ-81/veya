import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/getAuthUser";
import { scanGmailInbox } from "@/lib/gmailScan";

/** GET — suggestions only (no DB writes). Prefer POST /api/subscriptions/gmail-scan for import. */
export async function GET(req: Request) {
  const authUser = await getAuthUser(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { suggestions, connected, error } = await scanGmailInbox(authUser.id);
  if (!connected && !error) {
    return NextResponse.json({ connected: false, suggestions: [], error: "Gmail not connected" });
  }
  if (error) {
    return NextResponse.json(
      {
        connected: !!connected,
        suggestions: [],
        error,
      },
      { status: error.includes("expired") ? 200 : 500 }
    );
  }
  return NextResponse.json({
    connected: true,
    suggestions,
  });
}

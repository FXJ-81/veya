import { NextResponse } from "next/server";
import { consumeLastOAuthError } from "@/lib/oauthErrorBuffer";

/**
 * Dev-only: returns the last server-side OAuth/adapter error after NextAuth
 * redirected with ?error=Callback. Production returns 404 with no body.
 */
export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return new NextResponse(null, { status: 404 });
  }
  const detail = consumeLastOAuthError();
  return NextResponse.json({ detail });
}

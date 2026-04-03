import { NextResponse } from "next/server";
import { consumeLastOAuthError } from "@/lib/oauthErrorBuffer";

/**
 * Dev-only: returns the last server-side OAuth/adapter error after NextAuth
 * redirected with ?error=Callback. Production always returns { detail: null }.
 */
export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ detail: null });
  }
  const detail = consumeLastOAuthError();
  return NextResponse.json({ detail });
}

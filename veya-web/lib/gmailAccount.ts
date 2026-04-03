import type { Account } from "@prisma/client";
import { prisma } from "./prisma";

/** Treat tokens as expired this many ms before actual expiry. */
const ACCESS_SKEW_MS = 90_000;

export type GmailTokenMode = "refresh" | "access_only" | "none";

/**
 * True if stored OAuth scope includes Gmail read (or scope is missing — legacy rows
 * from Google sign-in before scope was persisted; same client always requests gmail.readonly).
 */
export function accountHasGmailScope(scope: string | null | undefined): boolean {
  if (scope == null || String(scope).trim() === "") return true;
  const s = scope.toLowerCase();
  return (
    s.includes("gmail.readonly") ||
    s.includes("gmail/readonly") ||
    s.includes("auth/gmail.readonly")
  );
}

export function gmailTokenMode(
  account: Pick<Account, "refresh_token" | "access_token" | "expires_at">,
): GmailTokenMode {
  if (account.refresh_token) return "refresh";
  if (!account.access_token) return "none";
  const exp = account.expires_at;
  if (exp == null) return "access_only";
  if (exp * 1000 > Date.now() + ACCESS_SKEW_MS) return "access_only";
  if (exp * 1000 > Date.now()) return "access_only";
  return "none";
}

export function accountCanCallGmailApi(account: Account): boolean {
  if (!accountHasGmailScope(account.scope)) return false;
  return gmailTokenMode(account) !== "none";
}

/**
 * Best Account row for Gmail API: dedicated google-gmail first, else google login account
 * with Gmail scope and a usable refresh or access token.
 */
export async function findAccountWithGmailAccess(userId: string): Promise<Account | null> {
  const rows = await prisma.account.findMany({
    where: {
      userId,
      OR: [{ provider: "google-gmail" }, { provider: "google" }],
    },
    orderBy: { id: "asc" },
  });
  const usable = rows.filter(accountCanCallGmailApi);
  const dedicated = usable.find((r) => r.provider === "google-gmail");
  if (dedicated) return dedicated;
  return usable.find((r) => r.provider === "google") ?? null;
}

export function summarizeGmailConnection(account: Account | null): {
  gmailConnected: boolean;
  hasRefresh: boolean;
  hasAccess: boolean;
  expiresAtMs: number | null;
  scopeOk: boolean;
  mode: GmailTokenMode;
  provider: string | null;
} {
  if (!account) {
    return {
      gmailConnected: false,
      hasRefresh: false,
      hasAccess: false,
      expiresAtMs: null,
      scopeOk: false,
      mode: "none",
      provider: null,
    };
  }
  const scopeOk = accountHasGmailScope(account.scope);
  const mode = gmailTokenMode(account);
  return {
    gmailConnected: scopeOk && mode !== "none",
    hasRefresh: !!account.refresh_token,
    hasAccess: !!account.access_token,
    expiresAtMs: account.expires_at != null ? account.expires_at * 1000 : null,
    scopeOk,
    mode,
    provider: account.provider,
  };
}

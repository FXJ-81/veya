import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/getAuthUser";

export const dynamic = "force-dynamic";

/**
 * GET /api/plaid/banks
 * Returns all Plaid-linked bank accounts for the authenticated user.
 * Isolated from Gmail settings logic so errors don't cross-contaminate.
 */
export async function GET(req: Request) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  let userId: string;
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) {
      console.error("[GET /api/plaid/banks] no session");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    userId = authUser.id;
  } catch (e) {
    console.error("[GET /api/plaid/banks] auth error:", e);
    return NextResponse.json({ error: "Auth failed" }, { status: 500 });
  }

  // ── Query bank accounts ───────────────────────────────────────────────────
  try {
    const accounts = await prisma.plaidAccount.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        bankName: true,
        lastSync: true,
        createdAt: true,
      },
    });

    console.log("[GET /api/plaid/banks] userId", userId, "found", accounts.length, "accounts");

    return NextResponse.json({
      ok: true,
      accounts: accounts.map((a) => ({
        id: a.id,
        bankName: a.bankName ?? "Bank",
        lastSync: a.lastSync?.toISOString() ?? null,
        connectedAt: a.createdAt.toISOString(),
      })),
    });
  } catch (e) {
    console.error("[GET /api/plaid/banks] DB error:", e);
    return NextResponse.json(
      { error: "Failed to load bank accounts", detail: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/plaid/banks
 * Returns all Plaid-linked bank accounts for the authenticated user.
 * Isolated from Gmail settings logic so errors don't cross-contaminate.
 */
export async function GET() {
  // ── Auth ──────────────────────────────────────────────────────────────────
  let userId: string;
  try {
    const session = await getServerSession(authOptions);
    const su = session?.user as { id?: string; email?: string | null } | undefined;

    if (su?.id) {
      userId = su.id;
    } else if (su?.email) {
      const user = await prisma.user.findFirst({
        where: { email: { equals: su.email.trim(), mode: "insensitive" } },
        select: { id: true },
      });
      if (!user) {
        console.error("[GET /api/plaid/banks] session email not found in DB", su.email);
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      userId = user.id;
    } else {
      console.error("[GET /api/plaid/banks] no session");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
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

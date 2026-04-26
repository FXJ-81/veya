import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/getAuthUser";
import { prisma } from "@/lib/prisma";
import { getPlaidClient } from "@/lib/plaidServer";
import { rateLimitAllow } from "@/lib/rateLimitInMemory";

export async function POST(req: Request) {
  const authUser = await getAuthUser(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!rateLimitAllow(`plaid:exchange:${authUser.id}`, 60, 60 * 60 * 1000)) {
    return NextResponse.json(
      { error: "Too many link attempts. Try again later." },
      { status: 429 },
    );
  }

  let body: { public_token?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body?.public_token || typeof body.public_token !== "string") {
    return NextResponse.json({ error: "Missing public_token" }, { status: 400 });
  }

  const publicToken = body.public_token.trim();
  if (publicToken.length < 10 || publicToken.length > 4096) {
    return NextResponse.json({ error: "Invalid public_token" }, { status: 400 });
  }

  try {
    const plaid = getPlaidClient();
    const res = await plaid.itemPublicTokenExchange({
      public_token: publicToken,
    });
    const access_token = res.data.access_token;
    const item_id = res.data.item_id;

    let bankName: string | null = null;
    try {
      const itemRes = await plaid.itemGet({ access_token });
      bankName =
        itemRes.data.item.institution_name ??
        itemRes.data.item.institution_id ??
        null;
    } catch {
      /* optional enrichment */
    }

    const existing = await prisma.plaidAccount.findUnique({
      where: { itemId: item_id },
    });
    if (existing && existing.userId !== authUser.id) {
      return NextResponse.json({ error: "This bank is linked to another account" }, { status: 409 });
    }

    if (existing) {
      await prisma.plaidAccount.update({
        where: { id: existing.id },
        data: { accessToken: access_token, bankName: bankName ?? existing.bankName },
      });
    } else {
      await prisma.plaidAccount.create({
        data: {
          userId: authUser.id,
          accessToken: access_token,
          itemId: item_id,
          bankName,
        },
      });
    }

    console.log("[POST /api/plaid/exchange-token] linked item", item_id, "user", authUser.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[POST /api/plaid/exchange-token]", e);
    return NextResponse.json({ error: "Failed to exchange token" }, { status: 500 });
  }
}

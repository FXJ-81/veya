import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/getAuthUser";
import { prisma } from "@/lib/prisma";
import { getPlaidClient } from "@/lib/plaidServer";

export async function POST(req: Request) {
  const authUser = await getAuthUser(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { public_token?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body?.public_token || typeof body.public_token !== "string") {
    return NextResponse.json({ error: "Missing public_token" }, { status: 400 });
  }

  try {
    const plaid = getPlaidClient();
    const res = await plaid.itemPublicTokenExchange({
      public_token: body.public_token,
    });
    const access_token = res.data.access_token;
    const item_id = res.data.item_id;

    await prisma.user.update({
      where: { id: authUser.id },
      data: {
        plaidAccessToken: access_token,
        plaidItemId: item_id,
        plaidLinked: true,
      },
    });

    console.log("[POST /api/plaid/exchange-token] linked item", item_id, "user", authUser.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[POST /api/plaid/exchange-token]", e);
    return NextResponse.json({ error: "Failed to exchange token" }, { status: 500 });
  }
}

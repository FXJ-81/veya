import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/getAuthUser";
import { prisma } from "@/lib/prisma";
import { getPlaidClient } from "@/lib/plaidServer";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const authUser = await getAuthUser(_req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = params;
  const row = await prisma.plaidAccount.findFirst({
    where: { id, userId: authUser.id },
  });
  if (!row) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  try {
    const plaid = getPlaidClient();
    await plaid.itemRemove({ access_token: row.accessToken });
  } catch (e) {
    console.error("[DELETE /api/plaid/accounts/[id]] itemRemove", e);
  }

  await prisma.plaidAccount.delete({ where: { id: row.id } });
  return NextResponse.json({ ok: true });
}

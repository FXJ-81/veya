import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/getAuthUser";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  confirm: z.literal("CLEAR_ALL_SUBSCRIPTIONS"),
});

/**
 * Deletes **all** `Subscription` rows for the signed-in user.
 * Requires explicit JSON `{ "confirm": "CLEAR_ALL_SUBSCRIPTIONS" }` to avoid accidental wipes.
 * Does **not** remove Plaid links or `plaidDeclinedMerchantKeys` (decline memory stays intact).
 */
export async function POST(req: Request) {
  const authUser = await getAuthUser(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Body must be { "confirm": "CLEAR_ALL_SUBSCRIPTIONS" }' },
      { status: 400 },
    );
  }

  const result = await prisma.subscription.deleteMany({
    where: { userId: authUser.id },
  });

  return NextResponse.json({ ok: true, deleted: result.count });
}

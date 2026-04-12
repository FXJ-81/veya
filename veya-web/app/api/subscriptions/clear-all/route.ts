import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/getAuthUser";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  confirm: z.literal("CLEAR_ALL_SUBSCRIPTIONS"),
});

/**
 * Deletes all subscriptions for the authenticated user. Does not clear Plaid declined-merchant preferences.
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

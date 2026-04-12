/**
 * Persists normalized merchant keys the user **declined** from Plaid scan suggestions.
 * Used by the scan modal + Settings so auto-sync never re-adds those merchants without consent.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/getAuthUser";
import { prisma } from "@/lib/prisma";
import { mergeDeclinedMerchantKeys, removeKeysFromDeclinedList } from "@/lib/plaidSyncCore";

const patchSchema = z.object({
  addKeys: z.array(z.string()).optional(),
  removeKeys: z.array(z.string()).optional(),
});

export async function PATCH(req: Request) {
  const authUser = await getAuthUser(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const { addKeys = [], removeKeys = [] } = parsed.data;

  const current = await prisma.userSettings.findUnique({
    where: { userId: authUser.id },
    select: { plaidDeclinedMerchantKeys: true },
  });

  let next = current?.plaidDeclinedMerchantKeys ?? [];
  if (removeKeys.length > 0) {
    next = removeKeysFromDeclinedList(next, removeKeys);
  }
  if (addKeys.length > 0) {
    next = mergeDeclinedMerchantKeys(next, addKeys);
  }

  await prisma.userSettings.upsert({
    where: { userId: authUser.id },
    create: { userId: authUser.id, plaidDeclinedMerchantKeys: next },
    update: { plaidDeclinedMerchantKeys: next },
  });

  return NextResponse.json({ ok: true, count: next.length });
}

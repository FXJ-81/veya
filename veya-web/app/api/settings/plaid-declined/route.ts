/**
 * Persists normalized merchant keys the user **declined** from Plaid scan suggestions.
 * Used by the scan modal + settings flows so auto-sync never re-adds those merchants without consent.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/getAuthUser";
import { markPlaidCandidatesAddedByKeys, markPlaidCandidatesDeclinedByKeys } from "@/lib/plaidCandidateState";

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
  if (removeKeys.length > 0) {
    await markPlaidCandidatesAddedByKeys(authUser.id, removeKeys);
  }
  if (addKeys.length > 0) {
    await markPlaidCandidatesDeclinedByKeys(authUser.id, addKeys);
  }

  return NextResponse.json({
    ok: true,
    added: addKeys.length,
    removed: removeKeys.length,
  });
}

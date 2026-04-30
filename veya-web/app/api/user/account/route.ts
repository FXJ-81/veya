import { NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { getAuthUser } from "@/lib/getAuthUser";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function clearAuthCookies(res: NextResponse) {
  const names = [
    "next-auth.session-token",
    "__Secure-next-auth.session-token",
    "next-auth.csrf-token",
    "__Host-next-auth.csrf-token",
    "next-auth.callback-url",
    "__Secure-next-auth.callback-url",
  ];
  for (const name of names) {
    res.headers.append(
      "Set-Cookie",
      `${name}=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`,
    );
  }
}

type DeleteBody = {
  confirmationPhrase?: string;
  currentPassword?: string;
};

/**
 * Permanently removes the signed-in user.
 *
 * Data removed (via Prisma `onDelete: Cascade` on `User` unless noted):
 * - `User` row
 * - `Account`, `Session` (OAuth + sessions)
 * - `Subscription`, `Budget`, `AIConversation`, `Notification`, `SpendingHistory`
 * - `UserSettings`, `PlaidAccount`, `PlaidSubscriptionCandidate`, `AiMessageUsage`
 * - `FamilyMember` rows for this user
 *
 * Explicit delete (no FK from `Family.adminId` → `User`):
 * - `Family` rows where this user is `adminId` (and their `FamilyMember` rows cascade)
 */
export async function DELETE(req: Request) {
  const authUser = await getAuthUser(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: DeleteBody = {};
  try {
    const text = await req.text();
    if (text.trim()) body = JSON.parse(text) as DeleteBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body.confirmationPhrase?.trim() !== "DELETE") {
    return NextResponse.json(
      { error: "Confirmation required. Type DELETE exactly to confirm." },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: authUser.id },
    select: { id: true, password: true },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (user.password) {
    const pw = body.currentPassword?.trim() ?? "";
    if (!pw || !(await compare(pw, user.password))) {
      return NextResponse.json(
        { error: "Current password is incorrect." },
        { status: 401 },
      );
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.family.deleteMany({ where: { adminId: user.id } });
      await tx.user.delete({ where: { id: user.id } });
    });

    const res = NextResponse.json({ ok: true });
    clearAuthCookies(res);
    return res;
  } catch (e) {
    console.error("[DELETE /api/user/account] failed", e);
    return NextResponse.json(
      { error: "Could not delete account. Try again or contact support." },
      { status: 500 },
    );
  }
}

import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/getAuthUser";
import { prisma } from "@/lib/prisma";

function clearAuthCookies(res: NextResponse) {
  // Clear common NextAuth cookies (both secure + non-secure variants).
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
      `${name}=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`
    );
  }
}

export async function DELETE(req: Request) {
  const authUser = await getAuthUser(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await prisma.$transaction(async (tx) => {
      await tx.subscription.deleteMany({ where: { userId: authUser.id } });
      await tx.aIConversation.deleteMany({ where: { userId: authUser.id } });
      await tx.notification.deleteMany({ where: { userId: authUser.id } });
      await tx.userSettings.deleteMany({ where: { userId: authUser.id } });
      await tx.session.deleteMany({ where: { userId: authUser.id } });
      await tx.account.deleteMany({ where: { userId: authUser.id } });
      await tx.user.delete({ where: { id: authUser.id } });
    });

    const res = NextResponse.json({ ok: true });
    clearAuthCookies(res);
    return res;
  } catch (e) {
    console.error("[DELETE /api/user/account] failed", e);
    return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
  }
}


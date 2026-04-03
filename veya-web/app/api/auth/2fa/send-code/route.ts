import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/getAuthUser";
import { prisma } from "@/lib/prisma";
import { sendTwoFactorCode } from "@/lib/twoFactorEmail";

/** Authenticated endpoint — used in Settings to enable/disable 2FA */
export async function POST(req: Request) {
  const authUser = await getAuthUser(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: authUser.id },
    select: { id: true, email: true, name: true },
  });
  if (!user?.email) {
    return NextResponse.json({ error: "No email on account" }, { status: 400 });
  }

  const { error } = await sendTwoFactorCode(
    user.id,
    user.email,
    user.name?.split(" ")[0] ?? "there",
    "Your Veya verification code"
  );

  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json({ success: true });
}

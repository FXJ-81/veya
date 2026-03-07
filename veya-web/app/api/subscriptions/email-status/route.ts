import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/getAuthUser";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const authUser = await getAuthUser(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Connected if they signed in with Google (no separate "Connect Gmail" step)
  const account = await prisma.account.findFirst({
    where: {
      userId: authUser.id,
      provider: { in: ["google", "google-gmail"] },
    },
  });
  return NextResponse.json({ connected: !!account?.refresh_token });
}

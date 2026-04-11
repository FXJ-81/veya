import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/getAuthUser";
import { generateNotificationsForUser } from "@/lib/generateUserNotifications";

export async function POST(_req: Request) {
  const authUser = await getAuthUser(_req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await generateNotificationsForUser(authUser.id);
  } catch (e) {
    console.error("[notifications/generate]", e);
    return NextResponse.json({ error: "Generate failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

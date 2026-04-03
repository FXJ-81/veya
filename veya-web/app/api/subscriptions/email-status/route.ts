import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/getAuthUser";
import { findAccountWithGmailAccess, summarizeGmailConnection } from "@/lib/gmailAccount";

export async function GET(req: Request) {
  const authUser = await getAuthUser(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const account = await findAccountWithGmailAccess(authUser.id);
  const { gmailConnected } = summarizeGmailConnection(account);
  return NextResponse.json({ connected: gmailConnected });
}

import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/getAuthUser";
import { parseSubscriptionEmailText } from "@/lib/parseSubscriptionEmail";

export async function POST(req: Request) {
  const authUser = await getAuthUser(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: { text?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) {
    return NextResponse.json({ error: "Paste some email or receipt text" }, { status: 400 });
  }
  const suggestions = parseSubscriptionEmailText(text);
  return NextResponse.json({ suggestions });
}

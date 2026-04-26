import { NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signToken } from "@/lib/jwt";
import { getClientIp, rateLimitAllow } from "@/lib/rateLimitInMemory";

export async function POST(req: Request) {
  const ip = getClientIp(req);
  if (!rateLimitAllow(`auth:token:${ip}`, 80, 15 * 60 * 1000)) {
    return NextResponse.json(
      { error: "Too many sign-in attempts. Try again later." },
      { status: 429 },
    );
  }

  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { email, password } = body;
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password required" }, { status: 400 });
  }
  if (typeof password === "string" && password.length > 128) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }
  const normalized = email.trim().toLowerCase();
  if (!rateLimitAllow(`auth:token:email:${normalized}`, 40, 15 * 60 * 1000)) {
    return NextResponse.json(
      { error: "Too many sign-in attempts. Try again later." },
      { status: 429 },
    );
  }
  try {
    const user = await prisma.user.findUnique({ where: { email: normalized } });
    if (!user?.password) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }
    const valid = await compare(password, user.password);
    if (!valid) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }
    const accessToken = await signToken(user.id);
    return NextResponse.json({
      accessToken,
      user: { id: user.id, email: user.email, name: user.name },
    });
  } catch {
    console.error("[auth/token] sign-in failed");
    return NextResponse.json({ error: "Sign-in failed. Try again later." }, { status: 500 });
  }
}

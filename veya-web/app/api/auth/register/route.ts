import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getClientIp, rateLimitAllow } from "@/lib/rateLimitInMemory";

const schema = z.object({
  name: z.string().optional().transform((s) => (s?.trim() || undefined)),
  email: z.string().email("Invalid email").transform((s) => s.trim().toLowerCase()),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password is too long"),
});

const isDev = process.env.NODE_ENV === "development";

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const registerCap = isDev ? 200 : 25;
  if (!rateLimitAllow(`auth:register:${ip}`, registerCap, 60 * 60 * 1000)) {
    return NextResponse.json(
      { error: "Too many registration attempts. Try again later." },
      { status: 429 },
    );
  }

  if (isDev) console.log("[register] POST /api/auth/register");
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    console.error("[register] Invalid JSON");
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (isDev && body && typeof body === "object") {
    console.log("[register] body keys:", Object.keys(body as object));
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.errors[0];
    const message = firstError ? firstError.message : parsed.error.message;
    if (isDev) console.error("[register] Validation failed:", parsed.error.flatten());
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { name, email, password } = parsed.data;
  if (isDev) console.log("[register] validation ok");

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      if (isDev) console.log("[register] conflict: email exists");
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }

    const hashed = await hash(password, 12);
    const user = await prisma.user.create({
      data: { name: name ?? null, email, password: hashed },
    });
    if (isDev) console.log("[register] user created", user.id);

    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
    });
  } catch {
    console.error("[register] Database or server error");
    return NextResponse.json(
      { error: "Registration failed. Try again later." },
      { status: 500 },
    );
  }
}

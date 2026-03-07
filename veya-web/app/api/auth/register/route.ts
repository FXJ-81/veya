import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  name: z.string().optional().transform((s) => (s?.trim() || undefined)),
  email: z.string().email("Invalid email").transform((s) => s.trim().toLowerCase()),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function POST(req: Request) {
  console.log("[register] POST /api/auth/register hit");
  let body: unknown;
  try {
    body = await req.json();
  } catch (e) {
    console.error("[register] Invalid JSON:", e);
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.errors[0];
    const message = firstError ? firstError.message : parsed.error.message;
    console.error("[register] Validation failed:", parsed.error.errors);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { name, email, password } = parsed.data;

  try {
    console.log("[register] Checking existing user for:", email);
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      console.log("[register] Email already registered:", email);
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }

    console.log("[register] Hashing password");
    const hashed = await hash(password, 12);

    console.log("[register] Creating user in database");
    const user = await prisma.user.create({
      data: { name: name ?? null, email, password: hashed },
    });
    console.log("[register] User created:", user.id, user.email);

    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
    });
  } catch (e) {
    console.error("[register] Database or server error:", e);
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? message : "Sign up failed. Try again." },
      { status: 500 }
    );
  }
}

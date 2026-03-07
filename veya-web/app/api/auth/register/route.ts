import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma"; // Prisma client from lib/prisma.ts

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

  console.log("[register] Parsed body keys:", body && typeof body === "object" ? Object.keys(body as object) : "not object");
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.errors[0];
    const message = firstError ? firstError.message : parsed.error.message;
    console.error("[register] Validation failed:", parsed.error.errors);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { name, email, password } = parsed.data;
  console.log("[register] Validation OK. email:", email, "name:", name ?? "(empty)");

  try {
    console.log("[register] Step 1: Checking existing user for:", email);
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      console.log("[register] Email already registered:", email);
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }

    console.log("[register] Step 2: Hashing password with bcrypt");
    const hashed = await hash(password, 12);
    console.log("[register] Step 2 done: password hashed");

    console.log("[register] Step 3: Creating user in database via Prisma");
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
      { error: message },
      { status: 500 }
    );
  }
}

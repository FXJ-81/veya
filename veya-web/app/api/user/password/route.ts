import { NextResponse } from "next/server";
import { compare, hash } from "bcryptjs";
import { z } from "zod";
import { getAuthUser } from "@/lib/getAuthUser";
import { prisma } from "@/lib/prisma";

const schema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(8),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export async function PUT(req: Request) {
  const authUser = await getAuthUser(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    const msg =
      flat.fieldErrors.confirmPassword?.[0] ??
      flat.fieldErrors.newPassword?.[0] ??
      flat.fieldErrors.currentPassword?.[0] ??
      flat.formErrors[0] ??
      "Invalid input";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const { currentPassword, newPassword } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { id: authUser.id },
    select: { password: true },
  });

  if (!user?.password) {
    return NextResponse.json(
      { error: "No password set for this account. Sign in with Google or use forgot password to set one." },
      { status: 400 }
    );
  }

  const valid = await compare(currentPassword, user.password);
  if (!valid) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
  }

  const hashedPassword = await hash(newPassword, 12);
  await prisma.user.update({
    where: { id: authUser.id },
    data: { password: hashedPassword },
  });

  return NextResponse.json({ ok: true, message: "Password updated." });
}

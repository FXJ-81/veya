import * as jose from "jose";
import { prisma } from "./prisma";

const SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET ?? "fallback-secret-change-in-production"
);

export async function signToken(userId: string): Promise<string> {
  return new jose.SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30d")
    .sign(SECRET);
}

export async function verifyToken(token: string): Promise<{ userId: string } | null> {
  try {
    const { payload } = await jose.jwtVerify(token, SECRET);
    const sub = payload.sub;
    return sub ? { userId: sub } : null;
  } catch {
    return null;
  }
}

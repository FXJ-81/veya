import * as jose from "jose";

let cachedSecret: Uint8Array | null = null;

function getJwtSecretKey(): Uint8Array {
  if (cachedSecret) {
    return cachedSecret;
  }
  const raw = process.env.NEXTAUTH_SECRET?.trim();
  if (!raw) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "NEXTAUTH_SECRET must be set in production (required for API bearer token signing).",
      );
    }
    cachedSecret = new TextEncoder().encode(
      "dev-only-insecure-jwt-secret-not-for-production",
    );
    return cachedSecret;
  }
  cachedSecret = new TextEncoder().encode(raw);
  return cachedSecret;
}

export async function signToken(userId: string): Promise<string> {
  return new jose.SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30d")
    .sign(getJwtSecretKey());
}

export async function verifyToken(token: string): Promise<{ userId: string } | null> {
  try {
    const { payload } = await jose.jwtVerify(token, getJwtSecretKey());
    const sub = payload.sub;
    return sub ? { userId: sub } : null;
  } catch {
    return null;
  }
}

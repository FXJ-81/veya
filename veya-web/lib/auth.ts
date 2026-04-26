import { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { compare } from "bcryptjs";
import { applyCanonicalNextAuthUrlForOAuth } from "./googleOAuthCallback";
import { prisma } from "./prisma";
import { recordOAuthError } from "./oauthErrorBuffer";
import { authDevLog } from "./authDevLog";
import type { Adapter, AdapterUser } from "next-auth/adapters";

applyCanonicalNextAuthUrlForOAuth();

function normalizeEmail(email: string | undefined | null): string | null {
  if (email == null || typeof email !== "string") return null;
  const t = email.trim().toLowerCase();
  return t.length ? t : null;
}

/** Match credentials-registered users and legacy rows regardless of email casing. */
async function findUserByEmailCaseInsensitive(email: string) {
  const n = normalizeEmail(email);
  if (!n) return null;
  return prisma.user.findFirst({
    where: { email: { equals: n, mode: "insensitive" } },
  });
}

/* ------------------------------------------------------------------ */
/*  Robust adapter wrapper                                            */
/*  Wraps PrismaAdapter so that Google OAuth never fails silently     */
/*  with the generic "Callback" error.  Two key fixes:                */
/*   1. Filter data to only Prisma-known columns before create()      */
/*      (openid-client can return extra fields like expires_in)       */
/*   2. Gracefully handle unique-constraint races (P2002)             */
/* ------------------------------------------------------------------ */

const USER_FIELDS = new Set([
  "id", "name", "email", "emailVerified", "image",
]);

const ACCOUNT_FIELDS = new Set([
  "id", "userId", "type", "provider", "providerAccountId",
  "refresh_token", "access_token", "expires_at",
  "token_type", "scope", "id_token", "session_state",
]);

function pick(obj: Record<string, unknown>, allowed: Set<string>) {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(obj)) {
    if (allowed.has(k) && obj[k] !== undefined) out[k] = obj[k];
  }
  return out;
}

function createRobustAdapter(): Adapter {
  const base = PrismaAdapter(prisma);

  return {
    ...base,

    /* ---------- createUser ---------- */
    createUser: async (raw: Record<string, unknown>) => {
      const data = pick(raw, USER_FIELDS);
      const stripped = Object.keys(raw).filter((k) => !USER_FIELDS.has(k));
      const emailNorm = normalizeEmail(data.email as string | undefined);
      if (emailNorm) data.email = emailNorm;

      authDevLog("[auth][createUser] start", {
        email: data.email,
        name: data.name,
        hasEmailVerified: data.emailVerified != null,
        ...(stripped.length ? { strippedFields: stripped } : {}),
      });

      try {
        const user = await prisma.user.create({ data: data as never });
        authDevLog("[auth][createUser] success userId:", user.id, "email:", user.email);
        return user as AdapterUser;
      } catch (err: unknown) {
        const code = (err as { code?: string }).code;
        if (code === "P2002" && data.email) {
          authDevLog("[auth][createUser] P2002 unique violation — resolving existing user by email");
          const existing = await findUserByEmailCaseInsensitive(data.email as string);
          if (existing) {
            authDevLog("[auth][createUser] returning existing userId:", existing.id);
            return existing as AdapterUser;
          }
        }
        recordOAuthError("createUser", err);
        console.error("[auth][createUser] FAILED:", err);
        throw err;
      }
    },

    /* ---------- linkAccount ---------- */
    linkAccount: async (raw: Record<string, unknown>) => {
      const data = pick(raw, ACCOUNT_FIELDS);
      const stripped = Object.keys(raw).filter((k) => !ACCOUNT_FIELDS.has(k));
      authDevLog("[auth][linkAccount]", {
        provider: data.provider, userId: data.userId,
        ...(stripped.length ? { strippedFields: stripped } : {}),
      });

      try {
        const acct = await prisma.account.create({ data: data as never });
        authDevLog("[auth][linkAccount] OK");
        return acct as never;
      } catch (err: unknown) {
        const code = (err as { code?: string }).code;
        if (code === "P2002") {
          authDevLog("[auth][linkAccount] P2002 – updating existing account");
          const existing = await prisma.account.findFirst({
            where: {
              provider: data.provider as string,
              providerAccountId: data.providerAccountId as string,
            },
          });
          if (existing) {
            const updated = await prisma.account.update({
              where: { id: existing.id },
              data: {
                userId: data.userId as string,
                refresh_token: (data.refresh_token as string) ?? undefined,
                access_token: (data.access_token as string) ?? undefined,
                expires_at: (data.expires_at as number) ?? undefined,
                token_type: (data.token_type as string) ?? undefined,
                scope: (data.scope as string) ?? undefined,
                id_token: (data.id_token as string) ?? undefined,
                session_state: (data.session_state as string) ?? undefined,
              },
            });
            authDevLog("[auth][linkAccount] OK (updated existing)");
            return updated as never;
          }
        }
        recordOAuthError("linkAccount", err);
        console.error("[auth][linkAccount] FAILED:", err);
        throw err;
      }
    },

    /* ---------- updateUser (normalize email for Google profile updates) ---------- */
    updateUser: async (data) => {
      const { id, ...raw } = data as AdapterUser & Record<string, unknown>;
      const rest = pick(raw as Record<string, unknown>, USER_FIELDS);
      if (typeof rest.email === "string") {
        const n = normalizeEmail(rest.email);
        if (n) rest.email = n;
      }
      authDevLog("[auth][updateUser] start", { id, keys: Object.keys(rest) });
      try {
        const user = await prisma.user.update({
          where: { id },
          data: rest as never,
        });
        authDevLog("[auth][updateUser] success userId:", user.id);
        return user as AdapterUser;
      } catch (err) {
        recordOAuthError("updateUser", err);
        console.error("[auth][updateUser] FAILED:", err);
        throw err;
      }
    },

    /* ---------- getUserByEmail ---------- */
    getUserByEmail: async (email: string) => {
      authDevLog("[auth][getUserByEmail] lookup", email);
      try {
        const user = await findUserByEmailCaseInsensitive(email);
        console.log(
          "[auth][getUserByEmail]",
          user ? `found userId=${user.id} emailInDb=${user.email}` : "no user for this email (any casing)",
        );
        return user as AdapterUser | null;
      } catch (err) {
        recordOAuthError("getUserByEmail", err);
        console.error("[auth][getUserByEmail] FAILED:", err);
        throw err;
      }
    },

    /* ---------- getUserByAccount ---------- */
    getUserByAccount: async (provider_providerAccountId) => {
      authDevLog("[auth][getUserByAccount]",
        provider_providerAccountId.provider,
        provider_providerAccountId.providerAccountId,
      );
      try {
        const user = await base.getUserByAccount!(provider_providerAccountId);
        authDevLog("[auth][getUserByAccount]", user ? `found ${user.id}` : "not found");
        return user;
      } catch (err) {
        recordOAuthError("getUserByAccount", err);
        console.error("[auth][getUserByAccount] FAILED:", err);
        throw err;
      }
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Auth options                                                      */
/* ------------------------------------------------------------------ */

/**
 * Google sign-in uses NextAuth at `/api/auth/callback/google` only.
 * In Google Cloud, Authorized redirect URIs must be exactly (see `lib/googleOAuthCallback.ts`):
 * - http://localhost:3000/api/auth/callback/google
 * - https://veya-beta.vercel.app/api/auth/callback/google
 * Set NEXTAUTH_URL to the matching origin (no trailing slash).
 */
export const authOptions: NextAuthOptions = {
  adapter: createRobustAdapter(),
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const user = await prisma.user.findUnique({
          where: { email: credentials.email.trim().toLowerCase() },
        });
        if (!user?.password) return null;
        const valid = await compare(credentials.password, user.password);
        if (!valid) return null;
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            allowDangerousEmailAccountLinking: true,
            authorization: {
              params: {
                scope:
                  "openid email profile https://www.googleapis.com/auth/gmail.readonly",
                access_type: "offline",
                prompt: "consent",
              },
            },
          }),
        ]
      : []),
  ],
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: "/sign-in" },
  events: {
    async signIn({ user, account, isNewUser }) {
      authDevLog("[auth][event signIn]", {
        provider: account?.provider,
        userId: user.id,
        email: user.email,
        isNewUser: isNewUser ?? undefined,
      });
    },
  },
  debug: process.env.NODE_ENV === "development",
  logger: {
    error(code, metadata) {
      if (process.env.NODE_ENV === "development") {
        console.error("[auth][nextauth-error]", code, metadata);
      } else if (metadata instanceof Error) {
        console.error("[auth][nextauth-error]", code, metadata.message);
      } else {
        console.error("[auth][nextauth-error]", code);
      }
    },
    warn(code) {
      console.warn("[auth][nextauth-warn]", code);
    },
    debug(code, metadata) {
      authDevLog("[auth][nextauth-debug]", code, metadata);
    },
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "google") {
        const profileEmail = (profile as { email?: string })?.email;
        const email = profileEmail ?? user.email;
        authDevLog("[auth][signIn cb] Google allow check:", {
          profileEmail,
          userEmail: user.email,
          userId: user.id,
          name: user.name,
        });

        const emailNorm = normalizeEmail(email);
        if (!emailNorm) {
          console.error("[auth][signIn cb] denied: no usable email on Google profile");
          return "/sign-in?error=" +
            encodeURIComponent("Google account has no email address.");
        }

        const existingByEmail = await findUserByEmailCaseInsensitive(emailNorm);
        const existingGoogleAccount =
          account.providerAccountId
            ? await prisma.account.findFirst({
                where: {
                  provider: "google",
                  providerAccountId: account.providerAccountId,
                },
              })
            : null;

        authDevLog("[auth][signIn cb] Google linkage snapshot:", {
          existingUserByEmail: existingByEmail?.id ?? null,
          existingGoogleAccountRow: existingGoogleAccount?.id ?? null,
          googleAccountUserId: existingGoogleAccount?.userId ?? null,
        });

        return true;
      }
      return true;
    },

    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.picture = user.image;
      }
      if (account?.provider) {
        token.provider = account.provider;
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        (session.user as { id: string }).id = token.id as string;
      }
      (session as { provider?: string }).provider =
        (token.provider as string) ?? undefined;
      return session;
    },
  },
};

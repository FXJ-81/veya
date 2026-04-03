import { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { compare } from "bcryptjs";
import { applyCanonicalNextAuthUrlForOAuth } from "./googleOAuthCallback";
import { prisma } from "./prisma";

applyCanonicalNextAuthUrlForOAuth();
const effectiveNextAuthUrl = process.env.NEXTAUTH_URL;
console.log("[auth] Effective NEXTAUTH_URL:", effectiveNextAuthUrl);

// Surface configuration problems early in logs
if (!process.env.NEXTAUTH_SECRET) {
  console.error("[auth] NEXTAUTH_SECRET is not set — NextAuth callbacks will fail");
}
if (!effectiveNextAuthUrl && process.env.VERCEL !== "1") {
  console.warn("[auth] NEXTAUTH_URL is not set");
}
if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  console.warn("[auth] Google OAuth env vars missing; Google provider disabled");
} else {
  console.log("[auth] Google OAuth provider enabled");
}

/**
 * Google sign-in uses NextAuth at `/api/auth/callback/google` only.
 * In Google Cloud, register both local and current deployed callback URLs.
 * Set NEXTAUTH_URL to the matching origin (no trailing slash).
 */
export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          console.log("[auth] authorize: missing credentials");
          return null;
        }
        try {
          const user = await prisma.user.findUnique({
            where: { email: credentials.email.trim().toLowerCase() },
          });
          if (!user?.password) {
            console.log("[auth] authorize: user not found or no password");
            return null;
          }
          const valid = await compare(credentials.password, user.password);
          if (!valid) {
            console.log("[auth] authorize: invalid password");
            return null;
          }
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
          };
        } catch (err) {
          console.error("[auth] authorize error:", err);
          return null;
        }
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
                // Include consent when you need a new refresh_token (e.g. after revoking access)
                prompt: "consent",
              },
            },
          }),
        ]
      : []),
  ],
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: "/sign-in", error: "/sign-in" },
  debug: process.env.NODE_ENV !== "production",
  logger: {
    error(code, metadata) {
      console.error("[nextauth][error]", code, metadata);
    },
    warn(code) {
      console.warn("[nextauth][warn]", code);
    },
    debug(code, metadata) {
      console.log("[nextauth][debug]", code, metadata);
    },
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      try {
        console.log("[auth] signIn callback entry", {
          provider: account?.provider,
          userId: user?.id,
          email: user?.email,
          providerAccountId: account?.providerAccountId,
        });
        if (account?.provider === "google") {
          if (!user?.email) {
            console.error("[auth] Google callback missing user email", { profile });
            return false;
          }
          console.log("[auth] Google callback accepted for email:", user.email);
        }
        return true;
      } catch (err) {
        console.error("[auth] signIn callback error:", err);
        return false;
      }
    },
    async redirect({ url, baseUrl }) {
      try {
        // Allow relative callback URLs and same-origin absolute URLs only.
        if (url.startsWith("/")) return `${baseUrl}${url}`;
        const target = new URL(url);
        if (target.origin === baseUrl) return url;
      } catch (err) {
        console.error("[auth] redirect callback parse error:", err, { url, baseUrl });
      }
      return `${baseUrl}/dashboard`;
    },
    async jwt({ token, user, account }) {
      try {
        if (user) {
          token.id = user.id;
          token.email = user.email;
          token.name = user.name;
          token.picture = user.image;
        }
        if (account?.provider) {
          token.provider = account.provider;
        }
      } catch (err) {
        console.error("[auth] jwt callback error:", err);
      }
      return token;
    },
    async session({ session, token }) {
      try {
        if (session.user) {
          (session.user as { id?: string }).id = (token.id as string | undefined) ?? undefined;
        }
        (session as { provider?: string }).provider = (token.provider as string) ?? undefined;
      } catch (err) {
        console.error("[auth] session callback error:", err);
      }
      return session;
    },
  },
  events: {
    async signIn({ user, account, isNewUser }) {
      console.log("[auth] signIn event", {
        userId: user?.id,
        provider: account?.provider,
        isNewUser,
      });
    },
    async signOut() {
      console.log("[auth] signOut event");
    },
  },
};

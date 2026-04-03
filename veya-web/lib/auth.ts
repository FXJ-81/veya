import { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { compare } from "bcryptjs";
import { applyCanonicalNextAuthUrlForOAuth } from "./googleOAuthCallback";
import { prisma } from "./prisma";

applyCanonicalNextAuthUrlForOAuth();

// Surface configuration problems early in logs
if (!process.env.NEXTAUTH_SECRET) {
  console.error("[auth] NEXTAUTH_SECRET is not set — NextAuth callbacks will fail");
}
if (!process.env.NEXTAUTH_URL && process.env.VERCEL !== "1") {
  console.warn("[auth] NEXTAUTH_URL is not set");
}

/**
 * Google sign-in uses NextAuth at `/api/auth/callback/google` only.
 * In Google Cloud, Authorized redirect URIs must be exactly (see `lib/googleOAuthCallback.ts`):
 * - http://localhost:3000/api/auth/callback/google
 * - https://veya-beta.vercel.app/api/auth/callback/google
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
  pages: { signIn: "/sign-in" },
  callbacks: {
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
          (session.user as { id: string }).id = token.id as string;
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

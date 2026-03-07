"use client";

import { useSession, signOut } from "next-auth/react";

export function useAuth() {
  const { data: session, status } = useSession();
  const user = session?.user;
  const isAuthenticated = !!user;
  const userId = (user as { id?: string } | undefined)?.id;

  return {
    user,
    userId,
    status,
    isAuthenticated,
    signOut,
  };
}

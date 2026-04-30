"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import {
  applyAccentPreferenceToDocument,
  clearAccentPreferenceFromDocument,
  type AccentPreference,
} from "@/lib/accentPreference";

function normalize(v: unknown): AccentPreference {
  // Missing / unknown server values → original Veya dark (brand).
  return v === "white" ? "white" : "brand";
}

/**
 * Loads persisted accent preference for signed-in users and applies it to the document.
 */
export function AccentPreferenceSync() {
  const { status } = useSession();

  useEffect(() => {
    if (status === "unauthenticated") {
      clearAccentPreferenceFromDocument();
      return;
    }
    if (status !== "authenticated") return;

    // Do not apply veya_theme from localStorage here: a stale "light" without accentPreference === "white"
    // would violate "dark until explicitly changed in Settings". The inline layout script already picks
    // light only for the explicit white+light pair; we treat the API as source of truth after sign-in.

    let cancelled = false;
    void fetch("/api/settings/appearance")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { accentPreference?: unknown } | null) => {
        if (cancelled || !d) return;
        applyAccentPreferenceToDocument(normalize(d.accentPreference));
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [status]);

  return null;
}

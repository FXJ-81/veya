import { ALL_BRAND_SPECS } from "./catalog";
import { normalizeSubscriptionNameForMatch } from "./normalize";
import type { LogoFitMode, LogoPaddingMode, ResolvedBrandLogo } from "./types";

const FAVICON_SZ = 128;

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** True if `phrase` appears in normalized merchant string `n`. */
export function phraseMatchesNormalized(n: string, phrase: string): boolean {
  const p = phrase.trim().toLowerCase();
  if (!p || !n) return false;
  if (n === p) return true;
  // Multi-word or punctuation / plus-brand marks → substring (order in catalog handles specificity)
  if (p.includes(" ") || /[^a-z0-9\s]/.test(p)) {
    return n.includes(p);
  }
  // Single alnum token → whole-word (avoid "apple" in "pineapple")
  return new RegExp(`\\b${escapeRegex(p)}\\b`, "i").test(n);
}

type MatchRow = {
  phrase: string;
  domain: string;
  fit: LogoFitMode;
  padding: LogoPaddingMode;
};

function buildSortedRows(): MatchRow[] {
  const seen = new Set<string>();
  const rows: MatchRow[] = [];
  for (const spec of ALL_BRAND_SPECS) {
    for (const ph of spec.phrases) {
      const phrase = ph.trim().toLowerCase();
      if (!phrase || seen.has(phrase)) continue;
      seen.add(phrase);
      rows.push({
        phrase,
        domain: spec.domain,
        fit: spec.fit ?? "contain",
        padding: spec.padding ?? "snug",
      });
    }
  }
  rows.sort((a, b) => b.phrase.length - a.phrase.length);
  return rows;
}

const SORTED_MATCH_ROWS = buildSortedRows();

const TLD_PATTERN =
  "(?:com|net|org|io|tv|us|so|ai|co|app|dev|me|gg|uk|gov|edu|info|biz|xyz|tech|cloud|fm|ly|to)";

/** If the name embeds a hostname-like token, return apex for favicon lookup. */
export function extractLikelyDomainFromName(normalized: string): string | null {
  const re = new RegExp(
    `\\b([a-z0-9](?:[a-z0-9-]*[a-z0-9])?\\.${TLD_PATTERN})\\b`,
    "gi",
  );
  const found = new Set<string>();
  let m: RegExpExecArray | null;
  const r = new RegExp(re.source, "gi");
  while ((m = r.exec(normalized)) !== null) {
    found.add(m[1].toLowerCase());
  }
  if (found.size === 0) return null;
  // Prefer longest (more specific subdomain → still apex for favicon)
  return [...found].sort((a, b) => b.length - a.length)[0] ?? null;
}

export function lookupBrandFromNormalizedName(
  normalized: string,
): Omit<ResolvedBrandLogo, "url"> | null {
  for (const row of SORTED_MATCH_ROWS) {
    if (phraseMatchesNormalized(normalized, row.phrase)) {
      return {
        domain: row.domain,
        fit: row.fit,
        padding: row.padding,
      };
    }
  }
  const embedded = extractLikelyDomainFromName(normalized);
  if (embedded) {
    return {
      domain: embedded,
      fit: "contain",
      padding: "snug",
    };
  }
  return null;
}

export function brandLogoUrlForDomain(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${FAVICON_SZ}`;
}

export function domainForSubscriptionName(name: string): string | null {
  const n = normalizeSubscriptionNameForMatch(name);
  if (!n) return null;
  return lookupBrandFromNormalizedName(n)?.domain ?? null;
}

export type SubscriptionLogoDisplay = {
  url: string | null;
  fit: LogoFitMode;
  padding: LogoPaddingMode;
  /** Tailwind classes for the logo <img> inside the avatar shell */
  imgClassName: string;
};

const PADDING_IMG: Record<LogoPaddingMode, string> = {
  none: "p-0",
  tight: "p-0.5",
  snug: "p-1",
  comfortable: "p-1.5",
};

function imgClassFor(fit: LogoFitMode, padding: LogoPaddingMode): string {
  const pad = PADDING_IMG[padding];
  const fitCls = fit === "cover" ? "object-cover" : "object-contain";
  // Fill the rounded square: no max-w/max-h caps; parent overflow clips
  return `h-full w-full min-h-0 min-w-0 max-h-full max-w-full ${fitCls} ${pad}`;
}

/**
 * Resolve favicon URL + layout hints. Handles legacy Clearbit URLs (403 in browsers).
 */
export function resolveSubscriptionLogoDisplay(
  name: string,
  storedLogoUrl: string | null | undefined,
): SubscriptionLogoDisplay {
  const defaultPad: LogoPaddingMode = "snug";
  const trimmed = storedLogoUrl?.trim();

  if (trimmed?.startsWith("http")) {
    const clearbitHost = trimmed.includes("logo.clearbit.com");
    if (clearbitHost) {
      const fromPath = trimmed.match(/logo\.clearbit\.com\/([^/?#]+)/i)?.[1];
      const pathDomain = fromPath ? decodeURIComponent(fromPath) : null;
      const urlDomain = pathDomain ?? domainForSubscriptionName(name);
      if (urlDomain) {
        const n = normalizeSubscriptionNameForMatch(name);
        const hit = n ? lookupBrandFromNormalizedName(n) : null;
        const fit = hit?.fit ?? "contain";
        const padding = hit?.padding ?? defaultPad;
        return {
          url: brandLogoUrlForDomain(urlDomain),
          fit,
          padding,
          imgClassName: imgClassFor(fit, padding),
        };
      }
      return { url: null, fit: "contain", padding: defaultPad, imgClassName: imgClassFor("contain", defaultPad) };
    }
    return {
      url: trimmed,
      fit: "contain",
      padding: defaultPad,
      imgClassName: imgClassFor("contain", defaultPad),
    };
  }

  const n = normalizeSubscriptionNameForMatch(name);
  const hit = n ? lookupBrandFromNormalizedName(n) : null;
  if (!hit) {
    return { url: null, fit: "contain", padding: defaultPad, imgClassName: imgClassFor("contain", defaultPad) };
  }
  return {
    url: brandLogoUrlForDomain(hit.domain),
    fit: hit.fit,
    padding: hit.padding,
    imgClassName: imgClassFor(hit.fit, hit.padding),
  };
}

/** @deprecated Prefer resolveSubscriptionLogoDisplay — kept for call sites that only need URL. */
export function resolveSubscriptionLogoUrl(
  name: string,
  storedLogoUrl: string | null | undefined,
): string | null {
  return resolveSubscriptionLogoDisplay(name, storedLogoUrl).url;
}

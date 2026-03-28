/**
 * Normalize subject/body for scoring: collapse noise, strip HTML more aggressively than a single regex,
 * and drop repetitive footer blocks that drown out billing phrases.
 */

const HTML_ENTITY_MAP: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  copy: "©",
  reg: "®",
};

/** Decode common HTML entities (lightweight; avoids full parser dependency) */
export function decodeBasicHtmlEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, name: string) => {
    if (name.startsWith("#x") || name.startsWith("#")) {
      const code = name.startsWith("#x")
        ? parseInt(name.slice(2), 16)
        : parseInt(name.slice(1), 10);
      if (!Number.isNaN(code)) return String.fromCodePoint(code);
      return m;
    }
    const lower = name.toLowerCase();
    return HTML_ENTITY_MAP[lower] ?? m;
  });
}

/**
 * Strip tags and script/style blocks; keep link destinations as words (billing URLs are signal).
 */
export function stripHtmlToPlain(html: string): string {
  let s = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/(p|div|br|tr|h[1-6]|li)>/gi, "\n");

  // href="..." → space + url text (captures manage-subscription paths)
  s = s.replace(/<a\s+[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, " $1 $2 ");

  s = s.replace(/<[^>]+>/g, " ");
  s = decodeBasicHtmlEntities(s);
  return s;
}

export function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Many marketing emails repeat legal/unsubscribe blocks 3×; keep the head (where charges are stated).
 */
export function trimRepetitiveFooter(text: string, maxLen: number): string {
  const t = collapseWhitespace(text);
  if (t.length <= maxLen) return t;

  // Prefer first ~70% of maxLen for billing content; remainder reserved for tail scan in caller if needed
  const head = t.slice(0, Math.floor(maxLen * 0.85));
  const tail = t.slice(Math.max(0, t.length - Math.floor(maxLen * 0.25)));
  return collapseWhitespace(`${head}\n${tail}`);
}

/** Full pipeline for raw body chunks from MIME */
export function normalizeEmailBody(raw: string, maxChars = 14_000): string {
  const looksHtml = /<\s*[a-z][\s\S]*>/i.test(raw);
  const plain = looksHtml ? stripHtmlToPlain(raw) : raw;
  const collapsed = collapseWhitespace(plain);
  return trimRepetitiveFooter(collapsed, maxChars);
}

export function normalizeSubject(subject: string): string {
  return collapseWhitespace(decodeBasicHtmlEntities(subject));
}

/** Combined searchable blob (lowercased) for regex detectors */
export function buildSearchBlob(
  subjectNorm: string,
  bodyNorm: string,
  snippet?: string
): string {
  const parts = [subjectNorm, snippet ?? "", bodyNorm].map((p) => p.toLowerCase());
  return collapseWhitespace(parts.join("\n"));
}

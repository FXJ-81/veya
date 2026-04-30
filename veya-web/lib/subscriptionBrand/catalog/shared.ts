import type { BrandSpec } from "../types";

/** Define a brand row: apex domain + phrases (longer phrases should appear earlier in the array). */
export function b(
  domain: string,
  phrases: string[],
  opts?: Pick<BrandSpec, "fit" | "padding">,
): BrandSpec {
  return { domain, phrases, ...opts };
}

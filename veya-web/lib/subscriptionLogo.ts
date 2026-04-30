/**
 * Subscription / merchant brand logos (favicons by domain).
 *
 * Implementation lives in `lib/subscriptionBrand/` (catalog, normalization, resolve).
 */

export { normalizeSubscriptionNameForMatch } from "@/lib/subscriptionBrand/normalize";
import {
  brandLogoUrlForDomain,
  domainForSubscriptionName,
  resolveSubscriptionLogoDisplay,
  resolveSubscriptionLogoUrl,
} from "@/lib/subscriptionBrand/resolve";

export {
  brandLogoUrlForDomain,
  domainForSubscriptionName,
  resolveSubscriptionLogoDisplay,
  resolveSubscriptionLogoUrl,
};

/** @deprecated Use `brandLogoUrlForDomain`; kept for external imports. */
export function clearbitLogoUrlForDomain(domain: string): string {
  return brandLogoUrlForDomain(domain);
}

/** Stable hue 0–360 for fallback avatar ring */
export function accentHueForName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h + name.charCodeAt(i) * (i + 17)) % 360;
  }
  return h;
}

export { normalizeSubscriptionNameForMatch } from "./normalize";
export type { BrandSpec, LogoFitMode, LogoPaddingMode, ResolvedBrandLogo } from "./types";
export {
  brandLogoUrlForDomain,
  domainForSubscriptionName,
  extractLikelyDomainFromName,
  lookupBrandFromNormalizedName,
  phraseMatchesNormalized,
  resolveSubscriptionLogoDisplay,
  resolveSubscriptionLogoUrl,
} from "./resolve";
export { ALL_BRAND_SPECS } from "./catalog";

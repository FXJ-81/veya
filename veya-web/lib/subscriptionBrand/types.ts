export type LogoFitMode = "contain" | "cover";

/** Inset inside the 48px avatar; affects padding / perceived fill. */
export type LogoPaddingMode = "none" | "tight" | "snug" | "comfortable";

export type BrandSpec = {
  domain: string;
  /** Matched as substring (after normalize); put longer phrases first per brand in source arrays. */
  phrases: string[];
  fit?: LogoFitMode;
  padding?: LogoPaddingMode;
};

export type ResolvedBrandLogo = {
  url: string;
  domain: string;
  fit: LogoFitMode;
  padding: LogoPaddingMode;
};

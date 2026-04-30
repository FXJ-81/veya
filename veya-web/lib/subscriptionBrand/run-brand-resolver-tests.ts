/**
 * Manual regression checks for brand logo resolution.
 * Run: npx tsx lib/subscriptionBrand/run-brand-resolver-tests.ts
 */

import assert from "node:assert/strict";
import { normalizeSubscriptionNameForMatch } from "./normalize";
import { resolveSubscriptionLogoDisplay } from "./resolve";
import { ALL_BRAND_SPECS } from "./catalog";

function expectUrlContains(name: string, stored: string | null, substring: string) {
  const { url } = resolveSubscriptionLogoDisplay(name, stored);
  assert.ok(url, `expected URL for "${name}"`);
  assert.ok(
    url!.toLowerCase().includes(substring.toLowerCase()),
    `expected "${substring}" in ${url} for "${name}"`,
  );
}

function expectNoUrl(name: string) {
  const { url } = resolveSubscriptionLogoDisplay(name, null);
  assert.equal(url, null, `expected no URL for "${name}"`);
}

const uniqueDomains = new Set(ALL_BRAND_SPECS.map((s) => s.domain));
const phraseCount = ALL_BRAND_SPECS.reduce((n, s) => n + s.phrases.length, 0);

console.log(`Catalog: ${uniqueDomains.size} unique domains, ${phraseCount} phrases.`);

// Normalization smoke
assert.match(normalizeSubscriptionNameForMatch("SQ *STARBUCKS STORE 123"), /starbucks/);
assert.match(normalizeSubscriptionNameForMatch("PAYPAL *NETFLIX"), /netflix/);
assert.match(normalizeSubscriptionNameForMatch("GOOGLE *YouTube"), /youtube/);

// Brands from user list + variants
expectUrlContains("Starbucks", null, "starbucks.com");
expectUrlContains("McDonald's", null, "mcdonalds.com");
expectUrlContains("UBER TRIP  SAN FRANCISCO", null, "uber.com");
expectUrlContains("United Airlines", null, "united.com");
expectUrlContains("UNITED AIR LINES", null, "united.com");
expectUrlContains("Netflix.com CA", null, "netflix.com");
expectUrlContains("Spotify USA", null, "spotify.com");
expectUrlContains("Amazon Prime", null, "amazon.com");
expectUrlContains("Apple Music", null, "music.apple.com");
expectUrlContains("YouTube Premium", null, "youtube.com");
expectUrlContains("Hulu LLC", null, "hulu.com");
expectUrlContains("Disney+", null, "disneyplus.com");
expectUrlContains("DoorDash", null, "doordash.com");
expectUrlContains("Planet Fitness", null, "planetfitness.com");
expectUrlContains("Adobe Creative Cloud", null, "adobe.com");
expectUrlContains("Microsoft 365", null, "microsoft.com");
expectUrlContains("Dropbox Plus", null, "dropbox.com");
expectUrlContains("iCloud+", null, "apple.com");
expectUrlContains("Google One", null, "google.com");
expectUrlContains("ChatGPT Plus", null, "openai.com");

// Pineapple should not resolve to Apple
expectNoUrl("Pineapple Juice Monthly");

// Unknown → null
expectNoUrl("Totally Unknown Local Vendor XYZ123");

// Clearbit rewrite
expectUrlContains(
  "Netflix",
  "https://logo.clearbit.com/netflix.com",
  "netflix.com",
);

// Display metadata
const sb = resolveSubscriptionLogoDisplay("Starbucks", null);
assert.ok(sb.imgClassName.includes("object-contain") || sb.imgClassName.includes("object-cover"));

console.log("subscriptionBrand resolver tests passed.");

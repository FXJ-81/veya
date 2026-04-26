/**
 * Run with: npx tsx lib/run-plaid-sync-dedup-tests.ts
 */

import assert from "node:assert/strict";
import {
  classifyPlaidDetectionsForUser,
  isPlaidMerchantDuplicateOfExisting,
  keysForPlaidMerchant,
} from "./plaidSyncCore";
import { primaryPlaidCandidateKey } from "./plaidCandidateState";
import type { PlaidDetectedSubscription } from "./plaidSubscriptionDetect";

function run(name: string, fn: () => void) {
  try {
    fn();
    console.log("OK", name);
  } catch (e) {
    console.error("FAIL", name, e);
    process.exitCode = 1;
  }
}

const row = (name: string, merchant = name): PlaidDetectedSubscription => ({
  name,
  merchantName: merchant,
  price: 9.99,
  billingCycle: "monthly",
  category: "Other",
  lastCharged: "2026-01-01",
  confidence: "high",
});

run("existing subscription excludes candidate", () => {
  const r = classifyPlaidDetectionsForUser([row("Netflix")], [{ name: "Netflix" }], []);
  assert.equal(r.forModal.length, 0);
  assert.equal(r.forAutoImport.length, 0);
  assert.equal(r.skippedExisting, 1);
});

run("declined merchant appears unchecked but still in modal", () => {
  const r = classifyPlaidDetectionsForUser([row("Hulu")], [], ["hulu"]);
  assert.equal(r.forModal.length, 1);
  assert.equal(r.forModal[0]!.defaultSelected, false);
  assert.equal(r.forAutoImport.length, 0);
});

run("new merchant is selected and auto-import eligible", () => {
  const r = classifyPlaidDetectionsForUser([row("NewCo")], [], []);
  assert.equal(r.forModal[0]!.defaultSelected, true);
  assert.equal(r.forAutoImport.length, 1);
});

run("merchant keys normalize both name and merchant name", () => {
  const keys = keysForPlaidMerchant({ name: "  Hulu  ", merchantName: "Hulu, Inc." });
  assert.deepEqual(keys, ["hulu", "hulu, inc.".trim().toLowerCase()]);
});

run("existing or batch duplicates are skipped during plaid adds", () => {
  const existingKeys = new Set(["netflix"]);
  const batchSeen = new Set(["spotify"]);
  assert.equal(
    isPlaidMerchantDuplicateOfExisting({ name: "Netflix", merchantName: "Netflix" }, existingKeys, new Set()),
    true,
  );
  assert.equal(
    isPlaidMerchantDuplicateOfExisting({ name: "Spotify", merchantName: "Spotify" }, new Set(), batchSeen),
    true,
  );
  assert.equal(
    isPlaidMerchantDuplicateOfExisting({ name: "Disney+", merchantName: "Disney+" }, new Set(), new Set()),
    false,
  );
});

run("primary pending candidate key prefers merchant name", () => {
  assert.equal(
    primaryPlaidCandidateKey({ name: "Spotify Premium", merchantName: "Spotify" }),
    "spotify",
  );
  assert.equal(primaryPlaidCandidateKey({ name: "Netflix" }), "netflix");
});

if (!process.exitCode) console.log("\nPlaid sync dedup tests passed.");

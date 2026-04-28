/**
 * Run with: npx tsx lib/run-plaid-sync-dedup-tests.ts
 */

import assert from "node:assert/strict";
import { classifyPlaidDetectionsForUser } from "./plaidSyncCore";
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

const active = (name: string) => ({ name, status: "active" as const, id: `id-${name}` });

run("existing subscription excludes candidate", () => {
  const r = classifyPlaidDetectionsForUser([row("Netflix")], [active("Netflix")], []);
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

run("paused subscription still excludes candidate", () => {
  const r = classifyPlaidDetectionsForUser(
    [row("Hbo")],
    [{ name: "Hbo", status: "paused", id: "p1" }],
    [],
  );
  assert.equal(r.forModal.length, 0);
  assert.equal(r.skippedExisting, 1);
});

run("cancelled subscription resurfaces in modal with resume id, not auto-import", () => {
  const r = classifyPlaidDetectionsForUser(
    [row("Netflix")],
    [{ name: "Netflix", status: "cancelled", id: "c1" }],
    [],
  );
  assert.equal(r.forModal.length, 1);
  assert.equal(r.forModal[0]!.previouslyCanceled, true);
  assert.equal(r.forModal[0]!.resumeSubscriptionId, "c1");
  assert.equal(r.forAutoImport.length, 0);
  assert.equal(r.skippedExisting, 0);
});

if (!process.exitCode) console.log("\nPlaid sync dedup tests passed.");

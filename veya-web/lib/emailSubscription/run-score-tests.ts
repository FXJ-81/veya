/**
 * Run with: npx tsx lib/emailSubscription/run-score-tests.ts
 */

import assert from "node:assert/strict";
import { scoreSubscription } from "./scoreSubscription";
import {
  fixtureTrueSubscriptionNetflix,
  fixtureRenewalSpotify,
  fixtureTrialEndingAdobe,
  fixtureOneTimeAmazonOrder,
  fixtureNewsletterFalsePositive,
  fixtureWelcomeFalsePositive,
} from "./fixtures";

function run(name: string, fn: () => void) {
  try {
    fn();
    console.log("OK", name);
  } catch (e) {
    console.error("FAIL", name, e);
    process.exitCode = 1;
  }
}

run("true subscription (Netflix billing)", () => {
  const r = scoreSubscription(fixtureTrueSubscriptionNetflix);
  assert.equal(r.subscriptionType, "recurring_paid");
  assert.equal(r.isSubscription, true);
  assert.equal(r.hardReject, false);
  assert.ok(r.score >= 38);
});

run("renewal notice (Spotify)", () => {
  const r = scoreSubscription(fixtureRenewalSpotify);
  assert.equal(r.subscriptionType, "recurring_paid");
  assert.equal(r.isSubscription, true);
});

run("trial ending with charge (Adobe)", () => {
  const r = scoreSubscription(fixtureTrialEndingAdobe);
  assert.ok(
    r.subscriptionType === "recurring_paid" || r.subscriptionType === "unknown",
    `expected recurring_paid or unknown, got ${r.subscriptionType}`
  );
  assert.ok(r.score >= 30, "trial-ending with $ should score meaningfully");
});

run("one-time / shipping (Amazon)", () => {
  const r = scoreSubscription(fixtureOneTimeAmazonOrder);
  assert.equal(r.isSubscription, false);
});

run("newsletter false positive", () => {
  const r = scoreSubscription(fixtureNewsletterFalsePositive);
  assert.equal(r.isSubscription, false);
  assert.equal(r.subscriptionType, "newsletter");
  assert.equal(r.hardReject, true);
});

run("welcome / verify false positive", () => {
  const r = scoreSubscription(fixtureWelcomeFalsePositive);
  assert.equal(r.isSubscription, false);
  assert.equal(r.subscriptionType, "account_email");
});

console.log(process.exitCode ? "Some tests failed" : "All subscription score tests passed.");

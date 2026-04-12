/**
 * Run with: npx tsx lib/run-renewal-reminder-tests.ts
 *
 * Covers UTC calendar-day math used for the single 7-day renewal reminder email.
 */

import assert from "node:assert/strict";
import {
  utcCalendarDateKey,
  utcCalendarDaysUntilRenewal,
  formatRenewalDateDisplayUtc,
} from "./subscriptionBilling";

function run(name: string, fn: () => void) {
  try {
    fn();
    console.log("OK", name);
  } catch (e) {
    console.error("FAIL", name, e);
    process.exitCode = 1;
  }
}

const D = (iso: string) => new Date(iso);

run("utcCalendarDateKey uses UTC civil date", () => {
  assert.equal(utcCalendarDateKey(D("2026-04-18T00:00:00.000Z")), "2026-04-18");
  assert.equal(utcCalendarDateKey(D("2026-04-18T23:59:59.999Z")), "2026-04-18");
});

run("renewal exactly 7 days away → days === 7", () => {
  const asOf = D("2026-04-11T15:30:00.000Z");
  const renewal = D("2026-04-18T03:00:00.000Z");
  assert.equal(utcCalendarDaysUntilRenewal(renewal, asOf), 7);
});

run("renewal in 6 days → no send", () => {
  const asOf = D("2026-04-12T12:00:00.000Z");
  const renewal = D("2026-04-18T00:00:00.000Z");
  assert.equal(utcCalendarDaysUntilRenewal(renewal, asOf), 6);
});

run("renewal in 5 days → no send", () => {
  assert.equal(utcCalendarDaysUntilRenewal(D("2026-04-18"), D("2026-04-13")), 5);
});

run("renewal in 2 days → no send", () => {
  assert.equal(utcCalendarDaysUntilRenewal(D("2026-04-18"), D("2026-04-16")), 2);
});

run("renewal tomorrow → no send", () => {
  assert.equal(utcCalendarDaysUntilRenewal(D("2026-04-18"), D("2026-04-17")), 1);
});

run("renewal today → no send", () => {
  assert.equal(utcCalendarDaysUntilRenewal(D("2026-04-18"), D("2026-04-18")), 0);
});

run("renewal in 8 days → no send yet", () => {
  assert.equal(utcCalendarDaysUntilRenewal(D("2026-04-18"), D("2026-04-10")), 8);
});

run("renewal already passed (UTC) → negative days", () => {
  assert.equal(utcCalendarDaysUntilRenewal(D("2026-04-18"), D("2026-04-19")), -1);
});

run("only days===7 triggers send; all other integers do not", () => {
  const renewal = D("2026-04-18T00:00:00.000Z");
  for (let offset = -2; offset <= 10; offset++) {
    const asOf = new Date(Date.UTC(2026, 3, 18 - offset, 12, 0, 0));
    const days = utcCalendarDaysUntilRenewal(renewal, asOf);
    const shouldSend = days === 7;
    assert.equal(shouldSend, offset === 7, `offset ${offset} days=${days}`);
  }
});

run("invalid renewal date → NaN days", () => {
  assert.ok(Number.isNaN(utcCalendarDaysUntilRenewal(new Date("invalid"), D("2026-04-11"))));
});

run("formatRenewalDateDisplayUtc is stable for stored date-only renewals", () => {
  const s = formatRenewalDateDisplayUtc(D("2026-04-19T00:00:00.000Z"));
  assert.ok(s.includes("2026"));
  assert.ok(s.includes("19"));
});

if (!process.exitCode) {
  console.log("\nAll renewal reminder schedule checks passed.");
}

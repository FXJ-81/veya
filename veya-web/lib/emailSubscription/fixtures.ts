/**
 * Synthetic emails for regression tests — not real user data.
 */

import type { EmailLikeInput } from "./types";

export const fixtureTrueSubscriptionNetflix: EmailLikeInput = {
  fromHeader: "Netflix <billing@netflix.com>",
  subject: "Your Netflix receipt",
  snippet: "Receipt for your monthly membership",
  bodyText: `
    Hi,
    You've been charged $15.49 for your monthly Netflix plan.
    Your membership renews on April 2, 2026.
    Card ending in 4242 was charged.
    Manage your subscription: https://netflix.com/account/billing
    Cancel anytime.
  `,
};

export const fixtureRenewalSpotify: EmailLikeInput = {
  fromHeader: "Spotify <no-reply@spotify.com>",
  subject: "Your Premium plan renews soon",
  snippet: "Upcoming charge for Spotify Premium",
  bodyText: `
    Your recurring payment of $10.99 will be charged on May 1.
    Next billing date: May 1, 2026.
    Update your payment method: https://spotify.com/account/subscription
    Your subscription renews automatically.
  `,
};

export const fixtureTrialEndingAdobe: EmailLikeInput = {
  fromHeader: "Adobe <mail@adobe.com>",
  subject: "Your trial ends in 3 days",
  snippet: "Trial ending — subscription starts soon",
  bodyText: `
    Your free trial ends on April 10.
    Unless you cancel, we'll bill you $54.99 monthly starting April 10.
    Recurring payment on file. Card ending in 1234.
    Manage subscription: https://adobe.com/cancel-plan
  `,
};

export const fixtureOneTimeAmazonOrder: EmailLikeInput = {
  fromHeader: "Amazon <shipment-tracking@amazon.com>",
  subject: "Order confirmation — your order has shipped",
  snippet: "Track your package",
  bodyText: `
    Your order #112-9988776 has shipped.
    Total: $29.99
    Track your package: https://amazon.com/track
    Delivery estimate: Tuesday.
  `,
};

export const fixtureNewsletterFalsePositive: EmailLikeInput = {
  fromHeader: "TechCo <news@techco.io>",
  subject: "Weekly digest — 50% off spring sale!",
  snippet: "Blog updates and newsletter",
  bodyText: `
    Here's your weekly digest of our best articles.
    Unsubscribe from marketing emails at any time.
    Limited time: 40% off annual plans for new customers only!
    Read our blog updates.
  `,
};

export const fixtureWelcomeFalsePositive: EmailLikeInput = {
  fromHeader: "AppCo <hello@appco.com>",
  subject: "Welcome to AppCo!",
  snippet: "Get started",
  bodyText: `
    Welcome to AppCo! We're glad you're here.
    Please confirm your email address to activate your account.
    If you didn't sign up, ignore this message.
  `,
};

import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";

function plaidBasePath(): string {
  const env = (process.env.PLAID_ENV ?? "sandbox").toLowerCase();
  if (env === "production") return PlaidEnvironments.production;
  return PlaidEnvironments.sandbox;
}

export function getPlaidClient(): PlaidApi {
  const clientId = process.env.PLAID_CLIENT_ID;
  const secret = process.env.PLAID_SECRET;
  if (!clientId || !secret) {
    throw new Error("Plaid is not configured (PLAID_CLIENT_ID / PLAID_SECRET)");
  }
  const configuration = new Configuration({
    basePath: plaidBasePath(),
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": clientId,
        "PLAID-SECRET": secret,
      },
    },
  });
  return new PlaidApi(configuration);
}

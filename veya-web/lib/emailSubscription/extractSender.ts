/**
 * Parse From header → local part + domain. Used for billing@ / receipts@ signals.
 */

export type ParsedFrom = {
  localPart: string;
  domain: string;
  raw: string;
};

export function parseFromHeader(fromHeader: string): ParsedFrom | null {
  const trimmed = fromHeader.trim();
  const emailMatch = trimmed.match(/<([^>]+)>/);
  const email = (emailMatch ? emailMatch[1] : trimmed).trim();
  const at = email.lastIndexOf("@");
  if (at <= 0) return null;
  const localPart = email.slice(0, at).toLowerCase();
  const domain = email.slice(at + 1).trim().toLowerCase();
  return { localPart, domain, raw: trimmed };
}

export function applySenderLocalPartWeights(
  localPart: string,
  apply: (delta: number, reason: string) => void,
  weights: {
    billing: number;
    receipts: number;
    payments: number;
    membership: number;
    noreply: number;
  }
): void {
  const lp = localPart.split("+")[0] ?? localPart;

  if (/^billing/.test(lp)) apply(weights.billing, "sender local-part: billing");
  else if (/^receipts?/.test(lp)) apply(weights.receipts, "sender local-part: receipts");
  else if (/^payments?/.test(lp)) apply(weights.payments, "sender local-part: payments");
  else if (/^membership/.test(lp)) apply(weights.membership, "sender local-part: membership");
  else if (/^(no-reply|noreply|donotreply)/.test(lp))
    apply(weights.noreply, "sender local-part: noreply (weak alone)");
}

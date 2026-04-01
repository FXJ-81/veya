import type { GmailScanRow } from "@/types/scan";

function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9+ ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Merge Gmail + Plaid rows: same merchant → source `confirmed`. */
export function mergeScanCandidates(
  gmailRows: GmailScanRow[],
  plaidRows: GmailScanRow[]
): GmailScanRow[] {
  const g = gmailRows.map((r) => ({
    row: { ...r, rowId: r.rowId ?? r.messageId ?? `gmail-${r.name}` },
    norm: normalizeName(r.name),
  }));
  const p = plaidRows.map((r) => ({
    row: { ...r, rowId: r.rowId ?? `plaid-${r.name}` },
    norm: normalizeName(r.name),
  }));

  const usedG = new Set<number>();
  const usedP = new Set<number>();
  const merged: GmailScanRow[] = [];

  function namesMatch(a: string, b: string): boolean {
    if (!a || !b) return false;
    if (a === b) return true;
    if (a.includes(b) || b.includes(a)) return true;
    const wa = a.split(" ").filter(Boolean);
    const wb = b.split(" ").filter(Boolean);
    if (wa.length && wb.length && wa[0] === wb[0] && wa[0].length >= 4) return true;
    return false;
  }

  for (let i = 0; i < g.length; i++) {
    if (usedG.has(i)) continue;
    for (let j = 0; j < p.length; j++) {
      if (usedP.has(j)) continue;
      if (namesMatch(g[i]!.norm, p[j]!.norm)) {
        const gr = g[i]!.row;
        const pr = p[j]!.row;
        merged.push({
          ...gr,
          rowId: `merged-${gr.rowId}-${pr.rowId}`,
          source: "confirmed",
          messageId: gr.messageId,
          name: gr.name,
          category: gr.category || pr.category,
          price: gr.price,
          billingCycle: gr.billingCycle,
          monthlyEquivalent: gr.monthlyEquivalent,
          logoUrl: gr.logoUrl || pr.logoUrl,
          emailDate: gr.emailDate,
          senderDomain: gr.senderDomain,
          lastCharged: pr.lastCharged ?? gr.lastCharged,
          confidence: "high",
        });
        usedG.add(i);
        usedP.add(j);
        break;
      }
    }
  }

  for (let i = 0; i < g.length; i++) {
    if (!usedG.has(i)) merged.push(g[i]!.row);
  }
  for (let j = 0; j < p.length; j++) {
    if (!usedP.has(j)) merged.push(p[j]!.row);
  }

  return merged;
}

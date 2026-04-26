import { prisma } from "@/lib/prisma";
import { normalizeSubscriptionNameKey } from "@/lib/subscriptionDedup";
import { keysForPlaidMerchant, mergeDeclinedMerchantKeys, removeKeysFromDeclinedList } from "@/lib/plaidSyncCore";
import type { PendingPlaidSubscriptionCandidate } from "@/types/plaidCandidate";

type CandidateStatus = "pending" | "declined" | "added";

type CandidateLike = {
  id: string;
  userId: string;
  normalizedMerchantKey: string;
  matchKeys: string[];
  name: string;
  merchantName: string;
  category: string;
  price: number;
  billingCycle: string;
  lastCharged: Date;
  confidence: string;
  status: string;
};

function asCandidateStatus(value: string): CandidateStatus {
  if (value === "declined" || value === "added") return value;
  return "pending";
}

export function primaryPlaidCandidateKey(item: { name: string; merchantName?: string }): string {
  const merchant = normalizeSubscriptionNameKey(item.merchantName ?? "");
  if (merchant) return merchant;
  return normalizeSubscriptionNameKey(item.name);
}

function candidateMatchesKeys(candidate: Pick<CandidateLike, "normalizedMerchantKey" | "matchKeys">, keys: string[]): boolean {
  const keySet = new Set(keys);
  if (keySet.has(candidate.normalizedMerchantKey)) return true;
  return candidate.matchKeys.some((key) => keySet.has(key));
}

export function serializePendingPlaidCandidate(
  candidate: CandidateLike & { firstDetectedAt: Date; lastDetectedAt: Date },
): PendingPlaidSubscriptionCandidate {
  return {
    id: candidate.id,
    name: candidate.name,
    merchantName: candidate.merchantName,
    category: candidate.category,
    price: candidate.price,
    billingCycle: candidate.billingCycle as PendingPlaidSubscriptionCandidate["billingCycle"],
    lastCharged: candidate.lastCharged.toISOString(),
    confidence: (candidate.confidence === "high" ? "high" : "medium") as "high" | "medium",
    status: asCandidateStatus(candidate.status),
    firstDetectedAt: candidate.firstDetectedAt.toISOString(),
    lastDetectedAt: candidate.lastDetectedAt.toISOString(),
  };
}

export async function listPendingPlaidCandidates(userId: string): Promise<PendingPlaidSubscriptionCandidate[]> {
  const rows = await prisma.plaidSubscriptionCandidate.findMany({
    where: { userId, status: "pending" },
    orderBy: [{ lastDetectedAt: "desc" }, { createdAt: "desc" }],
  });
  return rows.map(serializePendingPlaidCandidate);
}

export async function markPlaidCandidatesDeclinedByKeys(
  userId: string,
  keys: string[],
): Promise<{ updatedIds: string[]; normalizedKeys: string[] }> {
  const normalizedKeys = [...new Set(keys.map((key) => normalizeSubscriptionNameKey(key)).filter(Boolean))];
  if (normalizedKeys.length === 0) return { updatedIds: [], normalizedKeys: [] };

  const matches = await prisma.plaidSubscriptionCandidate.findMany({
    where: { userId },
    select: { id: true, normalizedMerchantKey: true, matchKeys: true },
  });
  const matchedIds = matches
    .filter((candidate) => candidateMatchesKeys(candidate, normalizedKeys))
    .map((candidate) => candidate.id);

  if (matchedIds.length > 0) {
    await prisma.plaidSubscriptionCandidate.updateMany({
      where: { userId, id: { in: matchedIds } },
      data: { status: "declined" },
    });
  }

  const current = await prisma.userSettings.findUnique({
    where: { userId },
    select: { plaidDeclinedMerchantKeys: true },
  });
  const next = mergeDeclinedMerchantKeys(current?.plaidDeclinedMerchantKeys ?? [], normalizedKeys);
  await prisma.userSettings.upsert({
    where: { userId },
    create: { userId, plaidDeclinedMerchantKeys: next },
    update: { plaidDeclinedMerchantKeys: next },
  });

  return { updatedIds: matchedIds, normalizedKeys };
}

export async function markPlaidCandidatesAddedByKeys(
  userId: string,
  keys: string[],
): Promise<{ updatedIds: string[]; normalizedKeys: string[] }> {
  const normalizedKeys = [...new Set(keys.map((key) => normalizeSubscriptionNameKey(key)).filter(Boolean))];
  if (normalizedKeys.length === 0) return { updatedIds: [], normalizedKeys: [] };

  const matches = await prisma.plaidSubscriptionCandidate.findMany({
    where: { userId },
    select: { id: true, normalizedMerchantKey: true, matchKeys: true },
  });
  const matchedIds = matches
    .filter((candidate) => candidateMatchesKeys(candidate, normalizedKeys))
    .map((candidate) => candidate.id);

  if (matchedIds.length > 0) {
    await prisma.plaidSubscriptionCandidate.updateMany({
      where: { userId, id: { in: matchedIds } },
      data: { status: "added" },
    });
  }

  const current = await prisma.userSettings.findUnique({
    where: { userId },
    select: { plaidDeclinedMerchantKeys: true },
  });
  const next = removeKeysFromDeclinedList(current?.plaidDeclinedMerchantKeys ?? [], normalizedKeys);
  await prisma.userSettings.upsert({
    where: { userId },
    create: { userId, plaidDeclinedMerchantKeys: next },
    update: { plaidDeclinedMerchantKeys: next },
  });

  return { updatedIds: matchedIds, normalizedKeys };
}

export async function dismissPendingPlaidCandidatesByIds(
  userId: string,
  ids: string[],
): Promise<{ dismissed: number }> {
  const rows = await prisma.plaidSubscriptionCandidate.findMany({
    where: { userId, id: { in: ids }, status: "pending" },
    select: { name: true, merchantName: true },
  });
  const keys = rows.flatMap((row) => keysForPlaidMerchant(row));
  await markPlaidCandidatesDeclinedByKeys(userId, keys);
  return { dismissed: rows.length };
}

export async function resolvePendingPlaidCandidatesByIds(
  userId: string,
  ids: string[],
): Promise<CandidateLike[]> {
  return prisma.plaidSubscriptionCandidate.findMany({
    where: { userId, id: { in: ids }, status: "pending" },
    orderBy: { createdAt: "asc" },
  });
}

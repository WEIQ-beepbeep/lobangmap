import { Timestamp } from "firebase/firestore";
import { Deal } from "./types";

const LOCAL_DEALS_KEY = "lobangmap.localDeals";
export const LOCAL_DEALS_EVENT = "lobangmap-local-deals-updated";

type StoredDeal = Omit<Deal, "createdAt" | "expiresAt" | "reviewedAt"> & {
  createdAt: number;
  expiresAt?: number;
  reviewedAt?: number;
};

function fromStoredDeal(deal: StoredDeal): Deal {
  const { createdAt, expiresAt, reviewedAt, ...rest } = deal;
  return {
    ...rest,
    createdAt: Timestamp.fromMillis(createdAt),
    ...(expiresAt ? { expiresAt: Timestamp.fromMillis(expiresAt) } : {}),
    ...(reviewedAt ? { reviewedAt: Timestamp.fromMillis(reviewedAt) } : {})
  };
}

function toStoredDeal(deal: Deal): StoredDeal {
  const { createdAt, expiresAt, reviewedAt, ...rest } = deal;
  return {
    ...rest,
    createdAt: createdAt?.toMillis?.() || Date.now(),
    ...(expiresAt ? { expiresAt: expiresAt.toMillis() } : {}),
    ...(reviewedAt ? { reviewedAt: reviewedAt.toMillis() } : {})
  };
}

export function getLocalDeals() {
  try {
    const raw = localStorage.getItem(LOCAL_DEALS_KEY);
    if (!raw) return [];
    return (JSON.parse(raw) as StoredDeal[]).map(fromStoredDeal);
  } catch {
    return [];
  }
}

export function saveLocalDeals(deals: Deal[]) {
  const existing = getLocalDeals();
  const byKey = new Map<string, Deal>();

  for (const deal of existing) {
    byKey.set(deal.importKey || deal.id, deal);
  }
  for (const deal of deals) {
    byKey.set(deal.importKey || deal.id, deal);
  }

  localStorage.setItem(LOCAL_DEALS_KEY, JSON.stringify([...byKey.values()].map(toStoredDeal)));
  window.dispatchEvent(new Event(LOCAL_DEALS_EVENT));
}

export function replaceSyncedLocalDeals(deals: Deal[]) {
  const keptDeals = getLocalDeals().filter((deal) => deal.sourceType !== "telegram" && deal.sourceType !== "web");
  localStorage.setItem(LOCAL_DEALS_KEY, JSON.stringify([...keptDeals, ...deals].map(toStoredDeal)));
  window.dispatchEvent(new Event(LOCAL_DEALS_EVENT));
}

export function subscribeLocalDeals(callback: (deals: Deal[]) => void) {
  const handler = () => callback(getLocalDeals());
  window.addEventListener(LOCAL_DEALS_EVENT, handler);
  callback(getLocalDeals());
  return () => window.removeEventListener(LOCAL_DEALS_EVENT, handler);
}

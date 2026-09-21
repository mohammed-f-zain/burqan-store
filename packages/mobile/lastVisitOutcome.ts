import type { DailyStoreCard } from "./storeTypes";

/** Label shown under last-visit date: purchase, or no-buy / visit reason. */
export function lastVisitOutcomeText(
  store: Pick<DailyStoreCard, "lastVisitHadPurchase" | "lastVisitNote" | "visitNote" | "visitedToday">,
  purchasedLabel: string
): string | null {
  if (store.lastVisitHadPurchase) return purchasedLabel;
  const note = (store.lastVisitNote ?? "").trim() || (store.visitedToday ? (store.visitNote ?? "").trim() : "");
  return note || null;
}

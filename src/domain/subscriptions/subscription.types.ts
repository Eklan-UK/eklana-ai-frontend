export type BillingPeriod = "monthly" | "quarterly" | "annual";

export type ZeroPauseProduct = "challenge" | "mastery";

export const BILLING_PERIODS: BillingPeriod[] = [
  "monthly",
  "quarterly",
  "annual",
];

export const BILLING_PERIOD_MONTHS: Record<BillingPeriod, number> = {
  monthly: 1,
  quarterly: 3,
  annual: 12,
};

export const BILLING_PERIOD_LABELS: Record<BillingPeriod, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  annual: "Annual",
};

export const ZERO_PAUSE_PRODUCTS: ZeroPauseProduct[] = [
  "challenge",
  "mastery",
];

export const ZERO_PAUSE_PRODUCT_LABELS: Record<ZeroPauseProduct, string> = {
  challenge: "Zero Pause Challenge",
  mastery: "Zero Pause Mastery",
};

export function billingPeriodToMonths(period: BillingPeriod): number {
  return BILLING_PERIOD_MONTHS[period];
}

export function formatBillingPeriodLabel(
  period: BillingPeriod | string | null | undefined
): string {
  if (!period) return "—";
  return BILLING_PERIOD_LABELS[period as BillingPeriod] ?? String(period);
}

export function formatZeroPauseProducts(
  products: ZeroPauseProduct[] | string[] | null | undefined
): string {
  if (!products?.length) return "—";
  return products
    .map((p) => ZERO_PAUSE_PRODUCT_LABELS[p as ZeroPauseProduct] ?? p)
    .join(", ");
}

export function formatZeroPauseProductWithDate(
  product: ZeroPauseProduct,
  date?: string | Date | null
): string {
  const label = ZERO_PAUSE_PRODUCT_LABELS[product];
  if (!date) return label;
  try {
    const formatted = new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    return `${label} · ${formatted}`;
  } catch {
    return label;
  }
}

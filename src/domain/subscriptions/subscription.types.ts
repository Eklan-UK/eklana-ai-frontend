export type BillingPeriod = "monthly" | "quarterly" | "annual";

export type ZeroPauseProduct = "challenge" | "maintainer";

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
  "maintainer",
];

export const ZERO_PAUSE_PRODUCT_LABELS: Record<ZeroPauseProduct, string> = {
  challenge: "Zero Pause Challenge",
  maintainer: "Zero Pause Maintainer",
};

export function isZeroPauseProduct(
  value: string
): value is ZeroPauseProduct {
  return (ZERO_PAUSE_PRODUCTS as string[]).includes(value);
}

export function billingPeriodToMonths(period: BillingPeriod): number {
  return BILLING_PERIOD_MONTHS[period];
}

export function hasStripeBillingLink(user: {
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
}): boolean {
  return Boolean(
    user.stripeCustomerId?.trim() || user.stripeSubscriptionId?.trim()
  );
}

export function hasAppleBillingLink(user: {
  appleOriginalTransactionId?: string | null;
}): boolean {
  return Boolean(user.appleOriginalTransactionId?.trim());
}

export function hasProviderBillingLink(user: {
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  appleOriginalTransactionId?: string | null;
  subscriptionProvider?: string | null;
  subscriptionPaymentMethod?: string | null;
}): boolean {
  return (
    hasStripeBillingLink(user) ||
    hasAppleBillingLink(user) ||
    user.subscriptionProvider === "stripe" ||
    user.subscriptionProvider === "apple" ||
    user.subscriptionPaymentMethod === "stripe" ||
    user.subscriptionPaymentMethod === "apple"
  );
}

export function billingPeriodFromMonths(
  months: number | null | undefined
): BillingPeriod {
  if (months === 3) return "quarterly";
  if (months === 12) return "annual";
  return "monthly";
}

export function resolveSubscriptionMonths(
  billingPeriod: BillingPeriod | string | null | undefined,
  monthsPaid?: number | null
): number | null {
  if (monthsPaid && monthsPaid > 0) return monthsPaid;
  if (
    billingPeriod &&
    billingPeriod in BILLING_PERIOD_MONTHS
  ) {
    return billingPeriodToMonths(billingPeriod as BillingPeriod);
  }
  return null;
}

export function addMonthsToDate(
  date: Date | string,
  months: number
): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

export function calculateSubscriptionExpiresAt(
  activatedAt: Date | string | null | undefined,
  billingPeriod: BillingPeriod | string | null | undefined,
  monthsPaid?: number | null
): Date | null {
  if (!activatedAt) return null;
  const months = resolveSubscriptionMonths(billingPeriod, monthsPaid);
  if (!months) return null;
  return addMonthsToDate(activatedAt, months);
}

export function resolveSubscriptionExpiry(user: {
  subscriptionPlan?: string | null;
  subscriptionActivatedAt?: Date | string | null;
  subscriptionExpiresAt?: Date | string | null;
  subscriptionBillingPeriod?: BillingPeriod | string | null;
  subscriptionMonthsPaidFor?: number | null;
  subscriptionProvider?: string | null;
  subscriptionPaymentMethod?: string | null;
  stripeSubscriptionId?: string | null;
  appleOriginalTransactionId?: string | null;
}): Date | null {
  if (user.subscriptionPlan !== "premium") return null;

  const billingPeriod =
    user.subscriptionBillingPeriod ??
    billingPeriodFromMonths(user.subscriptionMonthsPaidFor);

  const usesProviderExpiry = hasProviderBillingLink(user);

  if (!usesProviderExpiry && user.subscriptionActivatedAt) {
    return calculateSubscriptionExpiresAt(
      user.subscriptionActivatedAt,
      billingPeriod,
      user.subscriptionMonthsPaidFor
    );
  }

  if (!user.subscriptionExpiresAt) return null;
  return new Date(user.subscriptionExpiresAt);
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
  const labels = products
    .filter(isZeroPauseProduct)
    .map((p) => ZERO_PAUSE_PRODUCT_LABELS[p]);
  if (!labels.length) return "—";
  return labels.join(", ");
}

export function formatZeroPauseProductWithDate(
  product: ZeroPauseProduct | string,
  date?: string | Date | null,
  endDate?: string | Date | null
): string | null {
  if (!isZeroPauseProduct(product)) return null;
  const label = ZERO_PAUSE_PRODUCT_LABELS[product];
  if (!date) return label;
  try {
    const opts: Intl.DateTimeFormatOptions = {
      month: "short",
      day: "numeric",
      year: "numeric",
    };
    const startFormatted = new Date(date).toLocaleDateString("en-US", opts);
    if (endDate) {
      const endFormatted = new Date(endDate).toLocaleDateString("en-US", opts);
      return `${label} · ${startFormatted} – ${endFormatted}`;
    }
    return `${label} · ${startFormatted}`;
  } catch {
    return label;
  }
}

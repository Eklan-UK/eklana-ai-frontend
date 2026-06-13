"use client";

import React, { useMemo, useState } from "react";
import { useAdminSubscriptions, useUpdateUserSubscription } from "@/hooks/useAdmin";
import { Loader2, Edit2, Save, X, Search } from "lucide-react";
import {
  BILLING_PERIODS,
  BILLING_PERIOD_LABELS,
  ZERO_PAUSE_PRODUCTS,
  ZERO_PAUSE_PRODUCT_LABELS,
  billingPeriodFromMonths,
  formatBillingPeriodLabel,
  formatZeroPauseProductWithDate,
  resolveSubscriptionExpiry,
  type BillingPeriod,
  type ZeroPauseProduct,
} from "@/domain/subscriptions/subscription.types";
import { toast } from "sonner";
import { isUserSubscribed } from "@/lib/api/user-subscription";

function getSubscriptionPlanDisplay(user: {
  subscriptionPlan?: string | null;
  subscriptionExpiresAt?: string | Date | null;
  stripeSubscriptionStatus?: string | null;
  subscriptionPaymentMethod?: string | null;
  appleSubscriptionStatus?: string | null;
  appleOriginalTransactionId?: string | null;
}): { label: string; className: string } {
  if (isUserSubscribed(user)) {
    return {
      label: "premium",
      className: "bg-emerald-100 text-emerald-700",
    };
  }
  if (user.subscriptionPlan === "premium") {
    return {
      label: "expired",
      className: "bg-amber-100 text-amber-700",
    };
  }
  return {
    label: "free",
    className: "bg-gray-100 text-gray-600",
  };
}

type SubscriptionForm = {
  plan: "free" | "premium";
  billingPeriod: BillingPeriod;
  zeroPauseProducts: ZeroPauseProduct[];
  zeroPauseDate: string;
  amount?: number;
  paymentMethod?: string;
  note?: string;
};

type PlanFilter = "all" | "free" | "premium";

function getLearnerName(learner: {
  firstName?: string | null;
  lastName?: string | null;
}): string {
  return `${learner.firstName || ""} ${learner.lastName || ""}`.trim() || "Unknown";
}

function matchesNameSearch(
  learner: { firstName?: string | null; lastName?: string | null },
  query: string
): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  const fullName = getLearnerName(learner).toLowerCase();
  const firstName = (learner.firstName || "").toLowerCase();
  const lastName = (learner.lastName || "").toLowerCase();

  return (
    fullName.includes(normalized) ||
    firstName.includes(normalized) ||
    lastName.includes(normalized)
  );
}

const SubscriptionsPage: React.FC = () => {
  const { data, isLoading } = useAdminSubscriptions({ limit: 1000 });
  const learners = data?.learners || [];
  const { mutateAsync, isPending: saving } = useUpdateUserSubscription();

  const [searchQuery, setSearchQuery] = useState("");
  const [planFilter, setPlanFilter] = useState<PlanFilter>("all");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [savedDates, setSavedDates] = useState<Record<string, string>>({});
  const [form, setForm] = useState<SubscriptionForm>({
    plan: "free",
    billingPeriod: "monthly",
    zeroPauseProducts: [],
    zeroPauseDate: "",
  });

  const filteredLearners = useMemo(() => {
    return learners.filter((learner: any) => {
      if (!matchesNameSearch(learner, searchQuery)) return false;

      const planLabel = getSubscriptionPlanDisplay(learner).label;
      if (planFilter === "premium") return planLabel === "premium";
      if (planFilter === "free") return planLabel !== "premium";
      return true;
    });
  }, [learners, searchQuery, planFilter]);

  const toDateInput = (value: Date | string | null | undefined): string => {
    if (!value) return "";
    try {
      return new Date(value).toISOString().slice(0, 10);
    } catch {
      return "";
    }
  };

  const startEdit = (l: any) => {
    setEditingId(l._id);
    setForm({
      plan: l.subscriptionPlan === "premium" ? "premium" : "free",
      billingPeriod:
        l.subscriptionBillingPeriod ||
        billingPeriodFromMonths(l.subscriptionMonthsPaidFor),
      zeroPauseProducts: Array.isArray(l.zeroPauseProducts)
        ? l.zeroPauseProducts
        : [],
      zeroPauseDate: toDateInput(l.zeroPauseDate),
      amount: l.subscriptionAmountPaid || undefined,
      paymentMethod: l.subscriptionPaymentMethod || "",
      note: l.subscriptionAdminNote || "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const toggleZeroPauseProduct = (product: ZeroPauseProduct) => {
    setForm((f) => {
      const has = f.zeroPauseProducts.includes(product);
      const nextProducts = has
        ? f.zeroPauseProducts.filter((p) => p !== product)
        : [...f.zeroPauseProducts, product];
      return {
        ...f,
        zeroPauseProducts: nextProducts,
        // Clear the shared date when all products are deselected
        zeroPauseDate: nextProducts.length === 0 ? "" : f.zeroPauseDate,
      };
    });
  };

  const save = async (userId: string) => {
    if (form.zeroPauseProducts.length > 0 && !form.zeroPauseDate) {
      toast.error("Please set a date for the Zero Pause product(s)");
      return;
    }
    await mutateAsync({
      userId,
      plan: form.plan,
      billingPeriod: form.plan === "premium" ? form.billingPeriod : undefined,
      zeroPauseProducts: form.zeroPauseProducts,
      zeroPauseDate: form.zeroPauseProducts.length > 0 ? form.zeroPauseDate : null,
      amount: form.amount,
      paymentMethod: form.paymentMethod,
      note: form.note,
    });
    // Keep a local record of the saved date so the badge renders immediately,
    // regardless of React Query cache timing after invalidation.
    if (form.zeroPauseProducts.length > 0 && form.zeroPauseDate) {
      setSavedDates((prev) => ({ ...prev, [userId]: form.zeroPauseDate }));
    } else {
      setSavedDates((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    }
    setEditingId(null);
  };

  const formatDate = (value: string | Date | null | undefined) => {
    if (!value) return "-";
    try {
      return new Date(value).toLocaleDateString();
    } catch {
      return String(value);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Subscriptions</h1>
        <p className="text-gray-500 text-sm">
          All learners. Premium dates sync from Stripe and Apple on each load.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex flex-col gap-4 mb-6 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              id="subscription-name-search"
              type="text"
              placeholder="Search by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-gray-100 bg-gray-50 py-2 pl-10 pr-4 text-sm"
            />
          </div>
          <div className="w-full md:w-48">
            <label htmlFor="subscription-plan-filter" className="sr-only">
              Filter by plan
            </label>
            <select
              id="subscription-plan-filter"
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value as PlanFilter)}
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm"
            >
              <option value="all">All plans</option>
              <option value="premium">Premium</option>
              <option value="free">Free</option>
            </select>
          </div>
        </div>

        {isLoading ? (
          <div className="py-12 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : filteredLearners.length === 0 ? (
          <div className="py-12 text-center text-gray-500">
            {learners.length === 0
              ? "No learners found."
              : "No learners match your search or filter."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase">
                  <th className="px-4 py-3">Learner</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3">Billing</th>
                  <th className="px-4 py-3">Mode</th>
                  <th className="px-4 py-3">Activated</th>
                  <th className="px-4 py-3">Expires</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-sm">
                {filteredLearners.map((l: any) => {
                  const name = getLearnerName(l);
                  const zeroPause: ZeroPauseProduct[] = Array.isArray(
                    l.zeroPauseProducts
                  )
                    ? l.zeroPauseProducts
                    : [];
                  const planDisplay = getSubscriptionPlanDisplay(l);
                  const isActivePremium = planDisplay.label === "premium";

                  return (
                    <tr key={l._id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3 font-semibold text-gray-900">
                        {name}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{l.email}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${planDisplay.className}`}
                        >
                          {planDisplay.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {isActivePremium
                          ? formatBillingPeriodLabel(
                              l.subscriptionBillingPeriod ||
                                billingPeriodFromMonths(
                                  l.subscriptionMonthsPaidFor
                                )
                            )
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {zeroPause.length === 0 ? (
                          <span className="text-gray-400">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {zeroPause.map((product) => (
                              <span
                                key={product}
                                className="px-2 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-700"
                              >
                                {formatZeroPauseProductWithDate(
                                  product,
                                  savedDates[l._id] ?? l.zeroPauseDate
                                )}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {isActivePremium
                          ? formatDate(l.subscriptionActivatedAt)
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {isActivePremium
                          ? formatDate(resolveSubscriptionExpiry(l))
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => startEdit(l)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-emerald-600 hover:text-emerald-700"
                        >
                          <Edit2 className="w-3 h-3" />
                          Edit
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Edit Subscription
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  Manage plan, billing period, and Zero Pause products.
                </p>
              </div>
              <button
                onClick={cancelEdit}
                className="p-1 rounded-full hover:bg-gray-100 text-gray-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              <div className="text-sm">
                <p className="font-semibold text-gray-900">
                  {
                    learners.find((l: any) => l._id === editingId)?.firstName ??
                    "Learner"
                  }{" "}
                  {
                    learners.find((l: any) => l._id === editingId)?.lastName ??
                    ""
                  }
                </p>
                <p className="text-gray-500 text-xs">
                  {learners.find((l: any) => l._id === editingId)?.email}
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-600">Plan</label>
                <select
                  value={form.plan}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      plan: e.target.value as "free" | "premium",
                    }))
                  }
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="free">Free</option>
                  <option value="premium">Premium</option>
                </select>
              </div>

              {form.plan === "premium" && (
                <>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-gray-600">
                      Billing period
                    </label>
                    <select
                      value={form.billingPeriod}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          billingPeriod: e.target.value as BillingPeriod,
                        }))
                      }
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    >
                      {BILLING_PERIODS.map((period) => (
                        <option key={period} value={period}>
                          {BILLING_PERIOD_LABELS[period]}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-gray-600">
                      Amount paid (optional)
                    </label>
                    <input
                      type="number"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                      value={form.amount ?? ""}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          amount:
                            e.target.value === ""
                              ? undefined
                              : Number(e.target.value),
                        }))
                      }
                      placeholder="e.g. 50000"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-gray-600">
                      Payment method (optional)
                    </label>
                    <input
                      type="text"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                      value={form.paymentMethod ?? ""}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          paymentMethod: e.target.value || undefined,
                        }))
                      }
                      placeholder="Bank transfer, cash, etc."
                    />
                  </div>
                </>
              )}

              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-600">
                  Zero Pause products
                </label>
                <p className="text-xs text-gray-500">
                  Assign paid Zero Pause add-ons independently of the Pro plan.
                </p>
                <div className="space-y-2">
                  {ZERO_PAUSE_PRODUCTS.map((product) => (
                    <label
                      key={product}
                      className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={form.zeroPauseProducts.includes(product)}
                        onChange={() => toggleZeroPauseProduct(product)}
                        className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      {ZERO_PAUSE_PRODUCT_LABELS[product]}
                    </label>
                  ))}
                </div>
                {form.zeroPauseProducts.length > 0 && (
                  <div className="space-y-1 pt-1">
                    <label className="text-xs font-medium text-gray-600">
                      Start date
                    </label>
                    <input
                      type="date"
                      value={form.zeroPauseDate}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          zeroPauseDate: e.target.value,
                        }))
                      }
                      className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-600">
                  Admin note (optional)
                </label>
                <textarea
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm min-h-[70px] resize-none"
                  value={form.note ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      note: e.target.value || undefined,
                    }))
                  }
                  placeholder="Add context like 'Paid in full until June exams'."
                />
              </div>
            </div>

            <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-end gap-2 bg-gray-50 rounded-b-2xl">
              <button
                onClick={cancelEdit}
                disabled={saving}
                className="px-4 py-2 text-xs font-semibold text-gray-600 rounded-lg border border-gray-200 hover:bg-white disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => save(editingId)}
                disabled={saving}
                className="inline-flex items-center gap-1 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
              >
                {saving && <Loader2 className="w-3 h-3 animate-spin" />}
                <Save className="w-3 h-3" />
                <span>Save subscription</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubscriptionsPage;

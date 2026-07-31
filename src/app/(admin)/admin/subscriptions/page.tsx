"use client";

import React, { useMemo, useState } from "react";
import { useAdminSubscriptions, useUpdateUserSubscription } from "@/hooks/useAdmin";
import { Loader2, Edit2, Save, X, Search } from "lucide-react";
import {
  BILLING_PERIODS,
  BILLING_PERIOD_LABELS,
  ZERO_PAUSE_POST_TRIAL_DURATION_LABEL,
  ZERO_PAUSE_PRODUCTS,
  ZERO_PAUSE_PRODUCT_LABELS,
  billingPeriodFromMonths,
  computeAutoPostTrialWindow,
  formatBillingPeriodLabel,
  formatZeroPauseProductWithDate,
  getZeroPauseChallengePhase,
  isZeroPauseProduct,
  resolveSubscriptionExpiry,
  type BillingPeriod,
  type ZeroPauseChallengePhase,
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
  if (isUserSubscribed(user as Parameters<typeof isUserSubscribed>[0])) {
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
  zeroPauseChallengePhase: ZeroPauseChallengePhase;
  zeroPauseDate: string;
  zeroPauseEndDate: string;
  zeroPausePostTrialDate: string;
  zeroPausePostTrialEndDate: string;
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
  const [savedDates, setSavedDates] = useState<
    Record<
      string,
      {
        start: string;
        end: string;
        postStart: string;
        postEnd: string;
      }
    >
  >({});
  const [form, setForm] = useState<SubscriptionForm>({
    plan: "free",
    billingPeriod: "monthly",
    zeroPauseProducts: [],
    zeroPauseChallengePhase: "trial",
    zeroPauseDate: "",
    zeroPauseEndDate: "",
    zeroPausePostTrialDate: "",
    zeroPausePostTrialEndDate: "",
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
    const products: ZeroPauseProduct[] = Array.isArray(l.zeroPauseProducts)
      ? l.zeroPauseProducts.filter(isZeroPauseProduct)
      : [];
    const phase =
      getZeroPauseChallengePhase({
        zeroPauseProducts: products,
        zeroPauseDate: l.zeroPauseDate,
        zeroPauseEndDate: l.zeroPauseEndDate,
        zeroPausePostTrialDate: l.zeroPausePostTrialDate,
        zeroPausePostTrialEndDate: l.zeroPausePostTrialEndDate,
      }) ?? "trial";

    let postStart = toDateInput(l.zeroPausePostTrialDate);
    let postEnd = toDateInput(l.zeroPausePostTrialEndDate);
    if ((!postStart || !postEnd) && l.zeroPauseEndDate) {
      const auto = computeAutoPostTrialWindow(l.zeroPauseEndDate);
      postStart = toDateInput(auto.start);
      postEnd = toDateInput(auto.end);
    }

    setEditingId(l._id);
    setForm({
      plan: l.subscriptionPlan === "premium" ? "premium" : "free",
      billingPeriod:
        l.subscriptionBillingPeriod ||
        billingPeriodFromMonths(l.subscriptionMonthsPaidFor),
      zeroPauseProducts: products,
      zeroPauseChallengePhase: phase,
      zeroPauseDate: toDateInput(l.zeroPauseDate),
      zeroPauseEndDate: toDateInput(l.zeroPauseEndDate),
      zeroPausePostTrialDate: postStart,
      zeroPausePostTrialEndDate: postEnd,
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
      let nextProducts = has
        ? f.zeroPauseProducts.filter((p) => p !== product)
        : [...f.zeroPauseProducts, product];

      // Challenge and Maintainer are mutually exclusive.
      if (!has && product === "challenge") {
        nextProducts = nextProducts.filter((p) => p !== "maintainer");
      }
      if (!has && product === "maintainer") {
        nextProducts = nextProducts.filter((p) => p !== "challenge");
      }

      const hasChallenge = nextProducts.includes("challenge");
      const cleared = nextProducts.length === 0;
      const enablingChallenge = !has && product === "challenge";
      return {
        ...f,
        zeroPauseProducts: nextProducts,
        zeroPauseChallengePhase: enablingChallenge
          ? "trial"
          : f.zeroPauseChallengePhase,
        // Dates are Challenge-window only; clear when Challenge is off.
        zeroPauseDate: cleared || !hasChallenge ? "" : f.zeroPauseDate,
        zeroPauseEndDate: cleared || !hasChallenge ? "" : f.zeroPauseEndDate,
        zeroPausePostTrialDate:
          cleared || !hasChallenge ? "" : f.zeroPausePostTrialDate,
        zeroPausePostTrialEndDate:
          cleared || !hasChallenge ? "" : f.zeroPausePostTrialEndDate,
      };
    });
  };

  const save = async (userId: string) => {
    const hasChallenge = form.zeroPauseProducts.includes("challenge");
    if (hasChallenge) {
      if (form.zeroPauseChallengePhase === "trial") {
        if (!form.zeroPauseDate || !form.zeroPauseEndDate) {
          toast.error("Trial requires both start and end dates");
          return;
        }
        if (form.zeroPauseEndDate < form.zeroPauseDate) {
          toast.error("Trial end date must be on or after the start date");
          return;
        }
      } else {
        if (!form.zeroPausePostTrialDate || !form.zeroPausePostTrialEndDate) {
          toast.error("Post Trial requires both start and end dates");
          return;
        }
        if (form.zeroPausePostTrialEndDate < form.zeroPausePostTrialDate) {
          toast.error(
            "Post Trial end date must be on or after the start date"
          );
          return;
        }
      }
    }

    const autoPost =
      hasChallenge &&
      form.zeroPauseChallengePhase === "trial" &&
      form.zeroPauseEndDate
        ? computeAutoPostTrialWindow(form.zeroPauseEndDate)
        : null;

    await mutateAsync({
      userId,
      plan: form.plan,
      billingPeriod: form.plan === "premium" ? form.billingPeriod : undefined,
      zeroPauseProducts: form.zeroPauseProducts,
      zeroPauseChallengePhase: hasChallenge
        ? form.zeroPauseChallengePhase
        : undefined,
      zeroPauseDate: hasChallenge ? form.zeroPauseDate || null : null,
      zeroPauseEndDate: hasChallenge ? form.zeroPauseEndDate || null : null,
      zeroPausePostTrialDate: hasChallenge
        ? form.zeroPauseChallengePhase === "trial"
          ? autoPost
            ? toDateInput(autoPost.start)
            : null
          : form.zeroPausePostTrialDate || null
        : null,
      zeroPausePostTrialEndDate: hasChallenge
        ? form.zeroPauseChallengePhase === "trial"
          ? autoPost
            ? toDateInput(autoPost.end)
            : null
          : form.zeroPausePostTrialEndDate || null
        : null,
      amount: form.amount,
      paymentMethod: form.paymentMethod,
      note: form.note,
    });

    if (hasChallenge) {
      const postStart =
        form.zeroPauseChallengePhase === "trial" && autoPost
          ? toDateInput(autoPost.start)
          : form.zeroPausePostTrialDate;
      const postEnd =
        form.zeroPauseChallengePhase === "trial" && autoPost
          ? toDateInput(autoPost.end)
          : form.zeroPausePostTrialEndDate;
      setSavedDates((prev) => ({
        ...prev,
        [userId]: {
          start: form.zeroPauseDate,
          end: form.zeroPauseEndDate,
          postStart,
          postEnd,
        },
      }));
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
                    ? l.zeroPauseProducts.filter(isZeroPauseProduct)
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
                            {zeroPause.map((product) => {
                              const label = formatZeroPauseProductWithDate(
                                product,
                                ...(product === "challenge"
                                  ? [
                                      savedDates[l._id]?.start ?? l.zeroPauseDate,
                                      savedDates[l._id]?.end ?? l.zeroPauseEndDate,
                                      savedDates[l._id]?.postStart ??
                                        l.zeroPausePostTrialDate,
                                      savedDates[l._id]?.postEnd ??
                                        l.zeroPausePostTrialEndDate,
                                    ]
                                  : [])
                              );
                              if (!label) return null;
                              return (
                                <span
                                  key={product}
                                  className="px-2 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-700"
                                >
                                  {label}
                                </span>
                              );
                            })}
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
                {form.zeroPauseProducts.includes("challenge") && (
                  <div className="space-y-3 pt-1">
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-gray-600">
                        Challenge phase
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {(
                          [
                            ["trial", "Trial"],
                            ["post_trial", "Post Trial"],
                          ] as const
                        ).map(([value, label]) => {
                          const selected =
                            form.zeroPauseChallengePhase === value;
                          return (
                            <button
                              key={value}
                              type="button"
                              onClick={() =>
                                setForm((f) => {
                                  if (value === "post_trial") {
                                    let postStart = f.zeroPausePostTrialDate;
                                    let postEnd = f.zeroPausePostTrialEndDate;
                                    if (
                                      (!postStart || !postEnd) &&
                                      f.zeroPauseEndDate
                                    ) {
                                      const auto = computeAutoPostTrialWindow(
                                        f.zeroPauseEndDate
                                      );
                                      postStart = toDateInput(auto.start);
                                      postEnd = toDateInput(auto.end);
                                    }
                                    return {
                                      ...f,
                                      zeroPauseChallengePhase: value,
                                      zeroPausePostTrialDate: postStart,
                                      zeroPausePostTrialEndDate: postEnd,
                                    };
                                  }
                                  return {
                                    ...f,
                                    zeroPauseChallengePhase: value,
                                  };
                                })
                              }
                              className={`rounded-lg px-3 py-2 text-sm font-medium border transition-colors ${
                                selected
                                  ? "bg-violet-600 text-white border-violet-600"
                                  : "bg-white text-gray-700 border-gray-200 hover:border-violet-300"
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {form.zeroPauseChallengePhase === "trial" ? (
                      <>
                        <p className="text-xs text-gray-500">
                          Set the Trial period. When it ends, Post Trial is set
                          automatically for {ZERO_PAUSE_POST_TRIAL_DURATION_LABEL}
                          .
                        </p>
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-gray-600">
                            Trial start date (required)
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
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-gray-600">
                            Trial end date (required)
                          </label>
                          <input
                            type="date"
                            value={form.zeroPauseEndDate}
                            onChange={(e) =>
                              setForm((f) => ({
                                ...f,
                                zeroPauseEndDate: e.target.value,
                              }))
                            }
                            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
                          />
                        </div>
                        {form.zeroPauseEndDate && (
                          <p className="text-xs text-gray-500">
                            Post Trial will run{" "}
                            {(() => {
                              try {
                                const auto = computeAutoPostTrialWindow(
                                  form.zeroPauseEndDate
                                );
                                return `${toDateInput(auto.start)} – ${toDateInput(auto.end)}`;
                              } catch {
                                return `for ${ZERO_PAUSE_POST_TRIAL_DURATION_LABEL} after Trial ends`;
                              }
                            })()}
                            .
                          </p>
                        )}
                      </>
                    ) : (
                      <>
                        <p className="text-xs text-gray-500">
                          Set the Post Trial period dates for this learner.
                        </p>
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-gray-600">
                            Post Trial start date (required)
                          </label>
                          <input
                            type="date"
                            value={form.zeroPausePostTrialDate}
                            onChange={(e) =>
                              setForm((f) => ({
                                ...f,
                                zeroPausePostTrialDate: e.target.value,
                              }))
                            }
                            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-gray-600">
                            Post Trial end date (required)
                          </label>
                          <input
                            type="date"
                            value={form.zeroPausePostTrialEndDate}
                            onChange={(e) =>
                              setForm((f) => ({
                                ...f,
                                zeroPausePostTrialEndDate: e.target.value,
                              }))
                            }
                            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
                          />
                        </div>
                      </>
                    )}

                    {form.zeroPauseChallengePhase === "trial" &&
                      form.zeroPauseDate &&
                      form.zeroPauseEndDate && (
                        <p className="text-xs font-medium text-violet-700">
                          Label:{" "}
                          {formatZeroPauseProductWithDate(
                            "challenge",
                            form.zeroPauseDate,
                            form.zeroPauseEndDate
                          )}
                        </p>
                      )}
                    {form.zeroPauseChallengePhase === "post_trial" &&
                      form.zeroPausePostTrialDate &&
                      form.zeroPausePostTrialEndDate && (
                        <p className="text-xs font-medium text-violet-700">
                          Label:{" "}
                          {formatZeroPauseProductWithDate(
                            "challenge",
                            null,
                            null,
                            form.zeroPausePostTrialDate,
                            form.zeroPausePostTrialEndDate
                          )}
                        </p>
                      )}
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

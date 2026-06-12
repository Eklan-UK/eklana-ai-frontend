"use client";

import React, { useState } from "react";
import { useAllLearners, useUpdateUserSubscription } from "@/hooks/useAdmin";
import { Loader2, Edit2, Save, X } from "lucide-react";

const SubscriptionsPage: React.FC = () => {
  const { data, isLoading } = useAllLearners({ limit: 1000, role: "user" });
  const learners = data?.learners || [];
  const { mutateAsync, isPending: saving } = useUpdateUserSubscription();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<{
    plan: "free" | "premium";
    months: number;
    amount?: number;
    paymentMethod?: string;
    note?: string;
  }>({
    plan: "free",
    months: 1,
  });

  const startEdit = (l: any) => {
    setEditingId(l._id);
    setForm({
      plan: l.subscriptionPlan === "premium" ? "premium" : "free",
      months: l.subscriptionMonthsPaidFor || 1,
      amount: l.subscriptionAmountPaid || undefined,
      paymentMethod: l.subscriptionPaymentMethod || "",
      note: l.subscriptionAdminNote || "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const save = async (userId: string) => {
    await mutateAsync({
      userId,
      plan: form.plan,
      months: form.plan === "premium" ? form.months : 0,
      amount: form.amount,
      paymentMethod: form.paymentMethod,
      note: form.note,
    });
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
          View and manage student subscription status
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        {isLoading ? (
          <div className="py-12 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : learners.length === 0 ? (
          <div className="py-12 text-center text-gray-500">
            No learners found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase">
                  <th className="px-4 py-3">Learner</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3">Activated</th>
                  <th className="px-4 py-3">Expires</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-sm">
                {learners.map((l: any) => {
                  const name =
                    `${l.firstName || ""} ${l.lastName || ""}`.trim() ||
                    "Unknown";

                  return (
                    <tr key={l._id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3 font-semibold text-gray-900">
                        {name}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{l.email}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            l.subscriptionPlan === "premium"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {l.subscriptionPlan || "free"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {formatDate(l.subscriptionActivatedAt)}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {formatDate(l.subscriptionExpiresAt)}
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

      {/* Edit subscription modal */}
      {editingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Edit Subscription
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  Choose plan and duration for this learner.
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
                <label className="text-xs font-medium text-gray-600">
                  Plan
                </label>
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
                      Months paid for
                    </label>
                    <input
                      type="number"
                      min={1}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                      value={form.months}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          months: Number(e.target.value) || 1,
                        }))
                      }
                    />
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



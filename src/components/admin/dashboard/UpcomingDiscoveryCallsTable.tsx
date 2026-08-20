"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Clock, Loader2 } from "lucide-react";
import { adminAPI } from "@/lib/api";

const DISCOVERY_CALLS_HREF = "/admin/discovery-call";

interface DiscoveryCallRow {
  _id?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  status?: string;
  createdAt?: string;
}

function getCallName(call: DiscoveryCallRow): string {
  const fromParts = `${call.firstName ?? ""} ${call.lastName ?? ""}`.trim();
  return call.name?.trim() || fromParts || "Unknown";
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const first = parts[0]?.[0] ?? "";
    const last = parts[parts.length - 1]?.[0] ?? "";
    return `${first}${last}`.toUpperCase();
  }
  return (parts[0]?.[0] ?? "?").toUpperCase();
}

function isCreatedToday(iso?: string): boolean {
  if (!iso) return false;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function formatDate(iso?: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(iso?: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function UpcomingDiscoveryCallsTable() {
  const { data: discoveryCallsData, isLoading } = useQuery({
    queryKey: ["admin", "discovery-calls", "recent"],
    queryFn: async () => {
      const res = await adminAPI.getDiscoveryCalls({ limit: 5 });
      return res.data?.calls ?? [];
    },
    staleTime: 1000 * 60 * 2,
  });

  const discoveryCalls = (discoveryCallsData ?? []).filter(
    (call: DiscoveryCallRow) =>
      call.status == null || call.status === "Up coming",
  );

  return (
    <section className="overflow-hidden rounded-[22px] border border-gray-200 bg-white shadow-sm dark:border-border dark:bg-card">
      <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3.5 dark:border-border">
        <h2 className="text-[13px] font-extrabold text-[#101828] dark:text-foreground">
          Upcoming Discovery Calls
        </h2>
        <Link
          href={DISCOVERY_CALLS_HREF}
          className="text-[11px] font-bold text-[#2a602c] hover:underline"
        >
          View All
        </Link>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        </div>
      ) : discoveryCalls.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Clock className="mb-2 h-8 w-8 text-gray-300" />
          <p className="text-sm text-gray-500">No upcoming discovery calls</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left">
            <thead>
              <tr className="border-b border-gray-200 text-[10.5px] font-extrabold uppercase tracking-[1.05px] text-[#99a1af] dark:border-border">
                <th className="px-5 py-3 font-extrabold">Name</th>
                <th className="px-5 py-3 font-extrabold">Date</th>
                <th className="px-5 py-3 font-extrabold">Time</th>
                <th className="px-5 py-3 font-extrabold">Action</th>
              </tr>
            </thead>
            <tbody>
              {discoveryCalls.map((call: DiscoveryCallRow, idx: number) => {
                const name = getCallName(call);
                const join = isCreatedToday(call.createdAt);
                return (
                  <tr
                    key={call._id ?? idx}
                    className="border-b border-gray-100 last:border-b-0 dark:border-border"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#e8f5f2] text-[10px] font-extrabold text-[#146c5b]">
                          {getInitials(name)}
                        </div>
                        <span className="text-[12.5px] font-semibold text-[#1e2939] dark:text-foreground">
                          {name}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-[#6a7282] dark:text-muted-foreground">
                      {formatDate(call.createdAt)}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-[#6a7282] dark:text-muted-foreground">
                      {formatTime(call.createdAt)}
                    </td>
                    <td className="px-5 py-3.5">
                      <Link
                        href={DISCOVERY_CALLS_HREF}
                        className={`inline-flex h-[30px] w-[90px] items-center justify-center rounded-full text-[11px] font-bold ${
                          join
                            ? "bg-[#2a602c] text-white hover:bg-[#418b43]"
                            : "border border-[#2a602c] text-[#2a602c] hover:bg-[#2a602c]/5"
                        }`}
                      >
                        {join ? "Join" : "Reschedule"}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

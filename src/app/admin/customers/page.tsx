"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { RefreshCcw, Search, UserRound } from "lucide-react";

import ModernLoader from "@/components/ui/modern-loader";
import { API_BASE_URL, getAdminToken } from "@/lib/admin-auth";

type AdminCustomer = {
  id: string;
  name: string;
  phone: string;
  email?: string;
  profileImageUrl?: string;
  defaultAddress?: string;
  defaultCity?: string;
  createdAt: string;
  orderCount: number;
  totalSpent: number;
  latestOrderAt?: string | null;
};

const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—");

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  const loadCustomers = useCallback(async () => {
    try {
      setRefreshing(true);
      setLoading(true);
      setError("");
      const token = getAdminToken();
      const qs = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : "";
      const res = await fetch(`${API_BASE_URL}/customers/admin${qs}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Unable to load customers.");
      setCustomers(Array.isArray(data.customers) ? data.customers : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load customers.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [query]);

  useEffect(() => {
    void loadCustomers();
  }, [loadCustomers]);

  const summary = useMemo(() => {
    const total = customers.length;
    const buyers = customers.filter((c) => Number(c.orderCount || 0) > 0).length;
    const revenue = customers.reduce((s, c) => s + Number(c.totalSpent || 0), 0);
    return { total, buyers, revenue };
  }, [customers]);

  return (
    <main className="space-y-4">
      <section className="grid grid-cols-3 gap-2 sm:grid-cols-3 sm:gap-3">
        {[
          { label: "Total", value: summary.total },
          { label: "With orders", value: summary.buyers },
          { label: "Spend", value: `PKR ${summary.revenue}` },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-[var(--border)] bg-white px-3 py-2 sm:p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)] sm:text-xs">{s.label}</p>
            <p className="mt-0.5 text-lg font-semibold text-[var(--foreground)] sm:mt-1 sm:text-2xl">{s.value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-white p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search customer..."
              className="w-full rounded-xl border border-[var(--border)] bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-[var(--primary)]"
            />
          </label>
          <button
            type="button"
            onClick={() => void loadCustomers()}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] text-[var(--foreground)] hover:bg-[#fbf6ef]"
            aria-label="Refresh customers"
          >
            <RefreshCcw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </section>

      <section className="bg-transparent p-0 sm:rounded-2xl sm:border sm:border-[var(--border)] sm:bg-white sm:p-3 sm:p-4">
        {loading ? <ModernLoader label="Loading customers..." /> : null}
        {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
        {!loading && !error && customers.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--muted)]">No customers found.</p>
        ) : null}

        {!loading && customers.length > 0 ? (
          <>
            <div className="hidden overflow-x-auto sm:block">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-xs uppercase tracking-wide text-[var(--muted)]">
                  <th className="px-2 py-3 sm:px-3">Customer</th>
                  <th className="px-2 py-3 sm:px-3">Contact</th>
                  <th className="px-2 py-3 sm:px-3">Address</th>
                  <th className="px-2 py-3 sm:px-3">Orders</th>
                  <th className="px-2 py-3 sm:px-3">Spent</th>
                  <th className="px-2 py-3 sm:px-3">Latest order</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id} className="border-b border-[var(--border)] last:border-b-0">
                    <td className="px-2 py-3 sm:px-3">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]">
                          <UserRound className="h-4 w-4" />
                        </span>
                        <div>
                          <p className="font-medium text-[var(--foreground)]">{c.name || "Customer"}</p>
                          <p className="text-xs text-[var(--muted)]">Joined {fmtDate(c.createdAt)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-3 sm:px-3">
                      <p className="text-[var(--foreground)]">{c.phone || "—"}</p>
                      <p className="text-xs text-[var(--muted)]">{c.email || "—"}</p>
                    </td>
                    <td className="px-2 py-3 sm:px-3">
                      <p className="text-[var(--foreground)]">
                        {[c.defaultAddress, c.defaultCity].filter(Boolean).join(", ") || "—"}
                      </p>
                    </td>
                    <td className="px-2 py-3 font-semibold text-[var(--foreground)] sm:px-3">{c.orderCount || 0}</td>
                    <td className="px-2 py-3 font-semibold text-[var(--foreground)] sm:px-3">PKR {c.totalSpent || 0}</td>
                    <td className="px-2 py-3 text-[var(--foreground)] sm:px-3">{fmtDate(c.latestOrderAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>

            <div className="space-y-2 sm:hidden">
              {customers.map((c) => (
                <Link key={`m-${c.id}`} href={`/admin/customers/${c.id}`} className="block rounded-2xl border border-[var(--border)] bg-white p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-[var(--primary-soft)] text-[var(--primary)]">
                        {c.profileImageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={c.profileImageUrl} alt={c.name || "Customer"} className="h-full w-full object-cover" />
                        ) : (
                          <UserRound className="h-5 w-5" />
                        )}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-[var(--foreground)]">{c.name || "Customer"}</p>
                        <p className="mt-0.5 text-xs text-[var(--muted)]">Joined {fmtDate(c.createdAt)}</p>
                        <p className="mt-1 truncate text-sm text-[var(--foreground)]">{c.phone || "—"}</p>
                        {c.email ? <p className="truncate text-xs text-[var(--muted)]">{c.email}</p> : null}
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="text-xs text-[var(--muted)]">Orders</p>
                      <p className="text-sm font-semibold text-[var(--foreground)]">{c.orderCount || 0}</p>
                      <p className="mt-2 text-xs text-[var(--muted)]">Spent</p>
                      <p className="text-sm font-semibold text-[var(--foreground)]">PKR {c.totalSpent || 0}</p>
                    </div>
                  </div>

                  <div className="mt-2 flex items-center justify-between gap-2 border-t border-[var(--border)] pt-2 text-xs text-[var(--muted)]">
                    <p className="min-w-0 truncate">{[c.defaultAddress, c.defaultCity].filter(Boolean).join(", ") || "—"}</p>
                    <p className="shrink-0">Last {fmtDate(c.latestOrderAt)}</p>
                  </div>
                </Link>
              ))}
            </div>
          </>
        ) : null}
      </section>
    </main>
  );
}


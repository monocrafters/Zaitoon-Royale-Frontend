"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, RefreshCcw, UserRound } from "lucide-react";

import ModernLoader from "@/components/ui/modern-loader";
import { API_BASE_URL, getAdminToken } from "@/lib/admin-auth";

type CustomerPayload = {
  customer: {
    id: string;
    name: string;
    phone: string;
    email?: string;
    profileImageUrl?: string;
    defaultAddress?: string;
    defaultCity?: string;
    createdAt?: string;
    stats?: { totalOrders?: number; totalSpent?: number; lastOrderAt?: string | null };
  };
  orders: any[];
};

const fmtDateTime = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "—";

export default function AdminCustomerDetailsPage() {
  const params = useParams<{ id: string }>();
  const customerId = String(params?.id || "");

  const [data, setData] = useState<CustomerPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setRefreshing(true);
      setLoading(true);
      setError("");
      const token = getAdminToken();
      const res = await fetch(`${API_BASE_URL}/customers/admin/${encodeURIComponent(customerId)}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Unable to load customer.");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load customer.");
      setData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [customerId]);

  useEffect(() => {
    if (!customerId) return;
    void load();
  }, [customerId, load]);

  const st = useMemo(() => {
    const stats = data?.customer?.stats || {};
    return {
      totalOrders: Number(stats.totalOrders || 0),
      totalSpent: Number(stats.totalSpent || 0),
      lastOrderAt: stats.lastOrderAt || null,
    };
  }, [data]);

  return (
    <main className="space-y-4">
      <section className="flex items-center justify-between gap-2 rounded-2xl border border-[var(--border)] bg-white p-3 sm:p-4">
        <div className="flex min-w-0 items-center gap-2">
          <Link href="/admin/customers" className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] hover:bg-[#fbf6ef]" aria-label="Back">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-[var(--foreground)]">{data?.customer?.name || "Customer details"}</p>
            <p className="truncate text-xs text-[var(--muted)]">{data?.customer?.phone || "—"}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] hover:bg-[#fbf6ef]"
          aria-label="Refresh"
        >
          <RefreshCcw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </section>

      {loading ? <ModernLoader label="Loading customer..." /> : null}
      {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      {!loading && data ? (
        <>
          <section className="flex items-start justify-between gap-3 rounded-2xl border border-[var(--border)] bg-white p-3 sm:p-4">
            <div className="flex min-w-0 items-start gap-3">
              <span className="inline-flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-[var(--primary-soft)] text-[var(--primary)]">
                {data.customer.profileImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={data.customer.profileImageUrl} alt={data.customer.name || "Customer"} className="h-full w-full object-cover" />
                ) : (
                  <UserRound className="h-6 w-6" />
                )}
              </span>
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold text-[var(--foreground)]">{data.customer.name || "Customer"}</p>
                <p className="mt-0.5 truncate text-sm text-[var(--foreground)]">{data.customer.phone || "—"}</p>
                {data.customer.email ? <p className="truncate text-sm text-[var(--muted)]">{data.customer.email}</p> : null}
                <p className="mt-2 text-sm text-[var(--foreground)]">
                  {[data.customer.defaultAddress, data.customer.defaultCity].filter(Boolean).join(", ") || "—"}
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">Joined {fmtDateTime(data.customer.createdAt || null)}</p>
              </div>
            </div>

            <div className="shrink-0 text-right">
              <p className="text-xs text-[var(--muted)]">Customer ID</p>
              <p className="max-w-[180px] truncate font-mono text-[10px] text-[var(--foreground)]">{data.customer.id}</p>
            </div>
          </section>

          <section className="grid grid-cols-3 gap-2 sm:gap-3">
            {[
              { label: "Orders", value: st.totalOrders },
              { label: "Spent", value: `PKR ${st.totalSpent}` },
              { label: "Last", value: fmtDateTime(st.lastOrderAt) },
            ].map((c) => (
              <div key={c.label} className="rounded-2xl border border-[var(--border)] bg-white px-3 py-2 sm:p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)] sm:text-xs">{c.label}</p>
                <p className="mt-0.5 truncate text-lg font-semibold text-[var(--foreground)] sm:mt-1 sm:text-2xl">{c.value}</p>
              </div>
            ))}
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-white p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-[var(--foreground)]">Recent orders</p>
              <p className="text-xs text-[var(--muted)]">{Array.isArray(data.orders) ? data.orders.length : 0} shown</p>
            </div>

            {!Array.isArray(data.orders) || data.orders.length === 0 ? (
              <p className="py-6 text-center text-sm text-[var(--muted)]">No orders found for this customer.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {data.orders.map((o: any) => (
                  <div key={String(o._id || o.id)} className="rounded-2xl border border-[var(--border)] bg-[#fffaf4] p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[var(--foreground)]">Order {String(o._id || "").slice(-6).toUpperCase()}</p>
                        <p className="mt-0.5 text-xs text-[var(--muted)]">{fmtDateTime(o.createdAt || null)}</p>
                        <p className="mt-1 truncate text-xs text-[var(--muted)]">
                          {(Array.isArray(o.products) ? o.products.map((p: any) => String(p?.title || p?.name || "")).filter(Boolean).slice(0, 4).join(", ") : "") || "—"}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xs text-[var(--muted)]">Status</p>
                        <p className="text-sm font-semibold text-[var(--foreground)]">{String(o.status || "—")}</p>
                        <p className="mt-1 text-xs text-[var(--muted)]">Total</p>
                        <p className="text-sm font-semibold text-[var(--foreground)]">PKR {Number(o.totalPayment || 0)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      ) : null}
    </main>
  );
}


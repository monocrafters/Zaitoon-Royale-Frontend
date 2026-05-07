"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { API_BASE_URL, getAdminToken } from "@/lib/admin-auth";
import { Activity, BadgeDollarSign, RotateCw, ShoppingBag, Users } from "lucide-react";

type Summary = {
  customersTotal: number;
  ordersTotal: number;
  revenueTotal: number;
  ordersToday: number;
  revenueToday: number;
};

type AnalyticsPayload = {
  summary: Summary;
  statusBreakdown: Record<string, number>;
  last7Days: Array<{ date: string; label: string; orders: number; revenue: number }>;
  topItems: Array<{ title: string; qty: number; revenue: number }>;
};

const money = (n: number) =>
  `PKR ${Math.round(Number(n) || 0).toLocaleString("en-PK", { maximumFractionDigits: 0 })}`;

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setRefreshing(true);
    const token = getAdminToken();
    try {
      const res = await fetch(`${API_BASE_URL}/analytics/admin/summary`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.message || "Unable to load analytics.");
      setData(payload as AnalyticsPayload);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const run = async () => {
      try {
        setError("");
        setLoading(true);
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unable to load analytics.");
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [load]);

  const maxOrders = useMemo(() => {
    const v = Math.max(1, ...(data?.last7Days || []).map((d) => d.orders || 0));
    return v || 1;
  }, [data?.last7Days]);

  const statusEntries = useMemo(() => {
    const raw = data?.statusBreakdown || {};
    const order = ["pending", "confirmed", "preparing", "on_the_way", "delivered", "cancelled"];
    return order.map((k) => [k, Number(raw[k] || 0)] as const);
  }, [data?.statusBreakdown]);

  const maxRevenue = useMemo(() => {
    const v = Math.max(1, ...(data?.last7Days || []).map((d) => d.revenue || 0));
    return v || 1;
  }, [data?.last7Days]);

  return (
    <main className="-m-4 flex h-[calc(100vh-64px)] flex-col overflow-hidden bg-white sm:-m-6 sm:h-[calc(100vh-74px)]">
      <section className="shrink-0 border-b border-[#e4d5c7] bg-white p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-[#1c130e]">Analytics</p>
            <p className="text-xs text-[#6f5647]">A simple snapshot of orders and revenue.</p>
          </div>
          <button
            onClick={() => void load()}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#dccbbb] bg-[#fffaf4] text-[#5b2d17]"
            aria-label="Refresh analytics"
          >
            <RotateCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </section>

      <section className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {loading ? <p className="text-sm text-[#6f5647]">Loading analytics…</p> : null}
        {error ? <p className="mb-2 text-sm text-red-600">{error}</p> : null}
        {data ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: "Today Orders", value: data.summary.ordersToday, icon: ShoppingBag, accent: "from-[#fff3e7] to-[#fffaf4]" },
                { label: "Today Revenue", value: money(data.summary.revenueToday), icon: BadgeDollarSign, accent: "from-[#fff5ec] to-[#fffaf4]" },
                { label: "Total Orders", value: data.summary.ordersTotal, icon: Activity, accent: "from-[#fff8f0] to-[#fffaf4]" },
                { label: "Customers", value: data.summary.customersTotal, icon: Users, accent: "from-[#fff4ea] to-[#fffaf4]" },
              ].map((kpi) => {
                const Icon = kpi.icon;
                return (
                  <article
                    key={kpi.label}
                    className={`rounded-2xl border border-[#e4d5c7] bg-gradient-to-br ${kpi.accent} p-3 sm:p-4`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-white text-[#7a3f22]">
                        <Icon className="h-4 w-4" />
                      </span>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8a6f5e]">{kpi.label}</p>
                    </div>
                    <p className="mt-2 text-lg font-semibold text-[#1c130e] sm:text-2xl">{kpi.value}</p>
                  </article>
                );
              })}
            </div>

            <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
              <div className="rounded-2xl border border-[#e4d5c7] bg-white p-3 sm:p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-[#1c130e]">Orders by status</p>
                  <p className="text-xs text-[#8a6f5e]">Total: {data.summary.ordersTotal}</p>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {statusEntries.map(([k, v]) => (
                    <div key={k} className="rounded-xl border border-[#eadccf] bg-[#fffaf4] px-2.5 py-2">
                      <p className="text-[10px] uppercase tracking-wide text-[#8a6f5e]">{k.replaceAll("_", " ")}</p>
                      <p className="mt-1 text-sm font-semibold text-[#5b2d17]">{v}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-[#e4d5c7] bg-white p-3 sm:p-4">
                <p className="text-sm font-semibold text-[#1c130e]">Top items (by quantity)</p>
                <div className="mt-3 space-y-1.5">
                  {data.topItems.map((it) => (
                    <div key={it.title} className="flex items-start justify-between gap-3 rounded-xl border border-[#eadccf] bg-[#fffaf4] px-2.5 py-2">
                      <div className="min-w-0">
                        <p className="line-clamp-1 text-sm font-semibold text-[#2f1c12]">{it.title}</p>
                        <p className="text-[11px] text-[#6f5647]">Qty: {it.qty}</p>
                      </div>
                      <p className="shrink-0 text-[11px] font-semibold text-[#5b2d17]">{money(it.revenue)}</p>
                    </div>
                  ))}
                  {data.topItems.length === 0 ? <p className="text-sm text-[#6f5647]">No items yet.</p> : null}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-[#e4d5c7] bg-white p-3 sm:p-4">
              <p className="text-sm font-semibold text-[#1c130e]">Last 7 Days (Orders & Revenue)</p>
              <div className="mt-4 grid grid-cols-7 gap-2">
                {data.last7Days.map((d) => (
                  <div key={d.date} className="flex flex-col items-center gap-1">
                    <div className="flex h-24 w-full items-end gap-1 sm:h-28">
                      <div
                        className="w-1/2 rounded-t bg-[#5b2d17]"
                        style={{ height: `${Math.max(8, Math.round((d.orders / maxOrders) * 100))}%` }}
                        title={`Orders: ${d.orders}`}
                      />
                      <div
                        className="w-1/2 rounded-t bg-[#d08b5b]"
                        style={{ height: `${Math.max(8, Math.round((d.revenue / maxRevenue) * 100))}%` }}
                        title={`Revenue: ${money(d.revenue)}`}
                      />
                    </div>
                    <p className="text-[10px] font-semibold text-[#6f5647]">{d.label}</p>
                  </div>
                ))}
              </div>
              {data.last7Days.length === 0 ? <p className="mt-2 text-sm text-[#6f5647]">No recent data.</p> : null}
              <div className="mt-3 flex items-center gap-3 text-[10px] text-[#8a6f5e]">
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#5b2d17]" />Orders</span>
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#d08b5b]" />Revenue</span>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}

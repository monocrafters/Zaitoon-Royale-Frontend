"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, DollarSign, Package, Users } from "lucide-react";
import { API_BASE_URL, getAdminToken } from "@/lib/admin-auth";
import ModernLoader from "@/components/ui/modern-loader";

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<{
    summary: {
      customersTotal: number;
      ordersTotal: number;
      revenueTotal: number;
      ordersToday: number;
      revenueToday: number;
    };
    statusBreakdown: Record<string, number>;
    last7Days: Array<{ label: string; orders: number; revenue: number }>;
    topItems: Array<{ title: string; qty: number; revenue: number }>;
  } | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const token = getAdminToken();
        const res = await fetch(`${API_BASE_URL}/analytics/admin/summary`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const payload = await res.json();
        if (!res.ok) throw new Error(payload.message || "Unable to load dashboard.");
        setData(payload);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unable to load dashboard.");
        setData(null);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const maxOrders = useMemo(() => {
    const points = data?.last7Days || [];
    return Math.max(1, ...points.map((p) => Number(p.orders) || 0));
  }, [data?.last7Days]);

  if (loading) return <ModernLoader label="Loading dashboard..." />;
  if (error) return <p className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>;

  const summary = data?.summary || {
    customersTotal: 0,
    ordersTotal: 0,
    revenueTotal: 0,
    ordersToday: 0,
    revenueToday: 0,
  };
  const status = data?.statusBreakdown || {};
  const days = data?.last7Days || [];
  const topItems = data?.topItems || [];

  return (
    <section className="space-y-4">
      <div className="grid gap-3 grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Today Orders", value: summary.ordersToday, icon: Package },
          { label: "Today Revenue", value: `PKR ${summary.revenueToday}`, icon: DollarSign },
          { label: "Total Orders", value: summary.ordersTotal, icon: Activity },
          { label: "Customers", value: summary.customersTotal, icon: Users },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <article key={card.label} className="rounded-2xl border border-[var(--border)] bg-white p-3 sm:p-4">
              <div className="flex items-center gap-2 text-[var(--muted)]">
                <Icon className="h-4 w-4" />
                <p className="text-xs sm:text-sm">{card.label}</p>
              </div>
              <p className="mt-2 font-[family-name:var(--font-poppins)] text-lg font-semibold text-[var(--foreground)] sm:text-2xl">
                {card.value}
              </p>
            </article>
          );
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <article className="rounded-2xl border border-[var(--border)] bg-white p-4">
          <p className="text-sm font-semibold text-[var(--foreground)]">Last 7 Days Orders</p>
          <div className="mt-4 grid grid-cols-7 gap-2">
            {days.map((d) => (
              <div key={d.label} className="flex flex-col items-center gap-1">
                <div className="flex h-24 w-full items-end">
                  <div
                    className="w-full rounded-t-md bg-[var(--primary)]/80"
                    style={{ height: `${Math.max(8, Math.round(((d.orders || 0) / maxOrders) * 100))}%` }}
                  />
                </div>
                <p className="text-[10px] text-[var(--muted)]">{d.label}</p>
                <p className="text-[10px] font-semibold text-[var(--foreground)]">{d.orders}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-2xl border border-[var(--border)] bg-white p-4">
          <p className="text-sm font-semibold text-[var(--foreground)]">Order Status</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {Object.entries(status).map(([k, v]) => (
              <div key={k} className="rounded-xl border border-[var(--border)] bg-[var(--primary-soft)] px-3 py-2">
                <p className="text-[10px] uppercase tracking-wide text-[var(--muted)]">{k.replaceAll("_", " ")}</p>
                <p className="text-sm font-semibold text-[var(--foreground)]">{v}</p>
              </div>
            ))}
          </div>
        </article>
      </div>

      <article className="rounded-2xl border border-[var(--border)] bg-white p-4">
        <p className="text-sm font-semibold text-[var(--foreground)]">Top Items</p>
        <div className="mt-3 space-y-2">
          {topItems.map((it) => (
            <div key={it.title} className="flex items-center justify-between rounded-xl border border-[var(--border)] px-3 py-2">
              <p className="line-clamp-1 text-sm text-[var(--foreground)]">{it.title}</p>
              <p className="text-xs font-semibold text-[var(--muted)]">{it.qty} qty · PKR {it.revenue}</p>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}

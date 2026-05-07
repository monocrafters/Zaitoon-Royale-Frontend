"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bell, MessageCircleMore, RefreshCcw } from "lucide-react";

import ModernLoader from "@/components/ui/modern-loader";
import { API_BASE_URL, getAdminToken } from "@/lib/admin-auth";

type NotificationItem = {
  id: string;
  type: "support" | "contact";
  title: string;
  description: string;
  createdAt: string;
  href: string;
  unreadCount?: number;
};

const fmtDateTime = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "—";

export default function AdminNotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [counts, setCounts] = useState({ support: 0, contact: 0, total: 0 });

  const load = useCallback(async () => {
    const token = getAdminToken();
    if (!token) return;
    try {
      setRefreshing(true);
      setLoading((prev) => prev && !refreshing);
      setError("");
      const res = await fetch(`${API_BASE_URL}/notifications/admin`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.message || "Unable to load notifications.");
      setItems(Array.isArray(payload.notifications) ? payload.notifications : []);
      setCounts({
        support: Number(payload.summary?.unreadSupportCount || 0),
        contact: Number(payload.summary?.unreadContactCount || 0),
        total: Number(payload.summary?.totalUnread || 0),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load notifications.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [refreshing]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      void load();
    }, 12000);
    return () => window.clearInterval(timer);
  }, [load]);

  const stats = useMemo(
    () => [
      { label: "Total unread", value: counts.total },
      { label: "Support", value: counts.support },
      { label: "Contact", value: counts.contact },
    ],
    [counts]
  );

  return (
    <main className="space-y-4">
      <section className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate font-[family-name:var(--font-poppins)] text-xl font-semibold text-[var(--foreground)] sm:text-2xl">
            Notifications
          </h2>
          <p className="mt-0.5 line-clamp-1 text-xs text-[var(--muted)] sm:text-sm">
            New support and contact updates appear here.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] text-[var(--foreground)] hover:bg-[#fbf6ef]"
          aria-label="Refresh notifications"
        >
          <RefreshCcw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </section>

      <section className="grid grid-cols-3 gap-2 sm:gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-[var(--border)] bg-white px-3 py-2 sm:p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)] sm:text-xs">{s.label}</p>
            <p className="mt-0.5 text-lg font-semibold text-[var(--foreground)] sm:mt-1 sm:text-2xl">{s.value}</p>
          </div>
        ))}
      </section>

      {loading ? <ModernLoader label="Loading notifications..." /> : null}
      {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      {!loading && !error && items.length === 0 ? (
        <div className="rounded-2xl border border-[var(--border)] bg-white p-6 text-center">
          <Bell className="mx-auto h-8 w-8 text-[var(--muted)]" />
          <p className="mt-2 text-sm text-[var(--muted)]">No new notifications right now.</p>
        </div>
      ) : null}

      {!loading && items.length > 0 ? (
        <section className="space-y-2">
          {items.map((n) => (
            <Link key={n.id} href={n.href} className="block rounded-2xl border border-[var(--border)] bg-white p-3 hover:bg-[#fffaf4]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p
                    className={[
                      "line-clamp-1 text-sm text-[var(--foreground)]",
                      Number(n.unreadCount || 0) > 0 ? "font-bold" : "font-semibold",
                    ].join(" ")}
                  >
                    {n.title}
                  </p>
                  <p
                    className={[
                      "mt-1 line-clamp-2 text-xs",
                      Number(n.unreadCount || 0) > 0 ? "font-medium text-[var(--foreground)]" : "text-[var(--muted)]",
                    ].join(" ")}
                  >
                    {n.description}
                  </p>
                  <p className="mt-1 text-[11px] text-[var(--muted)]">{fmtDateTime(n.createdAt)}</p>
                </div>
                <div className="shrink-0 text-right">
                  <span className="inline-flex items-center rounded-full bg-[var(--primary-soft)] px-2 py-1 text-[10px] font-semibold text-[var(--primary)]">
                    {n.type === "support" ? "Support" : "Contact"}
                  </span>
                  {Number(n.unreadCount || 0) > 0 ? (
                    <span className="mt-1 inline-flex min-w-6 items-center justify-center rounded-full bg-[var(--primary)] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                      {n.unreadCount}
                    </span>
                  ) : null}
                </div>
              </div>
            </Link>
          ))}
        </section>
      ) : null}
    </main>
  );
}


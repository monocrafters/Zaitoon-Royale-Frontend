"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Package, RotateCw } from "lucide-react";

import SiteHeader from "@/components/public/site-header";
import { API_BASE_URL } from "@/lib/admin-auth";
import {
  type CustomerOrder,
  formatItemsPreview,
  formatPlacedDate,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_STYLES,
} from "@/lib/customer-order-utils";
import { clearCustomerSession, getCustomerToken, useCustomerSession } from "@/lib/customer-auth";
import ModernLoader from "@/components/ui/modern-loader";
import { fetchMyPendingReviewItems, type PendingReviewItem } from "@/lib/reviews-client";

export default function OrdersPage() {
  const { hasSession, profile } = useCustomerSession();
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const [pendingReviewItems, setPendingReviewItems] = useState<PendingReviewItem[]>([]);

  const load = useCallback(async (quiet?: boolean) => {
    const token = getCustomerToken();
    if (!token) {
      setOrders([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    setError("");
    if (quiet) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/orders/my`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          clearCustomerSession();
        }
        throw new Error(data.message || "Could not load orders.");
      }
      setOrders(Array.isArray(data.orders) ? data.orders : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load orders.");
      setOrders([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, hasSession]);

  useEffect(() => {
    const run = async () => {
      if (!hasSession) {
        setPendingReviewItems([]);
        return;
      }
      try {
        const data = await fetchMyPendingReviewItems();
        setPendingReviewItems(Array.isArray(data.pending) ? data.pending : []);
      } catch {
        setPendingReviewItems([]);
      }
    };
    void run();
  }, [hasSession]);

  const pendingByOrder = useMemo(() => {
    const map = new Map<string, { orderId: string; orderCreatedAt: string; items: PendingReviewItem[] }>();
    for (const p of pendingReviewItems) {
      const key = p.orderId;
      const prev = map.get(key);
      if (!prev) map.set(key, { orderId: key, orderCreatedAt: p.orderCreatedAt, items: [p] });
      else prev.items.push(p);
    }
    return Array.from(map.values());
  }, [pendingReviewItems]);

  return (
    <main className="min-h-screen bg-[#f5efe8] text-[#2f1c12] antialiased">
      <SiteHeader />
      <section className="w-full px-4 pb-16 pt-[96px] sm:px-6 lg:px-8">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-[family-name:var(--font-poppins)] text-2xl font-semibold text-[#111] sm:text-3xl">Orders</h1>
            <p className="mt-1 text-sm text-[#6f5647]">
              {profile?.name ? `${profile.name}` : "Your recent orders"}
            </p>
          </div>
          {hasSession ? (
            <button
              type="button"
              onClick={() => void load(true)}
              disabled={loading || refreshing}
              className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#dccbbb] bg-white text-[#5b2d17] transition hover:bg-[#f6ece2] disabled:opacity-50"
              aria-label="Refresh orders"
            >
              <RotateCw className={`h-[18px] w-[18px] ${refreshing ? "animate-spin" : ""}`} aria-hidden />
            </button>
          ) : null}
        </div>

        {!hasSession ? (
          <div className="mt-8 rounded-2xl border border-[#eadccf] bg-white p-8 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#5b2d17]/10 text-[#5b2d17]">
              <Package className="h-7 w-7" aria-hidden />
            </div>
            <p className="mt-4 text-base font-semibold text-[#1d140f]">No account session yet</p>
            <p className="mt-2 text-sm text-[#6f5647]">
              Complete checkout once — then <span className="font-medium text-[#2f1c12]">Orders</span> stays in the header.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/menu"
                className="rounded-xl bg-[#111] px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
              >
                Browse menu
              </Link>
              <Link
                href="/cart"
                className="rounded-xl border border-[#1d140f] bg-white px-5 py-2.5 text-sm font-semibold text-[#111] transition hover:bg-[#faf7f2]"
              >
                View cart
              </Link>
            </div>
          </div>
        ) : null}

        {hasSession && !loading && pendingByOrder.length > 0 ? (
          <div className="mt-6 rounded-2xl border border-[#eadccf] bg-white p-5">
            <p className="text-sm font-semibold text-[#1d140f]">Reviews available for delivered orders</p>
            <p className="mt-1 text-xs text-[#6f5647]">Give your feedback and help others choose.</p>
            <div className="mt-4 space-y-2">
              {pendingByOrder.slice(0, 3).map((po) => (
                <div key={po.orderId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#f0e6da] bg-[#fffaf4] px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#2f1c12]">Order {po.orderId}</p>
                    <p className="text-xs text-[#6f5647]">{po.items.length} item(s) to review</p>
                  </div>
                  <Link
                    href={`/orders/${po.orderId}`}
                    className="rounded-xl bg-[#5b2d17] px-4 py-2 text-sm font-semibold !text-white"
                  >
                    Review now
                  </Link>
                </div>
              ))}
              {pendingByOrder.length > 3 ? (
                <p className="text-xs text-[#6f5647]">+ {pendingByOrder.length - 3} more orders</p>
              ) : null}
            </div>
          </div>
        ) : null}

        {hasSession && loading ? <ModernLoader className="mt-10" label="Loading your orders..." /> : null}

        {hasSession && !loading && error ? (
          <p className="mt-8 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
        ) : null}

        {hasSession && !loading && !error && orders.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-[#dccbbb] bg-[#fffaf4] p-8 text-center">
            <p className="text-sm font-medium text-[#2f1c12]">No orders yet</p>
            <p className="mt-1 text-sm text-[#6f5647]">Confirm an order and it will appear here.</p>
            <Link href="/menu" className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-[#b84a2b]">
              Order something delicious
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        ) : null}

        {hasSession && !loading && orders.length > 0 ? (
          <div className="-mx-4 mt-6 sm:-mx-6 lg:-mx-8">
            <ul className="divide-y divide-[#d4c9bc] border-y border-[#d4c9bc]">
              {orders.map((order) => {
                const st = order.status || "pending";
                const badgeClass = ORDER_STATUS_STYLES[st] || "bg-[#f0ebe4] text-[#2f1c12] ring-[#e0d5c8]";
                const preview = formatItemsPreview(order.items || []);
                return (
                  <li key={order._id}>
                    <Link
                      href={`/orders/${order._id}`}
                      className="block px-4 py-3 transition hover:bg-[#fffaf4]/80 active:bg-[#fffaf4] sm:px-6 sm:py-4 lg:px-8"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="min-w-0 truncate text-xs font-semibold text-[#1d140f]">
                          {formatPlacedDate(order.createdAt)}
                        </p>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${badgeClass}`}>
                            {ORDER_STATUS_LABELS[st] || st}
                          </span>
                          <span className="text-xs font-semibold text-[#5b2d17] whitespace-nowrap">PKR {order.totalPayment ?? 0}</span>
                        </div>
                      </div>
                      {preview ? (
                        <p className="mt-1 line-clamp-1 text-[11px] text-[#6f5647]" title={preview}>
                          {preview}
                        </p>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </section>
    </main>
  );
}

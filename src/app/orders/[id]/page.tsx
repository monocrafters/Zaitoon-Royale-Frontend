"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import { Package } from "lucide-react";

import SiteHeader from "@/components/public/site-header";
import { API_BASE_URL } from "@/lib/admin-auth";
import {
  type CustomerOrder,
  formatPlacedDate,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_STYLES,
} from "@/lib/customer-order-utils";
import { clearCustomerSession, getCustomerToken, useCustomerSession } from "@/lib/customer-auth";
import ModernLoader from "@/components/ui/modern-loader";
import { fetchMyPendingReviewItems, submitMyReview, type PendingReviewItem } from "@/lib/reviews-client";

export default function OrderDetailPage() {
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : "";
  const { hasSession } = useCustomerSession();

  const [order, setOrder] = useState<CustomerOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [reviewItems, setReviewItems] = useState<PendingReviewItem[]>([]);
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, { rating: number; text: string }>>({});
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewFeedback, setReviewFeedback] = useState("");
  const st = order?.status || "pending";

  const load = useCallback(async () => {
    const token = getCustomerToken();
    if (!token || !id) {
      setOrder(null);
      setLoading(false);
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/orders/my/${encodeURIComponent(id)}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) clearCustomerSession();
        throw new Error(data.message || "Could not load order.");
      }
      setOrder(data.order || null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load order.");
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load, hasSession]);

  useEffect(() => {
    if (!hasSession || !order) return;
    if (st !== "delivered") {
      setReviewItems([]);
      setReviewFeedback("");
      return;
    }
    const run = async () => {
      try {
        const data = await fetchMyPendingReviewItems();
        const pending = Array.isArray(data.pending) ? data.pending : [];
        const forThisOrder = pending.filter((p) => String(p.orderId) === String(order._id));
        setReviewItems(forThisOrder);
        setReviewFeedback("");
        setReviewDrafts((prev) => {
          const next = { ...prev };
          for (const it of forThisOrder) {
            if (!next[it.title]) next[it.title] = { rating: 5, text: "" };
          }
          return next;
        });
      } catch {
        setReviewItems([]);
      }
    };
    void run();
  }, [hasSession, order, st]);
  const badgeClass = ORDER_STATUS_STYLES[st] || "bg-[#f0ebe4] text-[#2f1c12] ring-[#e0d5c8]";

  return (
    <main className="min-h-screen bg-[#f5efe8] text-[#2f1c12] antialiased">
      <SiteHeader />
      <section className="w-full px-4 pb-16 pt-[72px] sm:px-6 sm:pt-[96px] lg:mx-auto lg:max-w-6xl lg:px-8">
        {!hasSession ? (
          <div className="mt-8 border-y border-dashed border-[#cfc4b8] py-10 text-center">
            <Package className="mx-auto h-10 w-10 text-[#7d6b5d]" aria-hidden />
            <p className="mt-3 text-sm text-[#6f5647]">Sign in via checkout to view this order.</p>
            <Link href="/cart" className="mt-4 inline-block rounded-xl bg-[#111] px-5 py-2.5 text-sm font-semibold text-white">
              Go to cart
            </Link>
          </div>
        ) : null}

        {hasSession && loading ? <ModernLoader className="mt-10" label="Loading order..." /> : null}

        {hasSession && !loading && error ? (
          <p className="mt-8 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
        ) : null}

        {hasSession && !loading && order ? (
          <div className="-mx-4 mt-0 divide-y divide-[#d4c9bc] border-y border-[#d4c9bc] sm:-mx-6 lg:-mx-8">
            <section className="px-4 pb-5 pt-2 sm:px-6 sm:pt-3 lg:px-8">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#7d6b5d]">Placed</p>
                  <p className="text-base font-semibold text-[#1d140f]">{formatPlacedDate(order.createdAt)}</p>
                </div>
                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${badgeClass}`}>
                  {ORDER_STATUS_LABELS[st] || st}
                </span>
              </div>
              <div className="mt-4 flex items-baseline justify-between">
                <span className="text-sm text-[#6f5647]">Total</span>
                <span className="text-lg font-semibold text-[#5b2d17]">PKR {order.totalPayment ?? 0}</span>
              </div>
              <p className="mt-1 text-xs text-[#7d6b5d]">{order.totalItems ?? 0} items</p>
            </section>

            <section className="px-4 py-5 sm:px-6 lg:px-8">
              <h2 className="text-sm font-semibold text-[#1d140f]">Items</h2>
              <ul className="mt-3 divide-y divide-[#e8dfd4]">
                {(order.items || []).map((it, idx) => (
                  <li key={`${it.title}-${idx}`} className="flex gap-3 py-4 first:pt-0">
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden">
                      {it.imageUrl ? (
                        <Image src={it.imageUrl} alt={it.title} fill className="object-cover" unoptimized />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[#c4b5a8]">
                          <Package className="h-6 w-6" aria-hidden />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-[#2f1c12]">{it.title}</p>
                      <p className="text-xs text-[#7d6b5d]">
                        Qty {it.qty} · Unit PKR {it.unitPrice ?? "—"}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold text-[#5b2d17]">PKR {it.lineTotal ?? 0}</p>
                  </li>
                ))}
              </ul>
            </section>

            {order.customer ? (
              <section className="bg-[#fffaf4]/60 px-4 py-5 sm:px-6 lg:px-8">
                <h2 className="text-sm font-semibold text-[#1d140f]">Delivery</h2>
                <dl className="mt-3 space-y-3 text-sm">
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#7d6b5d]">Name</dt>
                    <dd className="text-[#2f1c12]">{order.customer.name || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#7d6b5d]">Phone</dt>
                    <dd className="text-[#2f1c12]">{order.customer.phone || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#7d6b5d]">Address</dt>
                    <dd className="text-[#2f1c12]">
                      {[order.customer.address, order.customer.city].filter(Boolean).join(", ") || "—"}
                    </dd>
                  </div>
                  {order.customer.notes ? (
                    <div>
                      <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#7d6b5d]">Notes</dt>
                      <dd className="text-[#6f5647]">{order.customer.notes}</dd>
                    </div>
                  ) : null}
                  {st === "cancelled" && order.cancelReason ? (
                    <div>
                      <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#7d6b5d]">Cancellation reason</dt>
                      <dd className="text-[#9b1c1c]">{order.cancelReason}</dd>
                    </div>
                  ) : null}
                </dl>
              </section>
            ) : null}

            {st === "delivered" ? (
              <section className="px-4 py-6 sm:px-6 lg:px-8">
                <h2 className="text-sm font-semibold text-[#1d140f]">Review your delivered order</h2>
                {reviewItems.length === 0 ? (
                  <p className="mt-2 text-sm text-[#6f5647]">Thanks! You’ve already reviewed these items.</p>
                ) : (
                  <div className="mt-4 space-y-4">
                    {reviewItems.map((it) => {
                      const draft = reviewDrafts[it.title] || { rating: 5, text: "" };
                      return (
                        <div key={`${it.orderId}-${it.title}`} className="rounded-2xl border border-[#eadccf] bg-white p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className="relative h-12 w-12 overflow-hidden rounded-lg bg-[#fffaf4]">
                                {it.imageUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={it.imageUrl} alt={it.title} className="h-full w-full object-cover" />
                                ) : null}
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-[#2f1c12]">{it.title}</p>
                                <p className="text-xs text-[#6f5647]">Qty {it.qty}</p>
                              </div>
                            </div>
                          </div>

                          <div className="mt-3 grid gap-3 sm:grid-cols-[140px_1fr]">
                            <label>
                              <span className="block text-xs font-semibold uppercase tracking-wide text-[#7d6b5d]">Rating</span>
                              <select
                                value={draft.rating}
                                onChange={(e) =>
                                  setReviewDrafts((prev) => ({
                                    ...prev,
                                    [it.title]: { ...(prev[it.title] || { rating: 5, text: "" }), rating: Number(e.target.value) },
                                  }))
                                }
                                className="mt-2 w-full rounded-xl border border-[#dccbbb] bg-white px-3 py-2 text-sm outline-none focus:border-[#b84a2b]"
                              >
                                {[5, 4, 3, 2, 1].map((v) => (
                                  <option key={v} value={v}>
                                    {v} Stars
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label>
                              <span className="block text-xs font-semibold uppercase tracking-wide text-[#7d6b5d]">Review</span>
                              <textarea
                                value={draft.text}
                                onChange={(e) =>
                                  setReviewDrafts((prev) => ({
                                    ...prev,
                                    [it.title]: { ...(prev[it.title] || { rating: 5, text: "" }), text: e.target.value },
                                  }))
                                }
                                rows={3}
                                placeholder="Food kaisa laga? (optional)"
                                className="mt-2 w-full rounded-xl border border-[#dccbbb] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#b84a2b]"
                              />
                            </label>
                          </div>

                          <button
                            type="button"
                            disabled={reviewSubmitting}
                            onClick={async () => {
                              setReviewSubmitting(true);
                              setReviewFeedback("");
                              try {
                                await submitMyReview({
                                  orderId: order._id,
                                  productTitle: it.title,
                                  productImageUrl: it.imageUrl || "",
                                  rating: draft.rating,
                                  reviewText: draft.text,
                                });
                                const data = await fetchMyPendingReviewItems();
                                const pending = Array.isArray(data.pending) ? data.pending : [];
                                const forThisOrder = pending.filter((p) => String(p.orderId) === String(order._id));
                                setReviewItems(forThisOrder);
                                setReviewFeedback("Review submitted. Thank you!");
                              } catch (e) {
                                setReviewFeedback(e instanceof Error ? e.message : "Unable to submit review.");
                              } finally {
                                setReviewSubmitting(false);
                              }
                            }}
                            className="mt-3 inline-flex w-full items-center justify-center rounded-xl bg-[#5b2d17] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-55"
                          >
                            Submit review
                          </button>
                        </div>
                      );
                    })}
                    {reviewFeedback ? <p className="text-sm text-[#7a3f22]">{reviewFeedback}</p> : null}
                  </div>
                )}
              </section>
            ) : null}
          </div>
        ) : null}
      </section>
    </main>
  );
}

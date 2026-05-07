"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { API_BASE_URL, getAdminToken } from "@/lib/admin-auth";

import ModernLoader from "@/components/ui/modern-loader";

import type { ProductReview } from "@/lib/reviews-client";

export default function AdminReviewsPage() {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const token = getAdminToken();
      const res = await fetch(`${API_BASE_URL}/reviews/admin?q=${encodeURIComponent(q)}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Unable to load reviews.");
      setReviews(Array.isArray(data.reviews) ? data.reviews : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load reviews.");
      setReviews([]);
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const count = reviews.length;
    const avg = count ? reviews.reduce((s, r) => s + (Number(r.rating) || 0), 0) / count : 0;
    return { count, avg };
  }, [reviews]);

  return (
    <main className="-m-4 flex h-[calc(100vh-64px)] flex-col overflow-hidden bg-white sm:-m-6 sm:h-[calc(100vh-74px)]">
      <section className="shrink-0 border-b border-[#e4d5c7] bg-white p-3 sm:p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-[#1c130e]">Reviews</p>
            <p className="text-xs text-[#6f5647]">
              {stats.count} review{stats.count === 1 ? "" : "s"} · Avg {stats.avg.toFixed(1)}
            </p>
          </div>
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, orderId, product..."
              className="w-full rounded-xl border border-[#dccbbb] px-3 py-2 text-sm outline-none focus:border-[#b84a2b] sm:w-[280px]"
            />
            <button
              type="button"
              onClick={() => void load()}
              className="rounded-xl border border-[#dccbbb] bg-[#fffaf4] px-3 py-2 text-xs font-semibold text-[#5b2d17] sm:text-sm"
            >
              Search
            </button>
          </div>
        </div>
      </section>

      <section className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {loading ? <ModernLoader label="Loading reviews..." /> : null}
        {error ? <p className="mb-2 text-sm text-red-600">{error}</p> : null}

        {!loading && !error && reviews.length === 0 ? (
          <p className="text-sm text-[#6f5647]">No reviews yet.</p>
        ) : null}

        {!loading && reviews.length > 0 ? (
          <div className="space-y-2 sm:space-y-3">
            {reviews.map((r) => (
              <article key={r._id} className="rounded-2xl border border-[#e4d5c7] bg-[#fffaf4] p-2.5 sm:p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-white sm:h-12 sm:w-12">
                      {r.productImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.productImageUrl} alt={r.productTitle} className="h-full w-full object-cover" />
                      ) : null}
                    </div>
                    <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-[#1c130e] sm:text-sm">{r.customerName}</p>
                    <p className="truncate text-[11px] text-[#6f5647]">Order: {r.orderId}</p>
                    <p className="truncate text-[11px] text-[#6f5647]">Product: {r.productTitle}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-[#5b2d17]">
                      ★ {r.rating.toFixed(1)}
                    </span>
                  </div>
                </div>
                {r.reviewText ? <p className="mt-1.5 whitespace-pre-wrap text-xs text-[#6f5647] sm:text-sm">{r.reviewText}</p> : null}
                <p className="mt-1.5 text-[10px] text-[#8a6f5e]">
                  {new Date(r.createdAt).toLocaleString([], { year: "numeric", month: "short", day: "2-digit" })}
                </p>
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </main>
  );
}


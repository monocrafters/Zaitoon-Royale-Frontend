"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, ShoppingCart } from "lucide-react";

import { API_BASE_URL } from "@/lib/admin-auth";
import { addItemToCart } from "@/lib/cart-client";
import SiteHeader from "@/components/public/site-header";
import ModernLoader from "@/components/ui/modern-loader";
import { readSessionCache, writeSessionCache } from "@/lib/session-cache";
import { useCustomerSession } from "@/lib/customer-auth";
import {
  fetchMyPendingReviewItems,
  fetchProductReviewsByTitle,
  fetchPublicReviewSummariesByTitles,
  submitMyReview,
  type PendingReviewItem,
  type ProductReview,
  type ProductReviewSummary,
} from "@/lib/reviews-client";

type Product = {
  _id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  price?: number;
  hasSizePricing?: boolean;
  sizePrices?: {
    small?: number;
    medium?: number;
    large?: number;
    xlarge?: number;
  };
  badge?:
    | ""
    | "Trending"
    | "Most Ordered"
    | "Best Seller"
    | "New Arrival"
    | "Chef's Special"
    | "Limited Deal";
  category?: { name?: string };
};

const getDisplayPrice = (p: Product, size: "small" | "medium" | "large" | "xlarge" = "medium") => {
  if (p.hasSizePricing) return Number(p.sizePrices?.[size]) || Number(p.price) || 0;
  return Number(p.price) || 0;
};

const getBadgePill = (badge?: Product["badge"]) => {
  const normalized = (badge || "").trim();
  if (!normalized) return { label: "", className: "" };

  const lower = normalized.toLowerCase();
  if (lower.includes("best")) return { label: normalized, className: "bg-[#1f7a3a]" };
  if (lower.includes("most")) return { label: normalized, className: "bg-[#b84a2b]" };
  if (lower.includes("trend")) return { label: normalized, className: "bg-[#e07a2f]" };
  if (lower.includes("new arrival")) return { label: normalized, className: "bg-[#5b2d17]" };
  if (lower.includes("chef")) return { label: normalized, className: "bg-[#7a3f22]" };
  if (lower.includes("limited")) return { label: normalized, className: "bg-[#ff4d4d]" };

  return { label: normalized, className: "bg-[#5b2d17]" };
};

export default function PublicProductDetailsPage() {
  const params = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [product, setProduct] = useState<Product | null>(null);
  const [related, setRelated] = useState<Product[]>([]);
  const [selectedSize, setSelectedSize] = useState<"small" | "medium" | "large" | "xlarge">("medium");
  const relatedStripRef = useRef<HTMLDivElement | null>(null);
  const { hasSession } = useCustomerSession();

  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [relatedReviewMap, setRelatedReviewMap] = useState<Record<string, ProductReviewSummary>>({});
  const [reviewMeta, setReviewMeta] = useState<{ count: number; avgRating: number }>({ count: 0, avgRating: 0 });
  const [pendingItems, setPendingItems] = useState<PendingReviewItem[]>([]);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  const id = useMemo(() => params?.id || "", [params?.id]);

  const eligiblePendingItem = useMemo(() => {
    if (!product?.name) return null;
    return pendingItems.find((p) => p.title === product.name) || null;
  }, [pendingItems, product?.name]);

  const canReview = Boolean(hasSession && eligiblePendingItem);

  const onSubmitReview = async () => {
    if (!product?.name || !eligiblePendingItem) return;
    if (reviewSubmitting) return;
    setReviewSubmitting(true);
    try {
      await submitMyReview({
        orderId: eligiblePendingItem.orderId,
        productTitle: product.name,
        productId: product._id,
        productImageUrl: product.imageUrl || "",
        rating: reviewRating,
        reviewText,
      });
      setReviewText("");
      setReviewRating(5);
      const data = await fetchMyPendingReviewItems();
      setPendingItems(Array.isArray(data.pending) ? data.pending : []);
      const updated = await fetchProductReviewsByTitle(product.name);
      setReviews(Array.isArray(updated.reviews) ? updated.reviews : []);
      setReviewMeta(updated.meta || { count: 0, avgRating: 0 });
    } catch {
      // keep it silent to avoid breaking UI; errors can be shown by alerts if needed later
    } finally {
      setReviewSubmitting(false);
    }
  };

  useEffect(() => {
    if (!hasSession) return;
    let cancelled = false;
    const run = async () => {
      try {
        const data = await fetchMyPendingReviewItems();
        if (!cancelled) setPendingItems(Array.isArray(data.pending) ? data.pending : []);
      } catch {
        if (!cancelled) setPendingItems([]);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [hasSession]);

  useEffect(() => {
    const load = async () => {
      setError("");
      try {
        const CACHE_TTL_MS = 2 * 60 * 1000;
        const CACHE_KEY = `restaurant_product_detail_${id}`;
        const cached = readSessionCache<{ product: Product | null; related: Product[] }>(CACHE_KEY, CACHE_TTL_MS);
        const hadCache = Boolean(cached?.product?._id);
        if (cached) {
          setProduct(cached.product);
          setRelated(cached.related || []);
          setSelectedSize("medium");
          setLoading(false);
        } else {
          setLoading(true);
        }

        const res = await fetch(`${API_BASE_URL}/products/public/${id}`, { cache: "no-store" });
        const payload = await res.json();
        if (!res.ok) {
          if (hadCache) return;
          throw new Error(payload.message || "Unable to load product.");
        }
        const loaded = payload.product as Product;
        setProduct(loaded);
        setSelectedSize("medium");
        try {
          const relRes = await fetch(`${API_BASE_URL}/products/public`, { cache: "no-store" });
          const relPayload = await relRes.json();
          const allProducts: Product[] = relPayload.products || [];
          const relatedProducts = allProducts
            .filter((p) => p._id !== loaded._id && p.category?.name === loaded.category?.name)
            .slice(0, 4);
          setRelated(relatedProducts);
          try {
            const summaries = await fetchPublicReviewSummariesByTitles(relatedProducts.map((p) => p.name));
            const map: Record<string, ProductReviewSummary> = {};
            for (const s of summaries.summaries || []) map[s.productTitle] = s;
            setRelatedReviewMap(map);
          } catch {
            setRelatedReviewMap({});
          }
          writeSessionCache(CACHE_KEY, { product: loaded, related: relatedProducts });
        } catch {
          setRelated([]);
          writeSessionCache(CACHE_KEY, { product: loaded, related: [] });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load product.");
      } finally {
        setLoading(false);
      }
    };

    if (id) load();
  }, [id]);

  useEffect(() => {
    if (!product?.name) return;
    let cancelled = false;
    const run = async () => {
      try {
        const data = await fetchProductReviewsByTitle(product.name);
        if (cancelled) return;
        setReviews(Array.isArray(data.reviews) ? data.reviews : []);
        setReviewMeta(data.meta || { count: 0, avgRating: 0 });
      } catch {
        if (cancelled) return;
        setReviews([]);
        setReviewMeta({ count: 0, avgRating: 0 });
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [product?.name]);

  if (loading) {
    return (
      <main className="bg-[#f5efe8] text-[#2f1c12]">
        <SiteHeader />
        <div className="mx-auto max-w-7xl px-4 pb-10 pt-[96px] sm:px-6">
          <ModernLoader label="Loading product..." />
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="bg-[#f5efe8] text-[#2f1c12]">
        <SiteHeader />
        <div className="mx-auto max-w-7xl px-4 pb-10 pt-[96px] sm:px-6">
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
        </div>
      </main>
    );
  }

  return (
    <main className="bg-[#f5efe8] text-[#2f1c12]">
      <SiteHeader />
      <div className="mx-auto max-w-7xl px-4 pb-12 pt-[96px] sm:px-6">
        <div className="mt-0 grid gap-8 lg:grid-cols-[1fr_1fr] lg:items-center">
          <div className="relative flex h-[320px] items-center justify-center overflow-hidden bg-transparent sm:h-[450px]">
            {product?.imageUrl ? (
              <Image src={product.imageUrl} alt={product.name} fill className="object-contain" unoptimized />
            ) : (
              <div className="text-sm text-[#6b625a]">No image</div>
            )}
          </div>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
            <p className="text-sm font-medium uppercase tracking-wide text-[#7d6b5d]">{product?.category?.name || "Category"}</p>
            <h1 className="mt-2 font-[family-name:var(--font-poppins)] text-4xl font-semibold leading-tight text-[#111] sm:text-5xl">
              {product?.name}
            </h1>
            <p className="mt-4 text-sm leading-7 text-[#6b625a] sm:text-base">{product?.description || "—"}</p>

            {product?.hasSizePricing ? (
              <div className="mt-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#7d6b5d]">Select size</p>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                  {(["small", "medium", "large", "xlarge"] as const).map((sizeKey) => {
                    const val = getDisplayPrice(product, sizeKey);
                    return (
                      <button
                        key={sizeKey}
                        type="button"
                        onClick={() => setSelectedSize(sizeKey)}
                        className={[
                          "rounded-xl border px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide transition sm:px-3 sm:text-xs",
                          selectedSize === sizeKey
                            ? "border-[#5b2d17] bg-[#5b2d17] text-white"
                            : "border-[#eadccf] bg-white text-[#5b2d17] hover:bg-[#f4efe8]",
                        ].join(" ")}
                      >
                        {sizeKey} - PKR {val}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div className="mt-5 flex items-center gap-3">
              <span className="text-4xl font-semibold text-[#b84a2b]">
                PKR {product ? getDisplayPrice(product, selectedSize) : 0}
              </span>
            </div>

            <div className="mt-7 grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:gap-3">
              <Link
                href="/checkout"
                className="inline-flex items-center justify-center rounded-xl bg-[#5b2d17] px-3 py-2 text-xs font-semibold text-white hover:brightness-[1.03] sm:px-6 sm:py-3 sm:text-sm"
              >
                Order Now
              </Link>
              <button
                type="button"
                onClick={async (event) => {
                  if (!product?._id) return;
                  await addItemToCart(product._id, product.hasSizePricing ? selectedSize : "", 1, event.currentTarget);
                }}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#111] px-3 py-2 text-xs font-semibold text-white hover:bg-black sm:px-6 sm:py-3 sm:text-sm"
              >
                <ShoppingCart className="h-4 w-4" />
                Add to Cart
              </button>
              <a
                href="https://wa.me/923001234567"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center rounded-xl border border-black/15 bg-white px-3 py-2 text-xs font-semibold text-[#111] hover:bg-[#f4efe8] sm:px-6 sm:py-3 sm:text-sm"
              >
                WhatsApp Order
              </a>
            </div>
          </motion.div>
        </div>

        <section className="relative left-1/2 mt-14 w-screen -translate-x-1/2">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
            <h2 className="font-[family-name:var(--font-poppins)] text-2xl font-semibold text-[#111]">Related Items</h2>
            <div className="hidden items-center gap-2 lg:flex">
              <button
                type="button"
                onClick={() => relatedStripRef.current?.scrollBy({ left: -360, behavior: "smooth" })}
                className="rounded-xl border border-[#eadccf] bg-white p-2 text-[#5b2d17] hover:bg-[#f4efe8]"
                aria-label="Scroll related products left"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => relatedStripRef.current?.scrollBy({ left: 360, behavior: "smooth" })}
                className="rounded-xl border border-[#eadccf] bg-white p-2 text-[#5b2d17] hover:bg-[#f4efe8]"
                aria-label="Scroll related products right"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
          {related.length === 0 ? (
            <div className="mx-auto mt-3 max-w-7xl px-4 sm:px-6">
              <p className="text-sm text-[#6f5647]">No related products found yet.</p>
            </div>
          ) : (
            <div
              ref={relatedStripRef}
              className="hero-thumb-strip hide-scrollbar mt-5 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-4 pr-0 pt-2 scroll-pl-5 sm:mx-auto sm:max-w-7xl sm:scroll-pl-0 sm:px-6 sm:pt-0"
            >
              {related.map((item, idx) => {
                const badgePill = getBadgePill(item.badge);
                const showBadge = Boolean(badgePill.label);
                const summary = relatedReviewMap[item.name];
                return (
                <Link
                  key={item._id}
                  href={`/product/${item._id}`}
                  className={[
                    "snap-start w-[190px] shrink-0 overflow-hidden rounded-3xl border border-[#eadccf] bg-gradient-to-b from-[#fff7ea] via-white to-[#f6ece2] p-3 transition hover:brightness-[1.01] lg:w-[255px]",
                    idx === 0 ? "ml-5 sm:ml-0" : "",
                  ].join(" ")}
                >
                  <div className="relative overflow-hidden rounded-2xl border border-white/70 bg-white/60">
                    <div className="relative h-32 lg:h-36">
                      {item.imageUrl ? <Image src={item.imageUrl} alt={item.name} fill className="object-cover" unoptimized /> : null}
                    </div>
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />
                    {showBadge ? (
                      <span
                        className={[
                          "absolute left-2 top-2 z-10 rounded-full px-2 py-1 text-[10px] font-semibold text-white",
                          badgePill.className,
                        ].join(" ")}
                      >
                        {badgePill.label}
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-3 line-clamp-1 font-[family-name:var(--font-poppins)] text-[14px] font-semibold text-[#24130c]">
                    {item.name}
                  </p>
                  <p className="mt-1 line-clamp-2 text-left text-[12px] leading-4 text-[#6f5647]">
                    {item.description || ""}
                  </p>
                  <div className="mt-2 flex items-center gap-1">
                    <span className="text-[10px] leading-none text-[#ffb347]">★★★★★</span>
                    <span className="text-[10px] font-semibold text-[#6f5647]">
                      ({Number(summary?.avgRating || 0).toFixed(1)}) · {Number(summary?.count || 0)} reviews
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-[#5b2d17] whitespace-nowrap">PKR {getDisplayPrice(item, "medium")}</p>
                    <span className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-br from-[#5b2d17] to-[#8b3f1c] px-2 py-1 text-white whitespace-nowrap leading-none sm:px-3 sm:py-1.5">
                      <ShoppingCart className="h-4 w-4" />
                      <span className="ml-1 text-[10px] font-semibold leading-none sm:text-xs">Add</span>
                    </span>
                  </div>
                </Link>
              );
              })}
            </div>
          )}
        </section>

        <section className="mt-14">
          <h2 className="font-[family-name:var(--font-poppins)] text-2xl font-semibold text-[#111]">Reviews</h2>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="rounded-full bg-[#fffaf4] px-3 py-1 text-sm font-semibold text-[#5b2d17]">
              ★ {reviewMeta.avgRating.toFixed(1)} <span className="text-[#6f5647] font-medium">({reviewMeta.count})</span>
            </div>
            {canReview ? (
              <div className="rounded-full bg-[#fffaf4] px-3 py-1 text-sm font-semibold text-[#5b2d17]">
                Delivered review is available
              </div>
            ) : null}
          </div>

          {canReview ? (
            <div className="mt-6 rounded-3xl border border-[#eadccf] bg-white p-5">
              <p className="text-sm font-semibold text-[#2f1c12]">Write a review</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr]">
                <label className="sm:col-span-1">
                  <span className="block text-xs font-semibold uppercase tracking-wide text-[#7d6b5d]">Rating</span>
                  <select
                    value={reviewRating}
                    onChange={(e) => setReviewRating(Number(e.target.value))}
                    className="mt-2 w-full rounded-xl border border-[#dccbbb] bg-white px-3 py-2 text-sm outline-none focus:border-[#b84a2b]"
                  >
                    {[5, 4, 3, 2, 1].map((v) => (
                      <option key={v} value={v}>
                        {v} Stars
                      </option>
                    ))}
                  </select>
                </label>
                <label className="sm:col-span-1">
                  <span className="block text-xs font-semibold uppercase tracking-wide text-[#7d6b5d]">Order</span>
                  <div className="mt-2 rounded-xl border border-[#eadccf] bg-[#fffaf4] px-3 py-2 text-sm text-[#6f5647]">
                    {eligiblePendingItem?.orderId}
                  </div>
                </label>
              </div>
              <label className="mt-3 block">
                <span className="block text-xs font-semibold uppercase tracking-wide text-[#7d6b5d]">Review</span>
                <textarea
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  rows={3}
                  placeholder="Food kaisa laga? (optional)"
                  className="mt-2 w-full rounded-xl border border-[#dccbbb] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#b84a2b]"
                />
              </label>
              <button
                type="button"
                onClick={() => void onSubmitReview()}
                disabled={reviewSubmitting}
                className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-[#5b2d17] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-55"
              >
                {reviewSubmitting ? "Submitting..." : "Submit review"}
              </button>
            </div>
          ) : null}

          <div className="mt-7 grid gap-4 md:grid-cols-3">
            {reviews.length === 0 ? (
              <div className="md:col-span-3 rounded-2xl border border-dashed border-[#dccbbb] bg-[#fffaf4] p-6 text-sm text-[#6f5647]">
                No reviews yet for this product.
              </div>
            ) : (
              reviews.map((r) => (
                <article key={r._id} className="rounded-3xl border border-[#eadccf] bg-white p-5">
                  <div className="mb-3 flex items-center gap-3">
                    <div className="relative h-10 w-10 overflow-hidden rounded-full bg-[#fffaf4]">
                      {r.productImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.productImageUrl} alt={r.productTitle} className="h-full w-full object-cover" />
                      ) : null}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#2f1c12]">{r.customerName}</p>
                      <p className="text-xs text-[#8b8178]">{r.productTitle}</p>
                    </div>
                  </div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#7d6b5d]">
                    ★★★★★ ({Number(r.rating).toFixed(1)})
                  </p>
                  {r.reviewText ? <p className="mt-2 text-sm leading-7 text-[#6f5647]">{r.reviewText}</p> : null}
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}


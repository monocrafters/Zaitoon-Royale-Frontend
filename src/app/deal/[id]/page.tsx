"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Clock3, ShoppingCart } from "lucide-react";

import { API_BASE_URL } from "@/lib/admin-auth";
import { addDealToCart } from "@/lib/cart-client";
import { fetchPublicReviewSummariesByTitles, type ProductReviewSummary } from "@/lib/reviews-client";
import SiteHeader from "@/components/public/site-header";
import ModernLoader from "@/components/ui/modern-loader";
import { readSessionCache, writeSessionCache } from "@/lib/session-cache";

type DealDetail = {
  _id: string;
  title: string;
  subtitle?: string;
  description?: string;
  badge?: string;
  discountType?: "percent" | "flat" | "none";
  discountValue?: number;
  couponCode?: string;
  imageUrl?: string;
  startsAt?: string | null;
  endsAt?: string | null;
  theme?: "warm" | "dark" | "green" | "purple" | "blue";
  ctaLabel?: string;
  items?: Array<{
    product: {
      _id: string;
      name: string;
      price?: number;
      imageUrl?: string;
      description?: string;
      hasSizePricing?: boolean;
      sizePrices?: { small?: number; medium?: number; large?: number; xlarge?: number };
    };
    qty: number;
    size?: "small" | "medium" | "large" | "xlarge" | "";
  }>;
  products?: Array<{
    _id: string;
    name: string;
    price?: number;
    imageUrl?: string;
    description?: string;
  }>;
  pricing?: { originalPrice: number; finalPrice: number };
};

function formatDealCountdown(endIso: string | null | undefined) {
  if (!endIso) return null;
  const end = new Date(endIso).getTime();
  const ms = end - Date.now();
  if (ms <= 0) return { hours: "00", minutes: "00", seconds: "00", ended: true };
  const totalSeconds = Math.floor(ms / 1000);
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return { hours, minutes, seconds, ended: false };
}

export default function DealDetailPage() {
  const router = useRouter();
  const params = useParams<{ id?: string }>();
  const dealId = String(params?.id || "");
  const [deal, setDeal] = useState<DealDetail | null>(null);
  const [allDeals, setAllDeals] = useState<DealDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);
  const relatedStripRef = useRef<HTMLDivElement | null>(null);
  const [reviewMap, setReviewMap] = useState<Record<string, ProductReviewSummary>>({});

  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const load = async () => {
      setError("");
      try {
        if (!dealId || dealId === "undefined" || dealId === "null") {
          throw new Error("Deal not found.");
        }
        const CACHE_TTL_MS = 2 * 60 * 1000;
        const CACHE_KEY = `restaurant_deal_detail_${dealId}`;
        const cached = readSessionCache<DealDetail | null>(CACHE_KEY, CACHE_TTL_MS);
        const hadCache = Boolean(cached?._id);
        if (cached) {
          setDeal(cached);
          setLoading(false);
        } else {
          setLoading(true);
        }

        const [detailRes, listRes] = await Promise.all([
          fetch(`${API_BASE_URL}/deals/public/${dealId}`, { cache: "no-store" }),
          fetch(`${API_BASE_URL}/deals/public`, { cache: "no-store" }),
        ]);
        const [payload, listPayload] = await Promise.all([detailRes.json(), listRes.json()]);
        if (!detailRes.ok) {
          if (hadCache) return;
          throw new Error(payload.message || "Unable to load deal.");
        }
        setDeal(payload.deal || null);
        writeSessionCache(CACHE_KEY, payload.deal || null);
        if (listRes.ok) {
          setAllDeals(listPayload.deals || []);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unable to load deal.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [dealId]);

  const countdown = useMemo(() => {
    void tick;
    return formatDealCountdown(deal?.endsAt || null);
  }, [deal?.endsAt, tick]);

  useEffect(() => {
    if (!loading && (error || !deal)) {
      router.replace("/offers");
    }
  }, [loading, error, deal, router]);

  if (loading) {
    return (
      <main className="bg-[#f5efe8] antialiased">
        <SiteHeader />
        <div className="mx-auto max-w-5xl px-4 py-10 pt-[96px] sm:px-6">
          <ModernLoader label="Loading deal..." />
        </div>
      </main>
    );
  }

  if (error || !deal) {
    return (
      <main className="bg-[#f5efe8] antialiased">
        <SiteHeader />
        <div className="mx-auto max-w-5xl px-4 py-10 pt-[96px] sm:px-6">
          <ModernLoader label="Loading deal..." />
        </div>
      </main>
    );
  }

  const imageSrc = deal.imageUrl || deal.items?.[0]?.product?.imageUrl || deal.products?.[0]?.imageUrl || "";
  const getUnit = (it: NonNullable<DealDetail["items"]>[number]) => {
    const base = Number(it.product?.price) || 0;
    if (!it.product?.hasSizePricing) return base;
    const size = String(it.size || "medium").trim() as "small" | "medium" | "large" | "xlarge";
    const pick = (k: "small" | "medium" | "large" | "xlarge") => Number(it.product?.sizePrices?.[k]) || 0;
    const v = pick(size);
    if (v > 0) return v;
    const mid = pick("medium");
    return mid > 0 ? mid : base;
  };

  const computedOriginal =
    deal.items?.reduce((s, it) => s + getUnit(it) * Math.max(1, Number(it.qty) || 1), 0) ??
    deal.products?.reduce((s, p) => s + (Number(p.price) || 0), 0) ??
    0;
  const original = deal.pricing?.originalPrice ?? computedOriginal;
  const final = deal.pricing?.finalPrice ?? original;
  const relatedDeals = useMemo(
    () => allDeals.filter((d) => d._id !== (deal?._id || "")).slice(0, 4),
    [allDeals, deal?._id]
  );
  const getDealProductsLine = (d?: DealDetail | null) => {
    if (!d) return "";
    const items = Array.isArray(d.items) ? d.items : [];
    if (items.length) {
      return items
        .map((it) => {
          const qty = Math.max(1, Number(it.qty) || 1);
          const raw = String(it.size || "").trim();
          const size = raw ? `${raw[0].toUpperCase()}${raw.slice(1)} ` : "";
          return `${qty}x ${size}${it.product?.name || ""}`.trim();
        })
        .filter(Boolean)
        .join(" • ");
    }
    const old = Array.isArray(d.products) ? d.products : [];
    return old.map((p) => `1x ${p.name}`).filter(Boolean).join(" • ");
  };

  useEffect(() => {
    const titles = new Set<string>();
    const collect = (d?: DealDetail | null) => {
      if (!d) return;
      for (const it of d.items || []) {
        const n = String(it?.product?.name || "").trim();
        if (n) titles.add(n);
      }
      for (const p of d.products || []) {
        const n = String(p?.name || "").trim();
        if (n) titles.add(n);
      }
    };
    collect(deal);
    for (const d of relatedDeals) collect(d);
    if (!titles.size) return;
    let cancelled = false;
    const run = async () => {
      try {
        const data = await fetchPublicReviewSummariesByTitles(Array.from(titles));
        if (cancelled) return;
        const map: Record<string, ProductReviewSummary> = {};
        for (const s of data.summaries || []) map[s.productTitle] = s;
        setReviewMap(map);
      } catch {
        if (!cancelled) setReviewMap({});
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [deal, relatedDeals]);

  const getDealReviewMeta = (d?: DealDetail | null) => {
    if (!d) return { avgRating: 0, count: 0, orderCount: 0, latestReviewText: "", latestCustomerName: "" };
    const names: string[] = [];
    for (const it of d.items || []) {
      const n = String(it?.product?.name || "").trim();
      if (n) names.push(n);
    }
    for (const p of d.products || []) {
      const n = String(p?.name || "").trim();
      if (n) names.push(n);
    }
    const summaries = names.map((n) => reviewMap[n]).filter(Boolean) as ProductReviewSummary[];
    if (!summaries.length) return { avgRating: 0, count: 0, orderCount: 0, latestReviewText: "", latestCustomerName: "" };
    const total = summaries.reduce((s, x) => s + (Number(x.count) || 0), 0);
    const orderCount = summaries.reduce((s, x) => s + (Number(x.orderCount) || 0), 0);
    const avg = total
      ? summaries.reduce((s, x) => s + (Number(x.avgRating) || 0) * (Number(x.count) || 0), 0) / total
      : 0;
    return {
      avgRating: avg,
      count: total,
      orderCount,
      latestReviewText: summaries[0]?.latestReviewText || "",
      latestCustomerName: summaries[0]?.latestCustomerName || "Customer",
    };
  };

  return (
    <main className="bg-[#f5efe8] text-[#2f1c12] antialiased">
      <SiteHeader />
      <section className="px-0 pb-8 pt-[56px] sm:mx-auto sm:max-w-5xl sm:px-6 sm:pt-[96px]">
        <div className="overflow-hidden border-y border-[#eadccf] bg-white shadow-[0_18px_55px_rgba(47,28,18,0.08)] sm:rounded-3xl sm:border">
          <div className="relative h-[240px] bg-gradient-to-br from-[#5b2d17] via-[#7a3f22] to-[#b0612f] sm:h-[320px]">
            {imageSrc ? (
              <Image src={imageSrc} alt={deal.title} fill className="object-cover opacity-65" unoptimized />
            ) : null}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/15 to-transparent" />

            <div className="absolute bottom-5 left-5 right-5">
              <div className="flex flex-wrap items-center gap-2">
                {deal.badge ? (
                  <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
                    {deal.badge}
                  </span>
                ) : null}
                {deal.discountType && deal.discountType !== "none" ? (
                  <span className="rounded-full bg-black/40 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
                    {deal.discountType === "percent"
                      ? `${deal.discountValue || 0}% OFF`
                      : `PKR ${deal.discountValue || 0} OFF`}
                  </span>
                ) : null}
                {deal.couponCode ? (
                  <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
                    Code: {deal.couponCode}
                  </span>
                ) : null}
              </div>

              <h1 className="mt-3 font-[family-name:var(--font-poppins)] text-2xl font-semibold text-white sm:text-4xl">
                {deal.title}
              </h1>
              <p className="mt-2 max-w-2xl line-clamp-3 text-sm text-white/90 sm:text-base">{deal.description || ""}</p>
              {countdown ? (
                <div className="mt-2 inline-flex items-center gap-1 rounded-xl border border-white/35 bg-black/30 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">
                  <Clock3 className="h-3.5 w-3.5" />
                  {countdown.ended ? "00:00:00" : `${countdown.hours}:${countdown.minutes}:${countdown.seconds}`}
                </div>
              ) : null}
            </div>
          </div>

          <div className="p-4 sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-[#6f5647]">Deal price</p>
                <p className="mt-1 font-[family-name:var(--font-poppins)] text-2xl font-semibold text-[#b84a2b] sm:text-3xl">
                  PKR {final}
                </p>
                <p className="text-xs text-[#6f5647]">
                  <span className="line-through">PKR {original}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={async (event) => {
                  await addDealToCart(deal._id, 1, event.currentTarget, {
                    title: deal.title,
                    imageUrl: imageSrc,
                    unitPrice: final,
                  });
                }}
                className="inline-flex w-[52%] items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-[#5b2d17] to-[#8b3f1c] px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-[1.03] sm:w-auto sm:px-5 sm:py-3"
              >
                <ShoppingCart className="h-5 w-5" />
                Add to Cart
              </button>
            </div>

            <div className="mt-5">
              <p className="text-xs font-medium uppercase tracking-wide text-[#6f5647]">Included products</p>
              {deal.items?.length ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {deal.items.slice(0, 6).map((it) => {
                    const qty = Math.max(1, Number(it.qty) || 1);
                    const size = String(it.size || "").trim();
                    const label = size ? `${size} ${it.product.name}` : it.product.name;
                    return (
                    <Link
                      key={`${it.product._id}-${it.qty}`}
                      href={`/product/${it.product._id}`}
                      className="flex items-center gap-3 rounded-2xl border border-[#eadccf] bg-white px-4 py-3 transition hover:-translate-y-0.5"
                    >
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-[#eadccf] bg-[#fffaf4]">
                        {it.product?.imageUrl ? (
                          <Image src={it.product.imageUrl} alt={it.product.name} fill className="object-cover" unoptimized />
                        ) : null}
                      </div>
                      <div className="min-w-0">
                        <p className="line-clamp-1 font-[family-name:var(--font-poppins)] text-sm font-semibold text-[#111]">
                          {qty}x {label}
                        </p>
                        <p className="mt-1 text-xs text-[#6f5647]">PKR {getUnit(it)}</p>
                      </div>
                    </Link>
                    );
                  })}
                </div>
              ) : deal.products?.length ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {deal.products.slice(0, 6).map((p) => (
                    <Link
                      key={p._id}
                      href={`/product/${p._id}`}
                      className="flex items-center gap-3 rounded-2xl border border-[#eadccf] bg-white px-4 py-3 transition hover:-translate-y-0.5"
                    >
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-[#eadccf] bg-[#fffaf4]">
                        {p.imageUrl ? <Image src={p.imageUrl} alt={p.name} fill className="object-cover" unoptimized /> : null}
                      </div>
                      <div className="min-w-0">
                        <p className="line-clamp-1 font-[family-name:var(--font-poppins)] text-sm font-semibold text-[#111]">
                          1x {p.name}
                        </p>
                        <p className="mt-1 text-xs text-[#6f5647]">PKR {p.price ?? 0}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="mt-1 font-[family-name:var(--font-poppins)] text-lg font-semibold text-[#111]">—</p>
              )}
            </div>
          </div>
        </div>

        {relatedDeals.length ? (
          <section className="mt-6 px-4 sm:px-0">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-[family-name:var(--font-poppins)] text-2xl font-semibold text-[#1d140f]">Related Deals</h2>
              <div className="hidden items-center gap-2 lg:flex">
                <button
                  type="button"
                  onClick={() => relatedStripRef.current?.scrollBy({ left: -340, behavior: "smooth" })}
                  className="rounded-xl border border-[#eadccf] bg-white p-2 text-[#5b2d17] shadow-sm"
                  aria-label="Scroll related deals left"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => relatedStripRef.current?.scrollBy({ left: 340, behavior: "smooth" })}
                  className="rounded-xl border border-[#eadccf] bg-white p-2 text-[#5b2d17] shadow-sm"
                  aria-label="Scroll related deals right"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div
              ref={relatedStripRef}
              className="hide-scrollbar -mx-4 mt-3 flex gap-3 overflow-x-auto pb-1 pl-4 pr-0 sm:mx-0 sm:px-0"
            >
              {relatedDeals.map((d, idx) => {
                const dImg = d.imageUrl || d.items?.[0]?.product?.imageUrl || d.products?.[0]?.imageUrl || "";
                const dFinal = Number(d.pricing?.finalPrice) || 0;
                const dRating = getDealReviewMeta(d);
                const dCount = formatDealCountdown(d.endsAt || null);
                return (
                  <Link
                    key={d._id}
                    href={`/deal/${d._id}`}
                    className="w-[44vw] min-w-[44vw] overflow-hidden rounded-3xl border border-[#eadccf] bg-white p-3 transition hover:-translate-y-0.5 sm:w-[320px] sm:min-w-[320px] sm:min-h-[260px]"
                  >
                    <div className="relative h-32 overflow-hidden rounded-2xl border border-[#eadccf] bg-[#fffaf4] sm:h-40">
                      {dImg ? <Image src={dImg} alt={d.title} fill className="object-contain" unoptimized /> : null}
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm font-semibold text-[#2f1c12]">{d.title}</p>
                    <p className="mt-1 line-clamp-1 text-[11px] font-semibold text-[#7a3f22]">{getDealProductsLine(d)}</p>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-[#5b2d17]">PKR {dFinal}</p>
                      <p className="text-[11px] text-[#6f5647]">
                        {dCount?.ended ? "Ended" : `${dCount?.hours || "00"}:${dCount?.minutes || "00"}:${dCount?.seconds || "00"}`}
                      </p>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <span className="text-[12px] text-[#ffb347]">★★★★★</span>
                      <p className="text-[11px] text-[#6f5647]">({Number(dRating.avgRating || 0).toFixed(1)}) · {Number(dRating.orderCount || 0)} orders</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        ) : null}

        <section className="mt-6 px-4 sm:px-0">
          <h2 className="font-[family-name:var(--font-poppins)] text-2xl font-semibold text-[#1d140f]">Reviews</h2>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {(deal.items?.map((it) => it.product?.name).filter(Boolean) || []).slice(0, 3).map((name, idx) => {
              const s = reviewMap[String(name)] as ProductReviewSummary | undefined;
              return (
              <article key={`${name}-${idx}`} className="rounded-3xl border border-[#eadccf] bg-white p-4 shadow-[0_10px_24px_rgba(47,28,18,0.05)]">
                <p className="text-[12px] text-[#ffb347]">★★★★★</p>
                <p className="mt-1 text-xs font-semibold text-[#6f5647]">({Number(s?.avgRating || 0).toFixed(1)})</p>
                <p className="mt-2 text-sm text-[#2f1c12]">{s?.latestReviewText || "No review text yet."}</p>
                <p className="mt-3 text-xs font-semibold text-[#5b2d17]">{s?.latestCustomerName || "Customer"}</p>
              </article>
              );
            })}
          </div>
        </section>
      </section>
    </main>
  );
}


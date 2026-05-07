"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight, Clock3, Sparkles, Star } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import { API_BASE_URL } from "@/lib/admin-auth";
import SiteHeader from "@/components/public/site-header";
import ModernLoader from "@/components/ui/modern-loader";
import { fetchPublicReviewSummariesByTitles, type ProductReviewSummary } from "@/lib/reviews-client";
import { readSessionCache, writeSessionCache } from "@/lib/session-cache";

type Deal = {
  _id: string;
  title: string;
  imageUrl?: string;
  endsAt?: string | null;
  pricing?: { originalPrice: number; finalPrice: number };
  items?: Array<{ qty: number; size?: string; product: { _id: string; name: string } }>;
  products?: Array<{ _id: string; name: string }>;
};

const OFFERS_CACHE_KEY = "restaurant_offers_page_deals_cache_v2";
const OFFERS_TTL = 2 * 60 * 1000;

function formatCountdown(endIso: string | null | undefined) {
  if (!endIso) return null;
  const end = new Date(endIso).getTime();
  const ms = end - Date.now();
  if (ms <= 0) return { days: "00", hours: "00", minutes: "00", seconds: "00", ended: true };
  const totalSeconds = Math.floor(ms / 1000);
  const days = String(Math.floor(totalSeconds / 86400)).padStart(2, "0");
  const hours = String(Math.floor((totalSeconds % 86400) / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return { days, hours, minutes, seconds, ended: false };
}

function getProductsLine(deal?: Deal | null) {
  if (!deal) return "";
  const items = Array.isArray(deal.items) ? deal.items : [];
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
  const old = Array.isArray(deal.products) ? deal.products : [];
  return old.map((p) => p.name).filter(Boolean).join(" • ");
}

const shortTitle = (value: string, max = 20) => (value.length > max ? `${value.slice(0, max)}...` : value);

export default function OffersPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [reviewMap, setReviewMap] = useState<Record<string, ProductReviewSummary>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [index, setIndex] = useState(0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        setError("");
        const cached = readSessionCache<Deal[]>(OFFERS_CACHE_KEY, OFFERS_TTL);
        if (cached?.length) {
          setDeals(cached.filter((d) => d && d._id));
          setLoading(false);
        }

        const res = await fetch(`${API_BASE_URL}/deals/public`, { cache: "no-store" });
        const payload = await res.json();
        if (!res.ok) {
          if (cached?.length) return;
          throw new Error(payload.message || "Unable to load offers.");
        }
        const next = (payload.deals || []).filter((d: Deal) => d && d._id);
        setDeals(next);
        writeSessionCache(OFFERS_CACHE_KEY, next);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unable to load offers.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (!deals.length) return;
    // ~2s animation flow + ~5s stay
    const t = setInterval(() => setIndex((v) => (v + 1) % deals.length), 7000);
    return () => clearInterval(t);
  }, [deals.length]);

  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!deals.length) return;
    if (index > deals.length - 1) setIndex(0);
  }, [deals.length, index]);

  useEffect(() => {
    const titles = new Set<string>();
    for (const d of deals) {
      for (const it of d.items || []) {
        const n = String(it?.product?.name || "").trim();
        if (n) titles.add(n);
      }
      for (const p of d.products || []) {
        const n = String(p?.name || "").trim();
        if (n) titles.add(n);
      }
    }
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
  }, [deals]);

  const getDealReviewMeta = (deal?: Deal | null) => {
    if (!deal) return { avgRating: 0, count: 0, orderCount: 0, latestReviewText: "" };
    const names: string[] = [];
    for (const it of deal.items || []) {
      const n = String(it?.product?.name || "").trim();
      if (n) names.push(n);
    }
    for (const p of deal.products || []) {
      const n = String(p?.name || "").trim();
      if (n) names.push(n);
    }
    const summaries = names.map((n) => reviewMap[n]).filter(Boolean) as ProductReviewSummary[];
    if (!summaries.length) return { avgRating: 0, count: 0, orderCount: 0, latestReviewText: "" };
    const total = summaries.reduce((s, x) => s + (Number(x.count) || 0), 0);
    const orderCount = summaries.reduce((s, x) => s + (Number(x.orderCount) || 0), 0);
    if (!total) return { avgRating: 0, count: 0, orderCount, latestReviewText: summaries[0]?.latestReviewText || "" };
    const avg = summaries.reduce((s, x) => s + (Number(x.avgRating) || 0) * (Number(x.count) || 0), 0) / total;
    return { avgRating: avg, count: total, orderCount, latestReviewText: summaries[0]?.latestReviewText || "" };
  };

  const activeDeal = deals[index] || null;
  const activeCountdown = useMemo(() => {
    void tick;
    return formatCountdown(activeDeal?.endsAt);
  }, [activeDeal?.endsAt, tick]);
  const activeDealReview = useMemo(() => getDealReviewMeta(activeDeal), [activeDeal, reviewMap]);

  return (
    <main className="bg-[radial-gradient(circle_at_20%_0%,#fff7ef_0%,#f5efe8_40%,#f2e7da_100%)] text-[#2f1c12] antialiased">
      <SiteHeader />
      <section className="mx-auto max-w-7xl px-3 pb-10 pt-[72px] sm:px-6 sm:pt-[96px]">
        <div className="relative rounded-[2rem] bg-transparent p-0 sm:p-0">
          <div className="pointer-events-none absolute -right-10 -top-14 h-44 w-44 rounded-full bg-[#d78b58]/25 blur-3xl" />
          <div className="pointer-events-none absolute -left-12 bottom-0 h-40 w-40 rounded-full bg-[#8d3f1b]/12 blur-3xl" />

          <div className="relative hidden flex-wrap items-center justify-between gap-3 sm:flex">
            <div>
              <p className="inline-flex items-center gap-1 rounded-full border border-[#e4ccb8] bg-white/80 px-3 py-1 text-[11px] font-semibold text-[#7a3f22]">
                <Sparkles className="h-3.5 w-3.5" />
                Trending Offers
              </p>
              <h1 className="mt-2 font-[family-name:var(--font-poppins)] text-3xl font-semibold text-[#111] sm:text-4xl">
                Premium Deal Hub
              </h1>
              <p className="mt-1 text-sm text-[#6f5647]">Fresh combos, exclusive savings, modern offer experience.</p>
            </div>
            {deals.length > 1 ? (
              <div className="hidden items-center gap-2 sm:flex">
                <button
                  type="button"
                  onClick={() => setIndex((v) => (v - 1 + deals.length) % deals.length)}
                  className="rounded-xl border border-[#e2cdbd] bg-white/90 p-2 text-[#5b2d17] shadow-sm"
                  aria-label="Previous offer"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setIndex((v) => (v + 1) % deals.length)}
                  className="rounded-xl border border-[#e2cdbd] bg-white/90 p-2 text-[#5b2d17] shadow-sm"
                  aria-label="Next offer"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            ) : null}
          </div>
          <div className="relative flex items-center justify-between gap-2 sm:hidden">
            <div>
              <p className="inline-flex items-center gap-1 rounded-full border border-[#e4ccb8] bg-white/80 px-2 py-0.5 text-[10px] font-semibold text-[#7a3f22]">
                <Sparkles className="h-3 w-3" />
                Offers
              </p>
              <h1 className="mt-1 font-[family-name:var(--font-poppins)] text-lg font-semibold text-[#111]">Deal Hub</h1>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIndex((v) => (v - 1 + Math.max(1, deals.length)) % Math.max(1, deals.length))}
                className="rounded-lg border border-[#e2cdbd] bg-white p-1.5 text-[#5b2d17]"
                aria-label="Previous offer"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setIndex((v) => (v + 1) % Math.max(1, deals.length))}
                className="rounded-lg border border-[#e2cdbd] bg-white p-1.5 text-[#5b2d17]"
                aria-label="Next offer"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {error ? (
            <div className="relative mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
          ) : null}

          {loading ? (
            <div className="relative left-1/2 right-1/2 mt-[5px] flex h-[40vh] min-h-[220px] w-screen -translate-x-1/2 items-center justify-center bg-[#eaded2]">
              <ModernLoader label="Loading offers..." />
            </div>
          ) : activeDeal ? (
            <div className="relative left-1/2 right-1/2 mt-[5px] w-screen -translate-x-1/2 overflow-hidden bg-transparent sm:mt-5">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeDeal._id}
                  initial={{ opacity: 0, y: 14, scale: 0.99 }}
                  animate={{
                    opacity: [0, 1, 1, 1],
                    y: [14, 0, 0, 0],
                    scale: [0.99, 1, 1, 1],
                  }}
                  exit={{ opacity: 0, y: -14, scale: 0.995 }}
                  transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                  className="grid min-h-[22vh] grid-cols-[38%_62%] items-center gap-2 px-2 py-0.5 sm:min-h-[40vh] sm:gap-6 sm:px-10 sm:py-4"
                >
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, x: -14 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    transition={{ duration: 0.55, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
                    className="relative h-[22vh] min-h-[102px] max-h-[175px] overflow-hidden sm:h-[40vh] sm:min-h-[180px] sm:max-h-[320px]"
                  >
                    {activeDeal.imageUrl ? (
                      <Image src={activeDeal.imageUrl} alt={activeDeal.title} fill className="object-contain" unoptimized />
                    ) : null}
                  </motion.div>
                  <div className="min-w-0">
                    <motion.h2
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.45, delay: 0.2 }}
                      className="truncate font-[family-name:var(--font-poppins)] text-[14px] font-semibold text-[#1c130e] sm:line-clamp-2 sm:text-3xl"
                    >
                      <span className="sm:hidden">{shortTitle(activeDeal.title || "", 20)}</span>
                      <span className="hidden sm:inline">{activeDeal.title}</span>
                    </motion.h2>

                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.45, delay: 0.32 }}
                      className="mt-1 flex items-center justify-between gap-2 sm:mt-2 sm:block"
                    >
                      <div>
                        <p className="text-lg font-semibold text-[#5b2d17] sm:text-4xl">
                          PKR {Number(activeDeal.pricing?.finalPrice) || 0}
                        </p>
                        {Number(activeDeal.pricing?.originalPrice) ? (
                          <p className="hidden text-sm text-[#8a6f5e] line-through sm:block">
                            PKR {Number(activeDeal.pricing?.originalPrice) || 0}
                          </p>
                        ) : null}
                      </div>
                      <div className="-ml-[5px] mr-[5px] inline-flex rounded-xl border border-[#eadccf] bg-white px-2 py-1 text-[10px] font-semibold text-[#5b2d17] sm:ml-0 sm:mr-0 sm:mt-2 sm:rounded-2xl sm:px-3 sm:py-2 sm:text-xs">
                        <span className="inline-flex items-center gap-1">
                          <Clock3 className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                          {activeCountdown?.ended
                            ? "00:00:00"
                            : `${activeCountdown?.hours || "00"}:${activeCountdown?.minutes || "00"}:${activeCountdown?.seconds || "00"}`}
                        </span>
                      </div>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.45, delay: 0.56 }}
                      className="mt-1 flex flex-wrap items-center gap-2 sm:mt-2"
                    >
                      <p className="line-clamp-1 text-[10px] font-semibold text-[#7a3f22] sm:line-clamp-2 sm:text-sm">{getProductsLine(activeDeal)}</p>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.45, delay: 0.68 }}
                      className="mt-1 hidden flex-wrap items-center gap-2 sm:mt-2 sm:flex"
                    >
                      <span className="text-[#ffb347]">★★★★★</span>
                      <span className="text-xs font-semibold text-[#6f5647]">
                        ({Number(activeDealReview.avgRating || 0).toFixed(1)}) · {Number(activeDealReview.orderCount || 0)} orders
                      </span>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.45, delay: 0.8 }}
                      className="mt-1 flex flex-wrap gap-2 sm:mt-5"
                    >
                      <Link
                        href={`/deal/${activeDeal._id}`}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-[#5b2d17] to-[#8b3f1c] px-2 py-1.5 text-[10px] font-semibold !text-white transition hover:brightness-[1.05] sm:rounded-xl sm:px-4 sm:py-2 sm:text-sm"
                      >
                        Explore Deal
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </motion.div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          ) : null}
        </div>

        {!loading && deals.length ? (
          <section className="mt-7">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-[family-name:var(--font-poppins)] text-2xl font-semibold text-[#1c130e]">All Offers</h2>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {deals.map((deal) => {
                const cd = formatCountdown(deal.endsAt);
                const rating = getDealReviewMeta(deal);
                return (
                  <Link
                    key={deal._id}
                    href={`/deal/${deal._id}`}
                    className="relative overflow-hidden rounded-3xl border border-[#eadccf] bg-gradient-to-br from-white to-[#fff4e8] p-4 shadow-[0_10px_24px_rgba(47,28,18,0.07)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(47,28,18,0.12)]"
                  >
                    <div className="absolute inset-0 opacity-[0.06] [background-image:radial-gradient(circle_at_1px_1px,#7a3f22_1px,transparent_0)] [background-size:16px_16px]" />
                    <div className="relative flex items-start gap-3">
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-transparent">
                        {deal.imageUrl ? <Image src={deal.imageUrl} alt={deal.title} fill className="object-cover" unoptimized /> : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm font-semibold text-[#2f1c12]">{deal.title}</p>
                        <p className="mt-1 line-clamp-1 text-[11px] font-semibold text-[#7a3f22]">{getProductsLine(deal) || "—"}</p>
                      </div>
                    </div>
                    <div className="relative mt-3 flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-[#5b2d17]">PKR {Number(deal.pricing?.finalPrice) || 0}</p>
                      <p className="text-[11px] text-[#6f5647]">
                        {cd?.ended ? "Ended" : `${cd?.hours || "00"}:${cd?.minutes || "00"}:${cd?.seconds || "00"}`}
                      </p>
                    </div>
                    <div className="relative mt-1 flex items-center gap-1 text-[11px] text-[#6f5647]">
                      <Star className="h-3.5 w-3.5 fill-[#ffb347] text-[#ffb347]" />
                      <span>{Number(rating.avgRating || 0).toFixed(1)} · {Number(rating.orderCount || 0)} orders</span>
                    </div>
                    {rating.latestReviewText ? <p className="relative mt-1 line-clamp-1 text-[10px] text-[#8b8178]">"{rating.latestReviewText}"</p> : null}
                  </Link>
                );
              })}
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}


"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShoppingCart } from "lucide-react";

import { API_BASE_URL } from "@/lib/admin-auth";
import { addItemToCart } from "@/lib/cart-client";
import SiteHeader from "@/components/public/site-header";
import ModernLoader from "@/components/ui/modern-loader";
import { fetchPublicReviewSummariesByTitles, type ProductReviewSummary } from "@/lib/reviews-client";

type PublicProduct = {
  _id: string;
  name: string;
  price?: number;
  hasSizePricing?: boolean;
  sizePrices?: {
    small?: number;
    medium?: number;
    large?: number;
    xlarge?: number;
  };
  imageUrl?: string;
  description?: string;
  badge?:
    | ""
    | "Trending"
    | "Most Ordered"
    | "Best Seller"
    | "New Arrival"
    | "Chef's Special"
    | "Limited Deal";
};

const getProductCardPrice = (product: PublicProduct) => {
  if (product.hasSizePricing) return Number(product.sizePrices?.medium) || Number(product.price) || 0;
  return Number(product.price) || 0;
};

const shuffleArray = <T,>(arr: T[]) => {
  const next = [...arr];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
};

function getBadgePill(badge?: PublicProduct["badge"]) {
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
}

export default function AllProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<PublicProduct[]>([]);
  const [reviewSummaryByTitle, setReviewSummaryByTitle] = useState<Record<string, ProductReviewSummary>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/products/public`, { cache: "no-store" });
        const payload = await res.json();
        if (!res.ok) throw new Error(payload.message || "Unable to load products.");
        const raw = Array.isArray(payload.products) ? (payload.products as PublicProduct[]) : [];
        const shuffled = shuffleArray(raw);
        setProducts(shuffled);
        try {
          const summariesRes = await fetchPublicReviewSummariesByTitles(shuffled.map((p: PublicProduct) => p.name));
          const map: Record<string, ProductReviewSummary> = {};
          for (const s of summariesRes.summaries || []) map[s.productTitle] = s;
          setReviewSummaryByTitle(map);
        } catch {
          setReviewSummaryByTitle({});
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unable to load products.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <main className="bg-[#f5efe8] text-[#2f1c12] antialiased">
      <SiteHeader />
      <section className="mx-auto max-w-7xl px-4 pb-12 pt-[96px] sm:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-[family-name:var(--font-poppins)] text-3xl font-semibold text-[#111]">All Items</h1>
        </div>

        {loading ? <ModernLoader className="mt-6" label="Loading products..." /> : null}
        {error ? (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
        ) : null}

        {!loading && !error ? (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
            {products.map((item) => {
              const badgePill = getBadgePill(item.badge);
              const showBadge = Boolean(badgePill.label);
              const summary = reviewSummaryByTitle[item.name];
              return (
                <article
                  key={item._id}
                  role="button"
                  tabIndex={0}
                  onClick={() => router.push(`/product/${item._id}`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      router.push(`/product/${item._id}`);
                    }
                  }}
                  className="flex h-[300px] flex-col overflow-hidden rounded-3xl border border-[#eadccf] bg-gradient-to-b from-[#fff7ea] via-white to-[#f6ece2] p-3 shadow-[0_18px_55px_rgba(47,28,18,0.09)]"
                >
                  <div className="relative overflow-hidden rounded-2xl border border-white/70 bg-white/60">
                    <div className="relative h-36">
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

                  <div className="mt-3 flex flex-1 flex-col">
                    <h3 className="line-clamp-1 font-[family-name:var(--font-poppins)] text-[14px] font-semibold text-[#24130c]">
                      {item.name}
                    </h3>
                    <p className="mt-1 line-clamp-2 text-left text-[12px] leading-4 text-[#6f5647]">{item.description || ""}</p>

                    <div className="mt-2 flex items-center gap-1">
                      <span className="text-[10px] leading-none text-[#ffb347]">★★★★★</span>
                      <span className="text-[10px] font-semibold text-[#6f5647]">
                        ({Number(summary?.avgRating || 0).toFixed(1)}) · {Number(summary?.orderCount || 0)} orders
                      </span>
                    </div>
                    {summary?.latestReviewText ? (
                      <p className="mt-1 line-clamp-1 text-[10px] text-[#8b8178]">"{summary.latestReviewText}"</p>
                    ) : null}

                    <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                      <p className="text-sm font-semibold text-[#5b2d17] whitespace-nowrap">PKR {getProductCardPrice(item)}</p>
                      <button
                        type="button"
                        onClick={async (event) => {
                          event.stopPropagation();
                          await addItemToCart(item._id, "", 1, event.currentTarget);
                        }}
                        aria-label="Add to cart"
                        className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-br from-[#5b2d17] to-[#8b3f1c] px-2 py-1 text-white transition hover:brightness-[1.05] sm:px-3 sm:py-1.5"
                      >
                        <ShoppingCart className="h-4 w-4" />
                        <span className="ml-1 text-[10px] font-semibold leading-none sm:text-xs">Add</span>
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}
      </section>
    </main>
  );
}


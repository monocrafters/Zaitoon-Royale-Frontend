"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, ShoppingCart, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import { API_BASE_URL } from "@/lib/admin-auth";
import { addDealToCart, addItemToCart, useCartSnapshot } from "@/lib/cart-client";
import SiteHeader from "@/components/public/site-header";
import ModernLoader from "@/components/ui/modern-loader";
import { readSessionCache, writeSessionCache } from "@/lib/session-cache";

type PublicCategory = {
  _id: string;
  name: string;
  menuOrder?: number;
};

type PublicProduct = {
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
  category?: {
    _id?: string;
    name?: string;
  };
};

type PublicDeal = {
  _id: string;
  title: string;
  description?: string;
  imageUrl?: string;
  endsAt?: string | null;
  pricing?: { originalPrice: number; finalPrice: number };
  items?: Array<{ qty: number; size?: string; product: { _id: string; name: string } }>;
  products?: Array<{ _id: string; name: string }>;
};

const getProductPrice = (product: PublicProduct) => {
  if (product.hasSizePricing) return Number(product.sizePrices?.medium) || Number(product.price) || 0;
  return Number(product.price) || 0;
};

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

const MENU_CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes
const MENU_PRODUCTS_CACHE_KEY = "restaurant_menu_products_cache_v1";
const MENU_DEALS_CACHE_KEY = "restaurant_menu_deals_cache_v1";
const MENU_CATEGORIES_CACHE_KEY = "restaurant_menu_categories_cache_v1";

export default function MenuPage() {
  const router = useRouter();
  const [products, setProducts] = useState<PublicProduct[]>([]);
  const [deals, setDeals] = useState<PublicDeal[]>([]);
  const [categories, setCategories] = useState<PublicCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const dealsStripRef = useRef<HTMLDivElement | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [activeProduct, setActiveProduct] = useState<PublicProduct | null>(null);
  const [activeDeal, setActiveDeal] = useState<PublicDeal | null>(null);
  const [selectedSize, setSelectedSize] = useState<"small" | "medium" | "large" | "xlarge">("medium");
  const [rowSizes, setRowSizes] = useState<Record<string, "small" | "medium" | "large" | "xlarge">>({});
  const { cart } = useCartSnapshot();

  useEffect(() => {
    const load = async () => {
      try {
        setError("");

        const cachedProducts = readSessionCache<PublicProduct[]>(MENU_PRODUCTS_CACHE_KEY, MENU_CACHE_TTL_MS);
        const cachedDeals = readSessionCache<PublicDeal[]>(MENU_DEALS_CACHE_KEY, MENU_CACHE_TTL_MS);
        const cachedCategories = readSessionCache<PublicCategory[]>(MENU_CATEGORIES_CACHE_KEY, MENU_CACHE_TTL_MS);
        const hasCache = Boolean(cachedProducts?.length || cachedDeals?.length || cachedCategories?.length);

        if (cachedProducts) setProducts(cachedProducts);
        if (cachedDeals) setDeals(cachedDeals);
        if (cachedCategories) setCategories(cachedCategories);
        if (hasCache) setLoading(false);

        const [productsRes, dealsRes, categoriesRes] = await Promise.all([
          fetch(`${API_BASE_URL}/products/public`, { cache: "no-store" }),
          fetch(`${API_BASE_URL}/deals/public`, { cache: "no-store" }),
          fetch(`${API_BASE_URL}/categories/public`, { cache: "no-store" }),
        ]);

        const [productsPayload, dealsPayload, categoriesPayload] = await Promise.all([
          productsRes.json(),
          dealsRes.json(),
          categoriesRes.json(),
        ]);

        if (productsRes.ok) {
          const next = productsPayload.products || [];
          setProducts(next);
          writeSessionCache(MENU_PRODUCTS_CACHE_KEY, next);
        } else if (!hasCache) {
          throw new Error(productsPayload.message || "Unable to load menu.");
        }

        if (dealsRes.ok) {
          const nextDeals = dealsPayload.deals || [];
          setDeals(nextDeals);
          writeSessionCache(MENU_DEALS_CACHE_KEY, nextDeals);
        }

        if (categoriesRes.ok) {
          const nextCats = categoriesPayload.categories || [];
          setCategories(nextCats);
          writeSessionCache(MENU_CATEGORIES_CACHE_KEY, nextCats);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unable to load menu.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (!deals?.length) return;
    const t = setInterval(() => {
      // Re-render for countdown ticks
      setDeals((prev) => prev.slice());
    }, 1000);
    return () => clearInterval(t);
  }, [deals?.length]);

  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModalOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modalOpen]);

  const groupedByCategoryId = useMemo(() => {
    const map = new Map<string, PublicProduct[]>();
    for (const p of products) {
      const cid = p.category?._id || "other";
      if (!map.has(cid)) map.set(cid, []);
      map.get(cid)!.push(p);
    }
    return map;
  }, [products]);

  const orderedCategories = useMemo(() => {
    const next = [...(categories || [])];
    next.sort((a, b) => (Number(a.menuOrder) || 0) - (Number(b.menuOrder) || 0));
    return next;
  }, [categories]);

  const getDealProductsLine = (d: PublicDeal) => {
    const items = Array.isArray(d.items) ? d.items : [];
    if (items.length) {
      const parts = items.map((it) => {
        const qty = Math.max(1, Number(it.qty) || 1);
        const rawSize = String(it.size || "").trim();
        const sizeLabel = rawSize ? `${rawSize[0].toUpperCase()}${rawSize.slice(1)} ` : "";
        return `${qty}x ${sizeLabel}${it.product?.name || ""}`.trim();
      });
      return parts.filter(Boolean).join(" • ");
    }
    const legacy = Array.isArray(d.products) ? d.products : [];
    if (legacy.length) return legacy.map((p) => p?.name).filter(Boolean).join(" • ");
    return "";
  };

  const openProductModal = (p: PublicProduct) => {
    setActiveDeal(null);
    setActiveProduct(p);
    setSelectedSize(rowSizes[p._id] || "medium");
    setModalOpen(true);
  };

  const openDealModal = (d: PublicDeal) => {
    setActiveProduct(null);
    setActiveDeal(d);
    setModalOpen(true);
  };

  const closeModal = () => setModalOpen(false);

  const displayProductPrice = (p: PublicProduct, size: "small" | "medium" | "large" | "xlarge") => {
    if (!p.hasSizePricing) return Number(p.price) || 0;
    return Number(p.sizePrices?.[size]) || Number(p.sizePrices?.medium) || Number(p.price) || 0;
  };

  const getRowSize = (p: PublicProduct) => rowSizes[p._id] || "medium";
  const setRowSize = (productId: string, size: "small" | "medium" | "large" | "xlarge") =>
    setRowSizes((prev) => ({ ...prev, [productId]: size }));

  const cartItemsLine = useMemo(() => {
    const items = cart?.items || [];
    if (!items.length) return "";
    return items
      .map((it) => {
        const label = it.kind === "deal" ? it.deal?.title || it.title || "Deal" : it.product?.name || it.title || "Item";
        return `${Math.max(1, Number(it.qty) || 1)}x ${label}`;
      })
      .slice(0, 5)
      .join(" • ");
  }, [cart?.items]);
  const visibleDeals = useMemo(
    () => deals.filter((d) => !formatCountdown(d.endsAt)?.ended),
    [deals]
  );

  return (
    <main className="bg-[#f5efe8] text-[#2f1c12] antialiased">
      <SiteHeader />
      <section className="mx-auto max-w-7xl px-4 pb-36 pt-[96px] sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="font-[family-name:var(--font-poppins)] text-3xl font-semibold text-[#111] sm:text-4xl">
            Menu
          </h1>
          <div className="mx-auto mt-3 h-[3px] w-24 rounded-full bg-gradient-to-r from-transparent via-[#5b2d17] to-transparent opacity-80" />
        </div>

        {!loading && visibleDeals.length ? (
          <section className="mt-6">
            <div className="flex items-end justify-between gap-2">
              <div>
                <h2 className="font-[family-name:var(--font-poppins)] text-xl font-semibold text-[#111] sm:text-2xl">
                  Deals
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => dealsStripRef.current?.scrollBy({ left: -360, behavior: "smooth" })}
                  className="rounded-2xl border border-[#eadccf] bg-white/80 p-2 text-[#5b2d17] shadow-sm transition hover:bg-white"
                  aria-label="Scroll deals left"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => dealsStripRef.current?.scrollBy({ left: 360, behavior: "smooth" })}
                  className="rounded-2xl border border-[#eadccf] bg-white/80 p-2 text-[#5b2d17] shadow-sm transition hover:bg-white"
                  aria-label="Scroll deals right"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div
              ref={dealsStripRef}
              className="hide-scrollbar mt-3 -mx-4 flex gap-3 overflow-x-auto px-4 pb-2"
            >
              {visibleDeals.map((d) => {
                const cd = formatCountdown(d.endsAt);
                const img = d.imageUrl || "";
                const finalPrice = Number(d.pricing?.finalPrice) || 0;
                const originalPrice = Number(d.pricing?.originalPrice) || 0;
                const productsLine = getDealProductsLine(d);
                return (
                  <article
                    key={d._id}
                    role="button"
                    tabIndex={0}
                    onClick={() => openDealModal(d)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") openDealModal(d);
                    }}
                    className="relative w-[270px] shrink-0 overflow-hidden rounded-3xl border border-[#eadccf]/70 bg-[#fffaf4]/75 p-4 sm:w-[320px]"
                  >
                    <div className="absolute inset-0 opacity-[0.06] [background-image:radial-gradient(circle_at_1px_1px,#7a3f22_1px,transparent_0)] [background-size:16px_16px]" />
                    <div className="relative flex items-start gap-3">
                      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-[#eadccf] bg-white">
                        {img ? <Image src={img} alt={d.title} fill className="object-cover" unoptimized /> : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 font-[family-name:var(--font-poppins)] text-sm font-semibold text-[#2f1c12] sm:text-base">
                          {d.title}
                        </p>
                        {productsLine ? (
                          <p className="mt-1 line-clamp-1 text-[11px] font-semibold text-[#7a3f22]">{productsLine}</p>
                        ) : null}
                      </div>
                    </div>

                    <div className="relative mt-3 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[#5b2d17]">
                          PKR {finalPrice}{" "}
                          {originalPrice ? (
                            <span className="ml-1 text-[11px] font-medium text-[#8a6f5e] line-through">
                              PKR {originalPrice}
                            </span>
                          ) : null}
                        </p>
                        {cd ? (
                          <p className="mt-1 text-[11px] text-[#6f5647]">
                            {cd.ended ? "Ended" : `${cd.days}d ${cd.hours}h ${cd.minutes}m ${cd.seconds}s`}
                          </p>
                        ) : (
                          <p className="mt-1 text-[11px] text-[#6f5647]">No expiry</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={async (e) => {
                          e.stopPropagation();
                          await addDealToCart(d._id, 1, e.currentTarget, {
                            title: d.title,
                            imageUrl: d.imageUrl || "",
                            unitPrice: Number(d.pricing?.finalPrice) || 0,
                          });
                        }}
                        className="inline-flex items-center gap-1 rounded-xl bg-gradient-to-br from-[#5b2d17] to-[#8b3f1c] px-3 py-2 text-xs font-semibold text-white transition hover:brightness-[1.05] sm:px-4 sm:py-2.5 sm:text-sm"
                      >
                        <ShoppingCart className="h-4 w-4" />
                        Add
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}

        {loading ? (
          <div className="mt-6 space-y-6">
            <ModernLoader label="Preparing menu..." />
            {Array.from({ length: 3 }).map((_, sec) => (
              <div key={`menu-skel-sec-${sec}`}>
                <div className="h-8 w-44 animate-pulse rounded-xl bg-[#e9ded3]" />
                <div className="mt-3 space-y-2">
                  {Array.from({ length: 4 }).map((__, row) => (
                    <div key={`menu-skel-row-${sec}-${row}`} className="h-20 animate-pulse rounded-2xl bg-[#e9ded3]" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {error ? (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
        ) : null}

        {!loading && !error ? (
          <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
            {orderedCategories.map((cat) => {
              const items = groupedByCategoryId.get(cat._id) || [];
              if (!items.length) return null;
              return (
              <section key={cat._id} className="rounded-3xl border border-[#eadccf] bg-white/80 p-4 shadow-[0_10px_30px_rgba(47,28,18,0.06)] sm:p-5">
                <h2 className="font-[family-name:var(--font-poppins)] text-xl font-semibold text-[#2f1c12] sm:text-2xl">
                  {cat.name}
                </h2>
                <div className="mt-3 space-y-2">
                  {items.map((item) => (
                    <article
                      key={item._id}
                      role="button"
                      tabIndex={0}
                      onClick={() => openProductModal(item)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") openProductModal(item);
                      }}
                      className="flex items-center gap-2 rounded-2xl border border-[#eee2d7] bg-[#fffaf4] p-2 sm:gap-4 sm:p-2.5"
                    >
                      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-[#eadccf] bg-white sm:h-14 sm:w-14">
                        {item.imageUrl ? <Image src={item.imageUrl} alt={item.name} fill className="object-cover" unoptimized /> : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-1 text-[13px] font-semibold text-[#2f1c12] sm:text-base">{item.name}</p>
                        <p className="mt-0.5 line-clamp-1 text-[11px] text-[#6f5647] sm:text-sm">{item.description || "—"}</p>
                        {item.hasSizePricing ? (
                          <div
                            className="mt-1 flex w-full flex-nowrap items-center gap-0.5 whitespace-nowrap"
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                          >
                            {(["small", "medium", "large", "xlarge"] as const).map((k) => {
                              const short = k === "small" ? "S" : k === "medium" ? "M" : k === "large" ? "L" : "XL";
                              const active = getRowSize(item) === k;
                              return (
                                <button
                                  key={k}
                                  type="button"
                                  onClick={() => setRowSize(item._id, k)}
                                  className={[
                                    "inline-flex h-5 min-w-0 flex-1 items-center justify-center rounded-md border px-0.5 text-[9px] font-semibold leading-none transition sm:h-6 sm:w-10 sm:flex-none sm:rounded-lg sm:px-1",
                                    active
                                      ? "border-[#5b2d17] bg-[#5b2d17] text-white"
                                      : "border-[#e4d3c5] bg-white text-[#5b2d17] hover:bg-[#f4efe8]",
                                  ].join(" ")}
                                  aria-label={`Select size ${k}`}
                                >
                                  {short}
                                </button>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="whitespace-nowrap text-[12px] font-semibold text-[#5b2d17] sm:text-base">
                          PKR {item.hasSizePricing ? displayProductPrice(item, getRowSize(item)) : getProductPrice(item)}
                        </p>
                        <button
                          type="button"
                          onClick={async (e) => {
                            e.stopPropagation();
                            await addItemToCart(item._id, item.hasSizePricing ? getRowSize(item) : "", 1, e.currentTarget);
                          }}
                          className="inline-flex items-center gap-1 rounded-xl bg-gradient-to-br from-[#5b2d17] to-[#8b3f1c] px-2.5 py-2 text-[11px] font-semibold text-white transition hover:brightness-[1.05] sm:px-4 sm:py-2.5 sm:text-sm"
                          aria-label="Add to cart"
                        >
                          <ShoppingCart className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Add</span>
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )})}

            {(() => {
              const other = groupedByCategoryId.get("other") || [];
              if (!other.length) return null;
              return (
                <section className="rounded-3xl border border-[#eadccf] bg-white/80 p-4 shadow-[0_10px_30px_rgba(47,28,18,0.06)] sm:p-5">
                  <h2 className="font-[family-name:var(--font-poppins)] text-xl font-semibold text-[#2f1c12] sm:text-2xl">
                    Other
                  </h2>
                  <div className="mt-3 space-y-2">
                    {other.map((item) => (
                      <article
                        key={item._id}
                        role="button"
                        tabIndex={0}
                        onClick={() => openProductModal(item)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") openProductModal(item);
                        }}
                        className="flex items-center gap-2 rounded-2xl border border-[#eee2d7] bg-[#fffaf4] p-2 sm:gap-4 sm:p-2.5"
                      >
                        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-[#eadccf] bg-white sm:h-14 sm:w-14">
                          {item.imageUrl ? (
                            <Image src={item.imageUrl} alt={item.name} fill className="object-cover" unoptimized />
                          ) : null}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-1 text-[13px] font-semibold text-[#2f1c12] sm:text-base">{item.name}</p>
                          <p className="mt-0.5 line-clamp-1 text-[11px] text-[#6f5647] sm:text-sm">{item.description || "—"}</p>
                          {item.hasSizePricing ? (
                            <div
                              className="mt-1 flex w-full flex-nowrap items-center gap-0.5 whitespace-nowrap"
                              onClick={(e) => e.stopPropagation()}
                              onKeyDown={(e) => e.stopPropagation()}
                            >
                              {(["small", "medium", "large", "xlarge"] as const).map((k) => {
                                const short = k === "small" ? "S" : k === "medium" ? "M" : k === "large" ? "L" : "XL";
                                const active = getRowSize(item) === k;
                                return (
                                  <button
                                    key={k}
                                    type="button"
                                    onClick={() => setRowSize(item._id, k)}
                                    className={[
                                      "inline-flex h-5 min-w-0 flex-1 items-center justify-center rounded-md border px-0.5 text-[9px] font-semibold leading-none transition sm:h-6 sm:w-10 sm:flex-none sm:rounded-lg sm:px-1",
                                      active
                                        ? "border-[#5b2d17] bg-[#5b2d17] text-white"
                                        : "border-[#e4d3c5] bg-white text-[#5b2d17] hover:bg-[#f4efe8]",
                                    ].join(" ")}
                                    aria-label={`Select size ${k}`}
                                  >
                                    {short}
                                  </button>
                                );
                              })}
                            </div>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2">
                          <p className="whitespace-nowrap text-[12px] font-semibold text-[#5b2d17] sm:text-base">
                            PKR {item.hasSizePricing ? displayProductPrice(item, getRowSize(item)) : getProductPrice(item)}
                          </p>
                          <button
                            type="button"
                            onClick={async (e) => {
                              e.stopPropagation();
                              await addItemToCart(item._id, item.hasSizePricing ? getRowSize(item) : "", 1, e.currentTarget);
                            }}
                            className="inline-flex items-center gap-1 rounded-xl bg-gradient-to-br from-[#5b2d17] to-[#8b3f1c] px-2.5 py-2 text-[11px] font-semibold text-white transition hover:brightness-[1.05] sm:px-4 sm:py-2.5 sm:text-sm"
                            aria-label="Add to cart"
                          >
                            <ShoppingCart className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Add</span>
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              );
            })()}
          </div>
        ) : null}
      </section>

      {(cart?.items?.length || 0) > 0 ? (
        <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+56px)] z-40 border-t border-[#eadccf] bg-[#fffaf4]/97 px-4 pb-2 pt-2 backdrop-blur lg:bottom-0 lg:z-[85] lg:pb-[max(14px,env(safe-area-inset-bottom))]">
          <div className="mx-auto max-w-7xl">
            <p className="text-[11px] text-[#7d6b5d]">
              {cart?.totalItems || 0} item{(cart?.totalItems || 0) === 1 ? "" : "s"}
            </p>
            <p className="mt-0.5 min-h-4 text-[11px] leading-4 text-[#6f5647]">{cartItemsLine}</p>
            <div className="mt-1.5 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-[#2f1c12]">
                Subtotal <span className="ml-1 text-[#b84a2b]">PKR {cart?.subtotal || 0}</span>
              </p>
              <button
                type="button"
                onClick={() => router.push("/checkout")}
                className="rounded-xl bg-[#111] px-4 py-2.5 text-sm font-semibold text-white sm:px-5"
              >
                <span className="sm:hidden">Proceed</span>
                <span className="hidden sm:inline">Proceed to Checkout</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <AnimatePresence>
        {modalOpen ? (
          <motion.div
            key="menu-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 px-4 py-8 backdrop-blur-sm"
            onMouseDown={closeModal}
            role="dialog"
            aria-modal="true"
          >
            <motion.div
              initial={{ y: 18, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 12, opacity: 0, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 260, damping: 22, mass: 0.9 }}
              onMouseDown={(e) => e.stopPropagation()}
              className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-[#eadccf] bg-white shadow-[0_30px_90px_rgba(0,0,0,0.35)]"
            >
              <div className="absolute inset-0 opacity-[0.10] [background-image:radial-gradient(circle_at_1px_1px,#7a3f22_1px,transparent_0)] [background-size:18px_18px]" />

              <div className="relative flex items-start justify-between gap-3 border-b border-[#eadccf] px-4 py-3 sm:px-5 sm:py-4">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[#7a3f22]">{activeDeal ? "Deal" : "Product"}</p>
                  <h3 className="mt-1 line-clamp-2 font-[family-name:var(--font-poppins)] text-base font-semibold text-[#111] sm:text-xl">
                    {activeDeal ? activeDeal.title : activeProduct?.name || ""}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-2xl border border-[#eadccf] bg-white/70 p-2 text-[#5b2d17] transition hover:bg-white"
                  aria-label="Close modal"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="relative grid gap-3 px-4 py-4 sm:gap-4 sm:px-5 sm:py-5 sm:grid-cols-[180px_1fr]">
                <div className="relative h-[150px] overflow-hidden rounded-3xl border border-[#eadccf] bg-[#fffaf4] sm:h-[180px]">
                  {(activeDeal?.imageUrl || activeProduct?.imageUrl) ? (
                    <Image
                      src={(activeDeal?.imageUrl || activeProduct?.imageUrl) as string}
                      alt={(activeDeal ? activeDeal.title : activeProduct?.name) || "Item"}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  ) : null}
                </div>

                <div className="min-w-0">
                  {activeDeal ? (
                    <>
                      <p className="text-[13px] text-[#6f5647]">{activeDeal.description || "—"}</p>
                      <p className="mt-3 text-[12px] font-semibold text-[#7a3f22]">
                        {getDealProductsLine(activeDeal) || "—"}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-[#5b2d17]">
                            PKR {Number(activeDeal.pricing?.finalPrice) || 0}{" "}
                            {Number(activeDeal.pricing?.originalPrice) ? (
                              <span className="ml-1 text-xs font-medium text-[#8a6f5e] line-through">
                                PKR {Number(activeDeal.pricing?.originalPrice) || 0}
                              </span>
                            ) : null}
                          </p>
                          {(() => {
                            const cd = formatCountdown(activeDeal.endsAt);
                            if (!cd) return <p className="mt-1 text-xs text-[#6f5647]">No expiry</p>;
                            return (
                              <p className="mt-1 text-xs text-[#6f5647]">
                                {cd.ended ? "Ended" : `${cd.days}d ${cd.hours}h ${cd.minutes}m ${cd.seconds}s`}
                              </p>
                            );
                          })()}
                        </div>
                        <button
                          type="button"
                          onClick={async (e) => {
                            if (!activeDeal) return;
                            await addDealToCart(activeDeal._id, 1, e.currentTarget, {
                              title: activeDeal.title,
                              imageUrl: activeDeal.imageUrl || "",
                              unitPrice: Number(activeDeal.pricing?.finalPrice) || 0,
                            });
                          }}
                          className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-br from-[#5b2d17] to-[#8b3f1c] px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-[1.05]"
                        >
                          <ShoppingCart className="h-4 w-4" />
                          Add to Cart
                        </button>
                      </div>
                    </>
                  ) : activeProduct ? (
                    <>
                      <p className="text-[13px] text-[#6f5647]">{activeProduct.description || "—"}</p>

                      {activeProduct.hasSizePricing ? (
                        <div className="mt-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-[#7a3f22]">Select size</p>
                          <div className="mt-2 grid grid-cols-4 gap-1.5 sm:flex sm:flex-wrap">
                            {(["small", "medium", "large", "xlarge"] as const).map((k) => (
                              <button
                                key={k}
                                type="button"
                                onClick={() => setSelectedSize(k)}
                                className={[
                                  "h-10 rounded-xl border px-2 text-[10px] font-extrabold uppercase tracking-wide transition sm:h-auto sm:px-3 sm:py-2 sm:text-xs",
                                  selectedSize === k
                                    ? "border-[#5b2d17] bg-[#5b2d17] text-white"
                                    : "border-[#eadccf] bg-white text-[#5b2d17] hover:bg-[#f4efe8]",
                                ].join(" ")}
                              >
                                <span className="flex flex-col items-center leading-none">
                                  <span>{k === "small" ? "S" : k === "medium" ? "M" : k === "large" ? "L" : "XL"}</span>
                                  <span className={selectedSize === k ? "mt-1 text-[10px] font-semibold text-white/90" : "mt-1 text-[10px] font-semibold text-[#8a6f5e]"}>
                                    PKR {displayProductPrice(activeProduct, k)}
                                  </span>
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                        <p className="text-lg font-semibold text-[#b84a2b]">
                          PKR {displayProductPrice(activeProduct, selectedSize)}
                        </p>
                        <button
                          type="button"
                          onClick={async (e) => {
                            if (!activeProduct?._id) return;
                            await addItemToCart(
                              activeProduct._id,
                              activeProduct.hasSizePricing ? selectedSize : "",
                              1,
                              e.currentTarget
                            );
                          }}
                          className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-br from-[#5b2d17] to-[#8b3f1c] px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-[1.05]"
                        >
                          <ShoppingCart className="h-4 w-4" />
                          Add to Cart
                        </button>
                      </div>
                    </>
                  ) : null}
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </main>
  );
}


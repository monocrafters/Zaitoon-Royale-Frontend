"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, MapPin, ShoppingCart } from "lucide-react";

import SiteHeader from "@/components/public/site-header";
import { API_BASE_URL } from "@/lib/admin-auth";
import { fetchCustomerMe, registerCustomerAtCheckout, type CustomerProfile, useCustomerSession } from "@/lib/customer-auth";
import { addItemToCart, fetchCartSnapshot, type CartSnapshot } from "@/lib/cart-client";
import { fetchPublicReviewSummariesByTitles, type ProductReviewSummary } from "@/lib/reviews-client";
import ModernLoader from "@/components/ui/modern-loader";

type RelatedProduct = {
  _id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  price?: number;
  hasSizePricing?: boolean;
  sizePrices?: { medium?: number };
  badge?: "" | "Trending" | "Most Ordered" | "Best Seller" | "New Arrival" | "Chef's Special" | "Limited Deal";
  category?: { name?: string };
};

const getProductCardPrice = (product: RelatedProduct) => {
  if (product.hasSizePricing) return Number(product.sizePrices?.medium) || Number(product.price) || 0;
  return Number(product.price) || 0;
};

const getBadgePill = (badge?: RelatedProduct["badge"]) => {
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

export default function CheckoutPage() {
  const router = useRouter();
  const { profile } = useCustomerSession();
  const [cart, setCart] = useState<CartSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [savedDelivery, setSavedDelivery] = useState<CustomerProfile | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<RelatedProduct[]>([]);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [directProductName, setDirectProductName] = useState("");
  const [directType, setDirectType] = useState("");
  const [directId, setDirectId] = useState("");
  const [relatedStripEl, setRelatedStripEl] = useState<HTMLDivElement | null>(null);
  const [relatedReviewMap, setRelatedReviewMap] = useState<Record<string, ProductReviewSummary>>({});
  const [addingProductId, setAddingProductId] = useState("");
  const [addedProductId, setAddedProductId] = useState("");
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    notes: "",
  });

  const applyProfileToForm = (nextProfile: CustomerProfile | null) => {
    if (!nextProfile) return;
    setSavedDelivery(nextProfile);
    setForm((f) => ({
      ...f,
      fullName: nextProfile.name || f.fullName,
      email: nextProfile.email || f.email,
      phone: nextProfile.phone || f.phone,
      address: nextProfile.defaultAddress || f.address,
      city: nextProfile.defaultCity || f.city,
    }));
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [snapshot, remoteProfile] = await Promise.all([fetchCartSnapshot(), fetchCustomerMe()]);
        setCart(snapshot);
        applyProfileToForm(remoteProfile);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setDirectType(String(params.get("direct") || "").trim());
    setDirectId(String(params.get("id") || "").trim());
  }, []);

  useEffect(() => {
    if (directType !== "product" || !directId) {
      setDirectProductName("");
      setRelatedProducts([]);
      return;
    }
    let cancelled = false;
    const loadRelated = async () => {
      setRelatedLoading(true);
      try {
        const listRes = await fetch(`${API_BASE_URL}/products/public`, { cache: "no-store" });
        const listPayload = await listRes.json();
        if (!listRes.ok) throw new Error("Unable to load related items.");
        const allProducts = (Array.isArray(listPayload?.products) ? listPayload.products : []) as RelatedProduct[];
        const selected = allProducts.find((p) => p._id === directId) || null;
        if (cancelled) return;
        setDirectProductName(selected?.name || "");
        setRelatedProducts(allProducts.filter((p) => p._id !== directId));
      } catch {
        if (cancelled) return;
        setDirectProductName("");
        setRelatedProducts([]);
      } finally {
        if (!cancelled) setRelatedLoading(false);
      }
    };
    void loadRelated();
    return () => {
      cancelled = true;
    };
  }, [directId, directType]);

  useEffect(() => {
    const titles = relatedProducts.map((p) => String(p.name || "").trim()).filter(Boolean);
    if (!titles.length) {
      setRelatedReviewMap({});
      return;
    }
    let cancelled = false;
    const run = async () => {
      try {
        const payload = await fetchPublicReviewSummariesByTitles(titles);
        if (cancelled) return;
        const map: Record<string, ProductReviewSummary> = {};
        for (const s of payload.summaries || []) map[s.productTitle] = s;
        setRelatedReviewMap(map);
      } catch {
        if (!cancelled) setRelatedReviewMap({});
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [relatedProducts]);

  useEffect(() => {
    applyProfileToForm(profile);
  }, [profile]);

  const submitOrder = async () => {
    if (!form.fullName.trim() || !form.phone.trim() || !form.address.trim()) return;
    setCheckoutError("");
    setSubmitting(true);
    try {
      await registerCustomerAtCheckout({
        name: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
        city: form.city.trim(),
      });
      setSavedDelivery((prev) =>
        prev
          ? {
              ...prev,
              name: form.fullName.trim(),
              email: form.email.trim(),
              phone: form.phone.trim(),
              defaultAddress: form.address.trim(),
              defaultCity: form.city.trim(),
            }
          : prev
      );
      const query = new URLSearchParams({
        name: form.fullName.trim(),
        phone: form.phone.trim(),
        city: form.city.trim(),
        address: form.address.trim(),
        notes: form.notes.trim(),
      });
      router.push(`/confirmation?${query.toString()}`);
    } catch (e) {
      setCheckoutError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const hasSavedAddress = Boolean(
    savedDelivery && (savedDelivery.defaultAddress?.trim() || savedDelivery.defaultCity?.trim())
  );
  const cartItemNames = (cart?.items || [])
    .map((it) => String(it.deal?.title || it.product?.name || it.title || "").trim())
    .filter(Boolean)
    .slice(0, 3);

  return (
    <main className="min-h-screen bg-[#f5efe8] text-[#2f1c12] antialiased">
      <SiteHeader />
      <section
        className={[
          "w-full px-4 pt-[96px] sm:px-6 lg:px-8 lg:pb-10",
          (cart?.items?.length || 0) > 0 ? "pb-52 sm:pb-44" : "pb-24",
        ].join(" ")}
      >
        <div className="w-full max-w-none">
          <h1 className="font-[family-name:var(--font-poppins)] text-3xl font-semibold text-[#111]">Checkout</h1>
          <p className="mt-1 text-sm text-[#6f5647]">Your details create a quick account so you can track orders from the header.</p>
        </div>

        {hasSavedAddress && savedDelivery ? (
          <div className="mt-5 w-full rounded-2xl border border-[#dcc4ad] bg-[#fffaf4] px-4 py-3 sm:px-5">
            <div className="flex gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#5b2d17]/12 text-[#5b2d17]">
                <MapPin className="h-5 w-5" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#7d6b5d]">Latest saved delivery</p>
                <p className="mt-0.5 text-sm font-semibold text-[#1d140f]">
                  {savedDelivery.name}
                  {savedDelivery.phone ? <span className="font-normal text-[#6f5647]"> · {savedDelivery.phone}</span> : null}
                </p>
                <p className="mt-1 text-sm leading-snug text-[#4a3d34]">
                  {[savedDelivery.defaultAddress, savedDelivery.defaultCity].filter(Boolean).join(", ")}
                </p>
                <p className="mt-2 text-[11px] text-[#7d6b5d]">Form below is prefilled — changes save again when you proceed.</p>
              </div>
            </div>
          </div>
        ) : null}

        {loading ? <ModernLoader className="mt-4" label="Loading order summary..." /> : null}
        {!loading && !(cart?.items?.length || 0) ? (
          <p className="mt-4 text-sm text-[#6f5647]">Your cart is empty.</p>
        ) : null}

        {(cart?.items?.length || 0) > 0 ? (
          <div className="mt-6 grid w-full max-w-none gap-3 sm:gap-5 lg:grid-cols-[1fr_360px]">
            <div className="border-0 bg-transparent p-0 sm:rounded-3xl sm:border sm:border-[#eadccf] sm:bg-white sm:p-5 lg:rounded-3xl">
              <h2 className="text-lg font-semibold text-[#1d140f]">Delivery Details</h2>
              <div className="mt-3 grid gap-3 bg-transparent sm:bg-transparent">
                <input
                  value={form.fullName}
                  onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                  placeholder="Full Name"
                  autoComplete="name"
                  className="rounded-xl border border-[#eadccf] bg-[#fffaf4] px-3 py-2.5 text-sm outline-none focus:border-[#b84a2b]"
                />
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="Email (optional)"
                  autoComplete="email"
                  className="rounded-xl border border-[#eadccf] bg-[#fffaf4] px-3 py-2.5 text-sm outline-none focus:border-[#b84a2b]"
                />
                <input
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="Phone Number"
                  autoComplete="tel"
                  className="rounded-xl border border-[#eadccf] bg-[#fffaf4] px-3 py-2.5 text-sm outline-none focus:border-[#b84a2b]"
                />
                <input
                  value={form.city}
                  onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                  placeholder="City"
                  autoComplete="address-level2"
                  className="rounded-xl border border-[#eadccf] bg-[#fffaf4] px-3 py-2.5 text-sm outline-none focus:border-[#b84a2b]"
                />
                <textarea
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  placeholder="Complete Address"
                  rows={3}
                  autoComplete="street-address"
                  className="rounded-xl border border-[#eadccf] bg-[#fffaf4] px-3 py-2.5 text-sm outline-none focus:border-[#b84a2b]"
                />
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Order Notes (optional)"
                  rows={2}
                  className="rounded-xl border border-[#eadccf] bg-[#fffaf4] px-3 py-2.5 text-sm outline-none focus:border-[#b84a2b]"
                />
              </div>
              {checkoutError ? <p className="mt-3 text-sm text-red-600">{checkoutError}</p> : null}
              <button
                type="button"
                onClick={() => void submitOrder()}
                disabled={submitting || !form.fullName.trim() || !form.phone.trim() || !form.address.trim()}
                className="mt-4 hidden w-full rounded-xl bg-[#111] px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-55 lg:block"
              >
                {submitting ? "Saving..." : "Proceed"}
              </button>
            </div>

            <aside className="hidden border-y border-[#eadccf] bg-white p-4 sm:rounded-3xl sm:border sm:p-5 lg:block">
              <h3 className="text-base font-semibold text-[#1d140f]">Order Summary</h3>
              <div className="mt-3 space-y-2 text-sm text-[#6f5647]">
                <div className="flex items-center justify-between">
                  <span>Items</span>
                  <span className="text-right text-xs font-semibold text-[#2f1c12]">
                    {cartItemNames.length ? cartItemNames.join(", ") : "—"}
                    {(cart?.items?.length || 0) > 3 ? "..." : ""}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Delivery</span>
                  <span className="font-semibold text-[#2f1c12]">Free</span>
                </div>
              </div>
              <div className="mt-4 border-t border-[#efe2d5] pt-4">
                <p className="text-base font-semibold text-[#2f1c12]">
                  Subtotal <span className="ml-1 text-[#b84a2b]">PKR {cart?.subtotal || 0}</span>
                </p>
                <p className="mt-1 text-[11px] text-[#7d6b5d]">Payment method and final confirmation on next step.</p>
                {(cart?.items?.length || 0) > 0 ? (
                  <div className="mt-3 rounded-xl border border-[#efe2d5] bg-[#fffaf4] p-2.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[#7d6b5d]">All Items</p>
                    <p className="mt-1 text-xs leading-5 text-[#5f544b]">
                      {(cart?.items || [])
                        .map((it) => String(it.deal?.title || it.product?.name || it.title || "").trim())
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                  </div>
                ) : null}
              </div>
            </aside>
          </div>
        ) : null}

        {directType === "product" ? (
          <section className="mt-6 w-full">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-lg font-semibold text-[#1d140f]">Related Items</h3>
              <div className="flex items-center gap-2">
                {directProductName ? <p className="hidden text-xs text-[#7d6b5d] sm:block">Based on {directProductName}</p> : null}
                <div className="hidden items-center gap-2 lg:flex">
                  <button
                    type="button"
                    onClick={() => relatedStripEl?.scrollBy({ left: -340, behavior: "smooth" })}
                    className="rounded-xl border border-[#eadccf] bg-white p-2 text-[#5b2d17] hover:bg-[#f4efe8]"
                    aria-label="Scroll related products left"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => relatedStripEl?.scrollBy({ left: 340, behavior: "smooth" })}
                    className="rounded-xl border border-[#eadccf] bg-white p-2 text-[#5b2d17] hover:bg-[#f4efe8]"
                    aria-label="Scroll related products right"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
            {relatedLoading ? (
              <ModernLoader className="mt-3" label="Loading related items..." />
            ) : relatedProducts.length === 0 ? (
              <p className="mt-3 text-sm text-[#6f5647]">No related items found.</p>
            ) : (
              <div
                ref={setRelatedStripEl}
                className="hide-scrollbar mt-3 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden sm:px-0"
              >
                {relatedProducts.map((item, idx) => (
                  <article
                    key={item._id}
                    className={[
                      "snap-start w-[62vw] min-w-[230px] max-w-[250px] shrink-0 overflow-hidden rounded-3xl border border-[#eadccf] bg-gradient-to-b from-[#fff7ea] via-white to-[#f6ece2] p-3 lg:w-[220px] lg:min-w-[220px] lg:max-w-[220px]",
                      idx === 0 ? "ml-2 sm:ml-0" : "",
                      idx === relatedProducts.length - 1 ? "mr-2 sm:mr-0" : "",
                    ].join(" ")}
                  >
                    <Link href={`/product/${item._id}`} className="block">
                      <div className="relative overflow-hidden rounded-2xl border border-white/70 bg-white/60">
                        <div className="relative h-28">
                          {item.imageUrl ? <Image src={item.imageUrl} alt={item.name} fill className="object-cover" unoptimized /> : null}
                        </div>
                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />
                        {getBadgePill(item.badge).label ? (
                          <span
                            className={[
                              "absolute left-2 top-2 z-10 rounded-full px-2 py-1 text-[10px] font-semibold text-white",
                              getBadgePill(item.badge).className,
                            ].join(" ")}
                          >
                            {getBadgePill(item.badge).label}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-3 line-clamp-1 font-[family-name:var(--font-poppins)] text-[13px] font-semibold text-[#24130c]">
                        {item.name}
                      </p>
                      <p className="mt-1 line-clamp-1 text-[11px] leading-4 text-[#6f5647]">{item.description || ""}</p>
                      <div className="mt-2 flex items-center gap-1">
                        <span className="text-[10px] leading-none text-[#ffb347]">★★★★★</span>
                        <span className="text-[10px] font-semibold text-[#6f5647]">
                          ({Number(relatedReviewMap[item.name]?.avgRating || 0).toFixed(1)}) · {Number(relatedReviewMap[item.name]?.count || 0)} reviews
                        </span>
                      </div>
                    </Link>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-[#5b2d17]">PKR {getProductCardPrice(item)}</p>
                      <button
                        type="button"
                        onClick={async () => {
                          if (addingProductId === item._id) return;
                          setAddingProductId(item._id);
                          await addItemToCart(item._id, "", 1);
                          const snapshot = await fetchCartSnapshot();
                          setCart(snapshot);
                          setAddingProductId("");
                          setAddedProductId(item._id);
                          window.setTimeout(() => {
                            setAddedProductId((prev) => (prev === item._id ? "" : prev));
                          }, 900);
                        }}
                        disabled={addingProductId === item._id}
                        className="inline-flex h-7 min-w-[74px] items-center justify-center gap-1 rounded-lg bg-gradient-to-br from-[#5b2d17] to-[#8b3f1c] px-2 text-[10px] font-semibold text-white transition hover:brightness-[1.05]"
                      >
                        {addedProductId === item._id ? (
                          <>
                            <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white text-[9px] font-bold text-[#5b2d17]">✓</span>
                            Added
                          </>
                        ) : (
                          <>
                            <ShoppingCart className="h-3 w-3" />
                            {addingProductId === item._id ? "..." : "Add"}
                          </>
                        )}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        ) : null}
      </section>

      {(cart?.items?.length || 0) > 0 ? (
        <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+56px)] z-40 border-t border-[#eadccf] bg-[#fffaf4]/97 px-4 pb-2.5 pt-2 backdrop-blur lg:hidden">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] leading-4 text-[#7d6b5d] break-words">
                {(cart?.items || [])
                  .map((it) => String(it.deal?.title || it.product?.name || it.title || "").trim())
                  .filter(Boolean)
                  .join(", ") || "No item selected"}
              </p>
              <p className="text-sm font-semibold text-[#2f1c12]">
                Subtotal <span className="ml-1 text-[#b84a2b]">PKR {cart?.subtotal || 0}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => void submitOrder()}
              disabled={submitting || !form.fullName.trim() || !form.phone.trim() || !form.address.trim()}
              className="shrink-0 rounded-xl bg-[#111] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-55"
            >
              {submitting ? "Saving..." : "Proceed"}
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}

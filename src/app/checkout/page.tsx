"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MapPin } from "lucide-react";

import SiteHeader from "@/components/public/site-header";
import { API_BASE_URL } from "@/lib/admin-auth";
import { fetchCustomerMe, registerCustomerAtCheckout, type CustomerProfile, useCustomerSession } from "@/lib/customer-auth";
import { addItemToCart, fetchCartSnapshot, type CartSnapshot } from "@/lib/cart-client";
import ModernLoader from "@/components/ui/modern-loader";

type RelatedProduct = {
  _id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  price?: number;
  category?: { name?: string };
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
        const [detailRes, listRes] = await Promise.all([
          fetch(`${API_BASE_URL}/products/public/${directId}`, { cache: "no-store" }),
          fetch(`${API_BASE_URL}/products/public`, { cache: "no-store" }),
        ]);
        const detailPayload = await detailRes.json();
        const listPayload = await listRes.json();
        if (!detailRes.ok || !listRes.ok) throw new Error("Unable to load related items.");
        const selected = (detailPayload?.product || null) as RelatedProduct | null;
        const allProducts = (Array.isArray(listPayload?.products) ? listPayload.products : []) as RelatedProduct[];
        const related = selected
          ? allProducts
              .filter((p) => p._id !== selected._id && p.category?.name === selected.category?.name)
              .slice(0, 6)
          : [];
        if (cancelled) return;
        setDirectProductName(selected?.name || "");
        setRelatedProducts(related);
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

  return (
    <main className="min-h-screen bg-[#f5efe8] text-[#2f1c12] antialiased">
      <SiteHeader />
      <section className="w-full px-4 pb-36 pt-[96px] sm:px-6 lg:px-8 lg:pb-10">
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
            <div className="border-y border-[#eadccf] bg-white p-4 sm:rounded-3xl sm:border sm:p-5 lg:rounded-3xl">
              <h2 className="text-lg font-semibold text-[#1d140f]">Delivery Details</h2>
              <div className="mt-3 grid gap-3">
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
                  <span className="font-semibold text-[#2f1c12]">{cart?.totalItems || 0}</span>
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
              </div>
            </aside>
          </div>
        ) : null}

        {directType === "product" ? (
          <section className="mt-6 w-full">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-lg font-semibold text-[#1d140f]">Related Items</h3>
              {directProductName ? <p className="text-xs text-[#7d6b5d]">Based on {directProductName}</p> : null}
            </div>
            {relatedLoading ? (
              <ModernLoader className="mt-3" label="Loading related items..." />
            ) : relatedProducts.length === 0 ? (
              <p className="mt-3 text-sm text-[#6f5647]">No related items found.</p>
            ) : (
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {relatedProducts.map((item) => (
                  <article
                    key={item._id}
                    className="overflow-hidden rounded-2xl border border-[#eadccf] bg-white p-2.5 shadow-[0_8px_22px_rgba(47,28,18,0.05)] sm:p-3"
                  >
                    <Link href={`/product/${item._id}`} className="block">
                      <div className="relative h-24 overflow-hidden rounded-xl border border-[#efe2d5] bg-[#fffaf4] sm:h-28">
                        {item.imageUrl ? <Image src={item.imageUrl} alt={item.name} fill className="object-cover" unoptimized /> : null}
                      </div>
                      <p className="mt-2 line-clamp-1 text-xs font-semibold text-[#2f1c12] sm:text-sm">{item.name}</p>
                      <p className="mt-0.5 text-xs font-semibold text-[#5b2d17]">PKR {Number(item.price) || 0}</p>
                    </Link>
                    <button
                      type="button"
                      onClick={async () => {
                        await addItemToCart(item._id, "", 1);
                        const snapshot = await fetchCartSnapshot();
                        setCart(snapshot);
                      }}
                      className="mt-2 inline-flex h-8 w-full items-center justify-center rounded-lg bg-[#111] px-2 text-[11px] font-semibold text-white hover:bg-black sm:h-9 sm:text-xs"
                    >
                      Add
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>
        ) : null}
      </section>

      {(cart?.items?.length || 0) > 0 ? (
        <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+72px)] z-40 border-t border-[#eadccf] bg-[#fffaf4]/97 px-4 pb-3 pt-2 backdrop-blur lg:hidden">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] text-[#7d6b5d]">
                {cart?.totalItems || 0} item{(cart?.totalItems || 0) === 1 ? "" : "s"}
              </p>
              <p className="text-sm font-semibold text-[#2f1c12]">
                Subtotal <span className="ml-1 text-[#b84a2b]">PKR {cart?.subtotal || 0}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => void submitOrder()}
              disabled={submitting || !form.fullName.trim() || !form.phone.trim() || !form.address.trim()}
              className="rounded-xl bg-[#111] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-55"
            >
              {submitting ? "Saving..." : "Proceed"}
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}

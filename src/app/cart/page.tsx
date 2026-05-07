"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Minus, Plus, Trash2 } from "lucide-react";

import SiteHeader from "@/components/public/site-header";
import { API_BASE_URL } from "@/lib/admin-auth";
import { getOrCreateCartId, markCartAsRead } from "@/lib/cart-client";
import ModernLoader from "@/components/ui/modern-loader";

type CartItem = {
  kind?: "product" | "deal";
  product?: {
    _id: string;
    name: string;
    imageUrl?: string;
  } | null;
  deal?: {
    _id: string;
    title: string;
    imageUrl?: string;
  } | null;
  title?: string;
  imageUrl?: string;
  qty: number;
  size?: string;
  unitPrice: number;
  lineTotal: number;
};

type CartPayload = {
  cartId: string;
  items: CartItem[];
  subtotal: number;
  totalItems: number;
};

export default function CartPage() {
  const router = useRouter();
  const [cart, setCart] = useState<CartPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadCart = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const cartId = getOrCreateCartId();
      const res = await fetch(`${API_BASE_URL}/cart/${cartId}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Unable to load cart.");
      setCart(data.cart || null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load cart.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    markCartAsRead();
    loadCart();
  }, [loadCart]);

  const updateQty = async (item: CartItem, qty: number) => {
    if (qty < 1) return;
    try {
      setSaving(true);
      const cartId = getOrCreateCartId();
      const res = await fetch(`${API_BASE_URL}/cart/${cartId}/items`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qty,
          size: item.size || "",
          productId: item.kind === "deal" ? undefined : item.product?._id,
          dealId: item.kind === "deal" ? item.deal?._id : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Unable to update quantity.");
      setCart(data.cart || null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to update quantity.");
    } finally {
      setSaving(false);
    }
  };

  const removeItem = async (item: CartItem) => {
    const prev = cart;
    if (!prev) return;
    const nextItems = prev.items.filter((it) => {
      if (item.kind === "deal") return (it.deal?._id || "") !== (item.deal?._id || "");
      return !((it.product?._id || "") === (item.product?._id || "") && (it.size || "") === (item.size || ""));
    });
    const nextTotalItems = nextItems.reduce((s, it) => s + Math.max(1, Number(it.qty) || 1), 0);
    const nextSubtotal = nextItems.reduce((s, it) => s + (Number(it.lineTotal) || 0), 0);
    setCart({ ...prev, items: nextItems, totalItems: nextTotalItems, subtotal: nextSubtotal });
    try {
      setSaving(true);
      const cartId = getOrCreateCartId();
      const res = await fetch(`${API_BASE_URL}/cart/${cartId}/items`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          size: item.size || "",
          productId: item.kind === "deal" ? undefined : item.product?._id,
          dealId: item.kind === "deal" ? item.deal?._id : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Unable to remove item.");
      setCart(data.cart || null);
    } catch (e) {
      setCart(prev);
      setError(e instanceof Error ? e.message : "Unable to remove item.");
    } finally {
      setSaving(false);
    }
  };

  const clearCart = async () => {
    const prev = cart;
    if (prev) {
      setCart({ ...prev, items: [], totalItems: 0, subtotal: 0 });
    }
    try {
      setSaving(true);
      const cartId = getOrCreateCartId();
      const res = await fetch(`${API_BASE_URL}/cart/${cartId}/clear`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Unable to clear cart.");
      setCart(data.cart || null);
    } catch (e) {
      setCart(prev);
      setError(e instanceof Error ? e.message : "Unable to clear cart.");
    } finally {
      setSaving(false);
    }
  };

  const cartItemsLine = (cart?.items || [])
    .map((it) => {
      const label = it.kind === "deal" ? it.deal?.title || it.title || "Deal" : it.product?.name || it.title || "Item";
      return `${Math.max(1, Number(it.qty) || 1)}x ${label}`;
    })
    .slice(0, 6)
    .join(" • ");

  return (
    <main className="min-h-screen bg-[#f5efe8] text-[#2f1c12] antialiased">
      <SiteHeader />
      <section className="mx-auto max-w-7xl px-4 pb-36 pt-[96px] sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-[family-name:var(--font-poppins)] text-3xl font-semibold text-[#111]">Your Cart</h1>
          <button
            type="button"
            onClick={clearCart}
            disabled={saving || !cart?.items?.length}
            className="rounded-xl border border-[#dccbbb] bg-white px-4 py-2 text-sm font-semibold text-[#5b2d17] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Clear Cart
          </button>
        </div>

        {loading ? <ModernLoader className="mt-6" label="Loading cart..." /> : null}
        {error ? <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p> : null}

        {!loading && (cart?.items?.length || 0) === 0 ? (
          <div className="mt-8 rounded-3xl border border-[#eadccf] bg-white p-8 text-center">
            <p className="text-sm text-[#6f5647]">Cart is empty right now.</p>
            <Link
              href="/menu"
              className="mt-4 inline-flex rounded-xl bg-[#5b2d17] px-5 py-2.5 text-sm font-semibold !text-white"
            >
              Browse Menu
            </Link>
          </div>
        ) : null}

        {(cart?.items?.length || 0) > 0 ? (
          <div className="mt-6">
            <div className="space-y-3">
              {cart?.items.map((item) => (
                <article
                  key={`${item.kind || "product"}-${item.deal?._id || item.product?._id || item.title || "item"}-${item.size || "base"}`}
                  className="flex items-center gap-2 rounded-2xl border border-[#eadccf] bg-white p-3 sm:gap-3 sm:p-4"
                >
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-[#f6ece2]">
                    {(item.kind === "deal" ? item.deal?.imageUrl || item.imageUrl : item.product?.imageUrl || item.imageUrl) ? (
                      <Image
                        src={(item.kind === "deal" ? item.deal?.imageUrl || item.imageUrl : item.product?.imageUrl || item.imageUrl) as string}
                        alt={item.kind === "deal" ? item.deal?.title || item.title || "Deal" : item.product?.name || item.title || "Item"}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-sm font-semibold text-[#24130c]">
                      {item.kind === "deal" ? item.deal?.title || item.title || "Deal" : item.product?.name || item.title || "Item"}
                    </p>
                    <p className="text-xs text-[#7d6b5d]">
                      {item.kind !== "deal" && item.size ? `${item.size.toUpperCase()} • ` : ""}PKR {item.unitPrice}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 rounded-xl border border-[#eadccf] px-1 py-1">
                    <button
                      type="button"
                      onClick={() => updateQty(item, Math.max(1, item.qty - 1))}
                      className="rounded-lg p-1.5 text-[#5b2d17] hover:bg-[#f6ece2]"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="min-w-6 text-center text-sm font-semibold">{item.qty}</span>
                    <button
                      type="button"
                      onClick={() => updateQty(item, item.qty + 1)}
                      className="rounded-lg p-1.5 text-[#5b2d17] hover:bg-[#f6ece2]"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="w-16 text-right text-sm font-semibold text-[#5b2d17] sm:w-20">PKR {item.lineTotal}</p>
                  <button
                    type="button"
                    onClick={() => removeItem(item)}
                    className="rounded-lg p-2 text-[#9b4f2d] hover:bg-[#fdf2eb]"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </article>
              ))}
            </div>

          </div>
        ) : null}
      </section>

      {(cart?.items?.length || 0) > 0 ? (
        <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+56px)] z-40 border-t border-[#eadccf] bg-[#fffaf4]/97 px-4 pb-2 pt-2 backdrop-blur lg:bottom-0 lg:z-50 lg:pb-[max(14px,env(safe-area-inset-bottom))]">
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
    </main>
  );
}


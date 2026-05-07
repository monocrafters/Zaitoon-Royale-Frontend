"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { ChevronDown, ChevronUp, Save } from "lucide-react";

import { API_BASE_URL, getAdminToken } from "@/lib/admin-auth";
import ModernLoader from "@/components/ui/modern-loader";

type Category = {
  _id: string;
  name: string;
  imageUrl?: string;
  menuOrder?: number;
};

type Product = {
  _id: string;
  name: string;
  imageUrl?: string;
  menuOrder?: number;
  category?: { _id: string; name: string };
};

export default function AdminMenuOrderingPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [openCats, setOpenCats] = useState<Record<string, boolean>>({});

  const token = useMemo(() => getAdminToken(), []);

  useEffect(() => {
    const load = async () => {
      if (!token) return;
      try {
        setError("");
        setLoading(true);
        const [catRes, prodRes] = await Promise.all([
          fetch(`${API_BASE_URL}/categories`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_BASE_URL}/products`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        const [catPayload, prodPayload] = await Promise.all([catRes.json(), prodRes.json()]);
        if (!catRes.ok) throw new Error(catPayload.message || "Unable to load categories.");
        if (!prodRes.ok) throw new Error(prodPayload.message || "Unable to load products.");
        setCategories(catPayload.categories || []);
        setProducts(prodPayload.products || []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unable to load menu ordering.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token]);

  const grouped = useMemo(() => {
    const catMap = new Map<string, Product[]>();
    for (const p of products) {
      const cid = p.category?._id || "other";
      if (!catMap.has(cid)) catMap.set(cid, []);
      catMap.get(cid)!.push(p);
    }
    return catMap;
  }, [products]);

  const setCategoryOrder = (id: string, value: string) => {
    const v = Number(value);
    setCategories((prev) => prev.map((c) => (c._id === id ? { ...c, menuOrder: Number.isFinite(v) ? v : 0 } : c)));
  };

  const setProductOrder = (id: string, value: string) => {
    const v = Number(value);
    setProducts((prev) => prev.map((p) => (p._id === id ? { ...p, menuOrder: Number.isFinite(v) ? v : 0 } : p)));
  };

  const saveAll = async () => {
    if (!token) return;
    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const catOrders = categories.map((c) => ({ id: c._id, menuOrder: Number(c.menuOrder) || 0 }));
      const prodOrders = products.map((p) => ({ id: p._id, menuOrder: Number(p.menuOrder) || 0 }));

      const [catRes, prodRes] = await Promise.all([
        fetch(`${API_BASE_URL}/categories/menu-order`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ orders: catOrders }),
        }),
        fetch(`${API_BASE_URL}/products/menu-order`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ orders: prodOrders }),
        }),
      ]);

      const [catPayload, prodPayload] = await Promise.all([catRes.json(), prodRes.json()]);
      if (!catRes.ok) throw new Error(catPayload.message || "Unable to save category order.");
      if (!prodRes.ok) throw new Error(prodPayload.message || "Unable to save product order.");

      // Clear public caches so changes reflect instantly in same browser session.
      if (typeof window !== "undefined") {
        const keysToClear = [
          "restaurant_menu_products_cache_v1",
          "restaurant_menu_deals_cache_v1",
          "restaurant_public_categories_cache_v1",
          "restaurant_public_categories_cache_ts_v1",
          "restaurant_public_products_cache_v1",
          "restaurant_public_products_cache_ts_v1",
          "restaurant_public_deals_cache_v1",
          "restaurant_public_deals_cache_ts_v1",
        ];
        keysToClear.forEach((k) => window.sessionStorage.removeItem(k));
      }

      setSuccess("Menu ordering saved.");
      setTimeout(() => setSuccess(""), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save menu ordering.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="px-0 py-4 sm:mx-auto sm:max-w-6xl sm:px-6 sm:py-6">
        <div className="px-4 sm:rounded-3xl sm:border sm:border-[var(--border)] sm:bg-white sm:px-6 sm:py-5 sm:shadow-sm">
          <ModernLoader label="Loading menu ordering..." />
        </div>
      </main>
    );
  }

  return (
    <main className="px-0 py-4 sm:mx-auto sm:max-w-6xl sm:px-6 sm:py-6">
      <div className="flex items-center justify-between gap-2 px-4 sm:flex-wrap sm:items-end sm:gap-3 sm:px-0">
        <div className="min-w-0">
          <h1 className="truncate font-[family-name:var(--font-poppins)] text-xl font-semibold text-[var(--foreground)] sm:text-2xl">
            Menu
          </h1>
          <p className="mt-0.5 line-clamp-1 text-xs text-[var(--muted)] sm:mt-1 sm:text-sm">
            Set ordering numbers — lower numbers show first on the public menu.
          </p>
        </div>

        <button
          type="button"
          onClick={saveAll}
          disabled={saving}
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-[var(--primary)] px-3 text-xs font-semibold text-white shadow-sm transition hover:brightness-[1.02] disabled:opacity-60 sm:h-auto sm:rounded-2xl sm:px-4 sm:py-3 sm:text-sm"
        >
          <Save className="h-4 w-4" />
          {saving ? "Saving..." : "Save changes"}
        </button>
      </div>

      {error ? (
        <div className="mx-4 mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 sm:mx-0 sm:mt-4 sm:rounded-2xl sm:px-4 sm:py-3 sm:text-sm">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="mx-4 mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 sm:mx-0 sm:mt-4 sm:rounded-2xl sm:px-4 sm:py-3 sm:text-sm">
          {success}
        </div>
      ) : null}

      <div className="mt-3 space-y-2 px-0 sm:mt-5 sm:space-y-4">
        {categories.map((c) => {
          const open = Boolean(openCats[c._id]);
          const prods = grouped.get(c._id) || [];
          return (
            <section key={c._id} className="border-y border-[var(--border)] bg-white sm:rounded-3xl sm:border sm:shadow-sm">
              <div className="flex items-center gap-2 px-4 py-2.5 sm:gap-3 sm:p-5">
                <div className="relative h-10 w-10 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--primary-soft)] sm:h-12 sm:w-12 sm:rounded-2xl">
                  {c.imageUrl ? <Image src={c.imageUrl} alt={c.name} fill className="object-cover" unoptimized /> : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-[family-name:var(--font-poppins)] text-sm font-semibold text-[var(--foreground)] sm:text-base">
                    {c.name}
                  </p>
                  <p className="text-[11px] text-[var(--muted)] sm:text-xs">{prods.length} products</p>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <label className="text-[10px] font-semibold text-[var(--muted)] sm:text-xs">Order</label>
                  <input
                    value={String(Number(c.menuOrder) || 0)}
                    onChange={(e) => setCategoryOrder(c._id, e.target.value)}
                    className="h-8 w-14 rounded-lg border border-[var(--border)] bg-white px-2 text-xs font-semibold text-[var(--foreground)] sm:h-10 sm:w-20 sm:rounded-xl sm:px-3 sm:text-sm"
                    inputMode="numeric"
                  />
                  <button
                    type="button"
                    onClick={() => setOpenCats((p) => ({ ...p, [c._id]: !p[c._id] }))}
                    className="rounded-lg border border-[var(--border)] bg-white p-1.5 text-[var(--muted)] transition hover:bg-[var(--primary-soft)] sm:rounded-xl sm:p-2"
                    aria-label={open ? "Collapse products" : "Expand products"}
                  >
                    {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {open ? (
                <div className="border-t border-[var(--border)] px-4 py-2.5 sm:p-5">
                  {prods.length ? (
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {prods.map((p) => (
                        <div
                          key={p._id}
                          className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--primary-soft)]/20 p-2 sm:gap-3 sm:rounded-2xl sm:p-3"
                        >
                          <div className="relative h-9 w-9 overflow-hidden rounded-lg border border-[var(--border)] bg-white sm:h-10 sm:w-10 sm:rounded-xl">
                            {p.imageUrl ? (
                              <Image src={p.imageUrl} alt={p.name} fill className="object-cover" unoptimized />
                            ) : null}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-semibold text-[var(--foreground)] sm:text-sm">{p.name}</p>
                            <p className="text-[11px] text-[var(--muted)]">Menu order</p>
                          </div>
                          <input
                            value={String(Number(p.menuOrder) || 0)}
                            onChange={(e) => setProductOrder(p._id, e.target.value)}
                            className="h-8 w-14 rounded-lg border border-[var(--border)] bg-white px-2 text-xs font-semibold text-[var(--foreground)] sm:h-10 sm:w-20 sm:rounded-xl sm:px-3 sm:text-sm"
                            inputMode="numeric"
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-[var(--border)] bg-[var(--primary-soft)]/20 px-3 py-2 text-xs text-[var(--muted)] sm:rounded-2xl sm:px-4 sm:py-3 sm:text-sm">
                      No products in this category yet.
                    </div>
                  )}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
    </main>
  );
}


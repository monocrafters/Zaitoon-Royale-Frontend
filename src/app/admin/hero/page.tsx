"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { API_BASE_URL, getAdminToken } from "@/lib/admin-auth";
import ModernLoader from "@/components/ui/modern-loader";

type ProductOption = {
  _id: string;
  name: string;
  description?: string;
  price?: number;
  imageUrl?: string;
};

type DealOption = {
  _id: string;
  title: string;
  description?: string;
  imageUrl?: string;
  endsAt?: string | null;
  pricing?: { originalPrice: number; finalPrice: number };
  items?: Array<{ product: ProductOption; qty: number; size?: string }>;
  products?: ProductOption[];
};

type HeroSlide = {
  _id: string;
  kind: "product" | "deal";
  product?: ProductOption | null;
  deal?: DealOption | null;
  headline?: string;
  subheadline?: string;
  badge?: string;
  dealEndsAt?: string | null;
  isActive: boolean;
  order: number;
};

type SlideFormState = {
  product: string;
  deal: string;
  kind: "product" | "deal";
  badge: string;
  order: string;
  isActive: boolean;
};

const heroBadgeOptions = [
  "",
  "Trending",
  "Most Ordered",
  "Best Seller",
  "New Arrival",
  "Chef's Special",
  "Limited Deal",
];

const defaultForm: SlideFormState = {
  product: "",
  deal: "",
  kind: "product",
  badge: "",
  order: "",
  isActive: true,
};

function getDealProductsLabel(deal?: DealOption | null) {
  if (!deal) return "";
  const items = deal.items || [];
  if (items.length) {
    return items
      .map((it) => {
        const qty = Math.max(1, Number(it.qty) || 1);
        const size = String(it.size || "").trim();
        return `${qty}x ${size ? `${size} ` : ""}${it.product?.name || "Item"}`;
      })
      .join(" • ");
  }
  return (deal.products || []).map((p) => `1x ${p.name}`).join(" • ");
}

function getDealPrice(deal?: DealOption | null) {
  if (!deal) return { finalPrice: 0, originalPrice: 0 };
  if (deal.pricing) return deal.pricing;
  const base =
    (deal.items || []).reduce((s, it) => s + (Number(it.product?.price) || 0) * Math.max(1, Number(it.qty) || 1), 0) ||
    (deal.products || []).reduce((s, p) => s + (Number(p.price) || 0), 0);
  return { finalPrice: Math.max(0, Math.round(base)), originalPrice: Math.max(0, Math.round(base)) };
}

export default function AdminHeroPage() {
  const router = useRouter();
  const token = useMemo(() => getAdminToken(), []);

  const [loading, setLoading] = useState(true);
  const [slides, setSlides] = useState<HeroSlide[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [deals, setDeals] = useState<DealOption[]>([]);
  const [error, setError] = useState("");

  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingSlide, setEditingSlide] = useState<HeroSlide | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [form, setForm] = useState<SlideFormState>(defaultForm);
  const [formError, setFormError] = useState("");
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [dealPickerOpen, setDealPickerOpen] = useState(false);

  useEffect(() => {
    if (!token) {
      router.replace("/admin_Login");
      return;
    }

    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const [slidesRes, productsRes, dealsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/hero`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_BASE_URL}/products`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_BASE_URL}/deals`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);

        if (!slidesRes.ok || !productsRes.ok || !dealsRes.ok) throw new Error("Unable to load hero manager.");

        const slidesPayload = await slidesRes.json();
        const productsPayload = await productsRes.json();
        const dealsPayload = await dealsRes.json();
        setSlides(slidesPayload.slides || []);
        setProducts(productsPayload.products || []);
        setDeals(dealsPayload.deals || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load hero manager.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [router, token]);

  const openAdd = () => {
    setForm({ ...defaultForm, order: String((slides?.length || 0) + 1) });
    setFormError("");
    setAddOpen(true);
  };

  const openEdit = (slide: HeroSlide) => {
    setEditingSlide(slide);
    setForm({
      product: slide.product?._id || "",
      deal: slide.deal?._id || "",
      kind: slide.kind,
      badge: slide.badge || "",
      order: String(slide.order ?? ""),
      isActive: slide.isActive,
    });
    setFormError("");
    setEditOpen(true);
  };

  const reorder = async (next: HeroSlide[]) => {
    setSlides(next);
    try {
      await fetch(`${API_BASE_URL}/hero/reorder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ orderedIds: next.map((s) => s._id) }),
      });
    } catch {
      // optimistic reorder; ignore
    }
  };

  const move = (id: string, dir: "up" | "down") => {
    const idx = slides.findIndex((s) => s._id === id);
    if (idx < 0) return;
    const swapWith = dir === "up" ? idx - 1 : idx + 1;
    if (swapWith < 0 || swapWith >= slides.length) return;
    const next = [...slides];
    const temp = next[idx];
    next[idx] = next[swapWith];
    next[swapWith] = temp;
    reorder(next);
  };

  const toggleActive = async (slide: HeroSlide) => {
    const nextActive = !slide.isActive;
    setSlides((prev) => prev.map((s) => (s._id === slide._id ? { ...s, isActive: nextActive } : s)));
    try {
      await fetch(`${API_BASE_URL}/hero/${slide._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ isActive: nextActive }),
      });
    } catch {
      // ignore
    }
  };

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      const payload = {
        product: form.kind === "product" ? form.product : null,
        deal: form.kind === "deal" ? form.deal : null,
        kind: form.kind,
        badge: form.badge,
        order: Number(form.order) || undefined,
        isActive: form.isActive,
      };

      const res = await fetch(`${API_BASE_URL}/hero`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const out = await res.json();
      if (!res.ok) throw new Error(out.message || "Unable to create hero slide.");

      setSlides((prev) => [...prev, out.slide]);
      setAddOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Unable to create hero slide.");
    } finally {
      setSaving(false);
    }
  };

  const update = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingSlide) return;
    setSaving(true);
    setFormError("");
    try {
      const payload = {
        product: form.kind === "product" ? form.product : null,
        deal: form.kind === "deal" ? form.deal : null,
        kind: form.kind,
        badge: form.badge,
        order: Number(form.order) || undefined,
        isActive: form.isActive,
      };

      const res = await fetch(`${API_BASE_URL}/hero/${editingSlide._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const out = await res.json();
      if (!res.ok) throw new Error(out.message || "Unable to update hero slide.");

      setSlides((prev) => prev.map((s) => (s._id === out.slide._id ? out.slide : s)));
      setEditOpen(false);
      setEditingSlide(null);
      setForm(defaultForm);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Unable to update hero slide.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`${API_BASE_URL}/hero/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const out = await res.json();
      if (!res.ok) throw new Error(out.message || "Unable to delete hero slide.");
      setSlides((prev) => prev.filter((s) => s._id !== id));
    } finally {
      setDeletingId("");
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-white px-4 py-5 sm:rounded-3xl sm:px-6 sm:py-8">
        <ModernLoader label="Loading hero manager..." />
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate font-[family-name:var(--font-poppins)] text-xl font-semibold text-[var(--foreground)] sm:text-2xl">
            Hero Section
          </h2>
          <p className="mt-0.5 line-clamp-1 text-xs text-[var(--muted)] sm:text-sm">
            Pick products or deals to show on the homepage hero slider.
          </p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-[var(--primary)] px-3 text-xs font-medium text-white hover:bg-[#472212] sm:gap-2 sm:px-4 sm:py-2.5 sm:text-sm"
        >
          <Plus className="h-4 w-4" />
          Add Slide
        </button>
      </div>

      {error ? (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 sm:mt-4 sm:rounded-2xl sm:px-4 sm:py-3 sm:text-sm">
          {error}
        </div>
      ) : null}

      {slides.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-[var(--border)] bg-white p-6 text-center shadow-sm sm:mt-6 sm:rounded-3xl sm:p-10">
          <h3 className="font-[family-name:var(--font-poppins)] text-lg font-semibold text-[var(--foreground)] sm:text-xl">
            No hero slides yet
          </h3>
          <p className="mt-2 text-xs text-[var(--muted)] sm:text-sm">
            Add your first slide to display on the homepage hero.
          </p>
        </div>
      ) : (
        <div className="mt-4 grid gap-2 sm:mt-6 sm:gap-4 lg:grid-cols-2">
          {slides.map((slide, index) => (
            <div
              key={slide._id}
              className="border-y border-[var(--border)] bg-white px-3 py-3 sm:rounded-3xl sm:border sm:border-white/60 sm:bg-white/80 sm:p-4 sm:shadow-[0_10px_35px_rgba(36,24,15,0.08)] sm:backdrop-blur-md"
            >
              <div className="relative mb-2.5 h-28 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--primary-soft)] sm:mb-3 sm:h-36 sm:rounded-2xl">
                {(slide.kind === "product" ? slide.product?.imageUrl : slide.deal?.imageUrl || slide.deal?.items?.[0]?.product?.imageUrl) ? (
                  <Image
                    src={(slide.kind === "product" ? slide.product?.imageUrl : slide.deal?.imageUrl || slide.deal?.items?.[0]?.product?.imageUrl) as string}
                    alt={slide.kind === "product" ? slide.product?.name || "Hero product" : slide.deal?.title || "Hero deal"}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                ) : null}
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/15 to-transparent" />
                <div className="absolute left-3 top-3 flex items-center gap-2">
                  <span className="rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-white">
                    {slide.kind}
                  </span>
                  {slide.badge ? (
                    <span className="rounded-full bg-white/85 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-[#2f1c12]">
                      {slide.badge}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-start gap-2">
                  <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full border border-[var(--border)] bg-[var(--primary-soft)] sm:h-14 sm:w-14">
                    {(slide.kind === "product" ? slide.product?.imageUrl : slide.deal?.imageUrl || slide.deal?.items?.[0]?.product?.imageUrl) ? (
                      <Image
                        src={(slide.kind === "product" ? slide.product?.imageUrl : slide.deal?.imageUrl || slide.deal?.items?.[0]?.product?.imageUrl) as string}
                        alt={slide.kind === "product" ? slide.product?.name || "Hero product" : slide.deal?.title || "Hero deal"}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wide text-[var(--muted)] sm:text-xs">
                      {slide.kind === "deal" ? "Deal" : "Product"} • #{index + 1}
                    </p>
                    <p className="mt-1 line-clamp-1 font-[family-name:var(--font-poppins)] text-sm font-semibold text-[var(--foreground)] sm:text-lg">
                      {(slide.kind === "deal" ? slide.deal?.title : slide.product?.name) || "Slide"}
                    </p>
                    <p className="mt-0.5 line-clamp-1 text-[11px] text-[var(--muted)] sm:mt-1 sm:text-xs">
                      {slide.kind === "deal"
                        ? getDealProductsLabel(slide.deal) || slide.deal?.description || "—"
                        : slide.product?.description || "—"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 sm:gap-2">
                  <button
                    type="button"
                    onClick={() => openEdit(slide)}
                    className="rounded-lg border border-[var(--border)] p-1.5 text-[var(--muted)] hover:bg-[var(--primary-soft)] sm:rounded-xl sm:p-2"
                    aria-label="Edit slide"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(slide._id, "up")}
                    disabled={index === 0}
                    className="rounded-lg border border-[var(--border)] p-1.5 text-[var(--muted)] hover:bg-[var(--primary-soft)] disabled:opacity-40 sm:rounded-xl sm:p-2"
                    aria-label="Move up"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(slide._id, "down")}
                    disabled={index === slides.length - 1}
                    className="rounded-lg border border-[var(--border)] p-1.5 text-[var(--muted)] hover:bg-[var(--primary-soft)] disabled:opacity-40 sm:rounded-xl sm:p-2"
                    aria-label="Move down"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(slide._id)}
                    disabled={deletingId === slide._id}
                    className="rounded-lg border border-red-200 p-1.5 text-red-600 hover:bg-red-50 disabled:opacity-40 sm:rounded-xl sm:p-2"
                    aria-label="Delete slide"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 sm:mt-4 sm:gap-3">
                <div className="text-[11px] text-[var(--muted)] sm:text-xs">
                  {slide.kind === "deal" ? (
                    <span>
                      Price:{" "}
                      <span className="font-semibold text-[#2f1c12]">
                        PKR {getDealPrice(slide.deal).finalPrice}
                      </span>
                      {getDealPrice(slide.deal).originalPrice ? (
                        <span className="ml-2 text-[11px] text-[var(--muted)] line-through">
                          PKR {getDealPrice(slide.deal).originalPrice}
                        </span>
                      ) : null}
                    </span>
                  ) : (
                    <span>Price: PKR {slide.product?.price || 0}</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => toggleActive(slide)}
                  className={[
                    "rounded-full px-3 py-1 text-xs font-medium transition",
                    slide.isActive
                      ? "bg-[var(--primary-soft)] text-[var(--primary)]"
                      : "border border-[var(--border)] bg-white text-[var(--muted)] hover:bg-[var(--primary-soft)]",
                  ].join(" ")}
                >
                  {slide.isActive ? "Active" : "Inactive"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {addOpen && (
          <>
            <motion.button
              type="button"
              className="fixed inset-0 z-[70] bg-black/35"
              onClick={() => setAddOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.97 }}
              transition={{ duration: 0.2 }}
              className="fixed left-1/2 top-1/2 z-[71] max-h-[85vh] w-[92%] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl border border-[var(--border)] bg-white p-4 shadow-[0_22px_70px_rgba(36,24,15,0.2)] sm:p-6"
            >
              <h3 className="font-[family-name:var(--font-poppins)] text-2xl font-semibold text-[var(--foreground)]">
                Add Hero Slide
              </h3>
              <form className="mt-5 space-y-4" onSubmit={create}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-[var(--foreground)]">Type</span>
                    <select
                      value={form.kind}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          kind: e.target.value as SlideFormState["kind"],
                          product: e.target.value === "product" ? p.product : "",
                          deal: e.target.value === "deal" ? p.deal : "",
                        }))
                      }
                      className="w-full rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm outline-none focus:border-[#b98b6a]"
                    >
                      <option value="product">Product</option>
                      <option value="deal">Deal</option>
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-[var(--foreground)]">Badge (optional)</span>
                    <select
                      value={form.badge}
                      onChange={(e) => setForm((p) => ({ ...p, badge: e.target.value }))}
                      className="w-full rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm outline-none focus:border-[#b98b6a]"
                    >
                      {heroBadgeOptions.map((b) => (
                        <option key={`hero-badge-add-${b || "none"}`} value={b}>
                          {b || "None"}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="rounded-2xl border border-[var(--border)] bg-[#fcf8f3] px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                    {form.kind === "deal" ? "Selected Deal" : "Selected Product"}
                  </p>
                  <p className="mt-1 line-clamp-1 font-semibold text-[#2f1c12]">
                    {form.kind === "deal"
                      ? deals.find((d) => d._id === form.deal)?.title || "None"
                      : products.find((p) => p._id === form.product)?.name || "None"}
                  </p>
                  <button
                    type="button"
                    onClick={() => (form.kind === "deal" ? setDealPickerOpen(true) : setProductPickerOpen(true))}
                    className="mt-3 inline-flex w-full items-center justify-center rounded-xl bg-white px-3 py-2 text-sm font-semibold text-[#111] hover:bg-[#f4efe8]"
                  >
                    {form.kind === "deal" ? "Select Deal" : "Select Product"}
                  </button>
                </div>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-[var(--foreground)]">Order</span>
                  <select
                    value={form.order}
                    onChange={(e) => setForm((p) => ({ ...p, order: e.target.value }))}
                    className="w-full rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm outline-none focus:border-[#b98b6a]"
                  >
                    {Array.from({ length: (slides?.length || 0) + 1 }).map((_, i) => (
                      <option key={`hero-order-add-${i + 1}`} value={String(i + 1)}>
                        {i + 1}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-[var(--muted)]">New slide default: {slides.length + 1}</p>
                </label>

                <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
                  />
                  Active
                </label>

                {formError ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                    {formError}
                  </div>
                ) : null}

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setAddOpen(false)}
                    className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm text-[var(--muted)] hover:bg-[var(--primary-soft)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-xl bg-[var(--primary)] px-4 py-2 text-sm text-white hover:bg-[#472212] disabled:opacity-70"
                  >
                    {saving ? "Saving..." : "Add Slide"}
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editOpen && editingSlide && (
          <>
            <motion.button
              type="button"
              className="fixed inset-0 z-[70] bg-black/35"
              onClick={() => {
                setEditOpen(false);
                setEditingSlide(null);
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.97 }}
              transition={{ duration: 0.2 }}
              className="fixed left-1/2 top-1/2 z-[71] max-h-[85vh] w-[92%] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl border border-[var(--border)] bg-white p-4 shadow-[0_22px_70px_rgba(36,24,15,0.2)] sm:p-6"
            >
              <h3 className="font-[family-name:var(--font-poppins)] text-2xl font-semibold text-[var(--foreground)]">
                Edit Hero Slide
              </h3>
              <form className="mt-5 space-y-4" onSubmit={update}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-[var(--foreground)]">Type</span>
                    <select
                      value={form.kind}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          kind: e.target.value as SlideFormState["kind"],
                          product: e.target.value === "product" ? p.product : "",
                          deal: e.target.value === "deal" ? p.deal : "",
                        }))
                      }
                      className="w-full rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm outline-none focus:border-[#b98b6a]"
                    >
                      <option value="product">Product</option>
                      <option value="deal">Deal</option>
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-[var(--foreground)]">Badge (optional)</span>
                    <select
                      value={form.badge}
                      onChange={(e) => setForm((p) => ({ ...p, badge: e.target.value }))}
                      className="w-full rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm outline-none focus:border-[#b98b6a]"
                    >
                      {heroBadgeOptions.map((b) => (
                        <option key={`hero-badge-edit-${b || "none"}`} value={b}>
                          {b || "None"}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="rounded-2xl border border-[var(--border)] bg-[#fcf8f3] px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                    {form.kind === "deal" ? "Selected Deal" : "Selected Product"}
                  </p>
                  <p className="mt-1 line-clamp-1 font-semibold text-[#2f1c12]">
                    {form.kind === "deal"
                      ? deals.find((d) => d._id === form.deal)?.title || "None"
                      : products.find((p) => p._id === form.product)?.name || "None"}
                  </p>
                  <button
                    type="button"
                    onClick={() => (form.kind === "deal" ? setDealPickerOpen(true) : setProductPickerOpen(true))}
                    className="mt-3 inline-flex w-full items-center justify-center rounded-xl bg-white px-3 py-2 text-sm font-semibold text-[#111] hover:bg-[#f4efe8]"
                  >
                    {form.kind === "deal" ? "Select Deal" : "Select Product"}
                  </button>
                </div>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-[var(--foreground)]">Order</span>
                  <select
                    value={form.order}
                    onChange={(e) => setForm((p) => ({ ...p, order: e.target.value }))}
                    className="w-full rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm outline-none focus:border-[#b98b6a]"
                  >
                    {Array.from({ length: (slides?.length || 0) + 1 }).map((_, i) => (
                      <option key={`hero-order-edit-${i + 1}`} value={String(i + 1)}>
                        {i + 1}
                      </option>
                    ))}
                  </select>
                </label>

                {/* Headline/Subheadline overrides removed (use product/deal data) */}

                <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
                  />
                  Active
                </label>

                {formError ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                    {formError}
                  </div>
                ) : null}

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditOpen(false);
                      setEditingSlide(null);
                    }}
                    className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm text-[var(--muted)] hover:bg-[var(--primary-soft)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-xl bg-[var(--primary)] px-4 py-2 text-sm text-white hover:bg-[#472212] disabled:opacity-70"
                  >
                    {saving ? "Updating..." : "Save Changes"}
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {productPickerOpen ? (
          <>
            <motion.button
              type="button"
              className="fixed inset-0 z-[80] bg-black/40"
              onClick={() => setProductPickerOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.97 }}
              className="fixed left-1/2 top-1/2 z-[81] max-h-[82vh] w-[92%] max-w-5xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl border border-[var(--border)] bg-white p-4 shadow-[0_22px_70px_rgba(36,24,15,0.25)] sm:p-6"
            >
              <div className="flex items-center justify-between gap-3">
                <h4 className="font-[family-name:var(--font-poppins)] text-xl font-semibold text-[var(--foreground)]">
                  Select Product
                </h4>
                <button
                  type="button"
                  onClick={() => setProductPickerOpen(false)}
                  className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm text-[var(--muted)] hover:bg-[var(--primary-soft)]"
                >
                  Close
                </button>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {products.map((p) => (
                  <button
                    key={`hero-product-${p._id}`}
                    type="button"
                    onClick={() => {
                      setForm((prev) => ({ ...prev, product: p._id }));
                      setProductPickerOpen(false);
                    }}
                    className="group relative overflow-hidden rounded-2xl border border-[var(--border)] bg-white p-3 text-left transition hover:bg-[#fcf8f3]"
                  >
                    <div className="relative h-24 overflow-hidden rounded-xl border border-[var(--border)] bg-[#fcf8f3]">
                      {p.imageUrl ? <Image src={p.imageUrl} alt={p.name} fill className="object-cover transition group-hover:scale-105" unoptimized /> : null}
                    </div>
                    <p className="mt-2 line-clamp-1 font-semibold text-[#2f1c12]">{p.name}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-[var(--muted)]">{p.description || "—"}</p>
                    <p className="mt-2 text-xs font-semibold text-[#5b2d17]">PKR {p.price ?? 0}</p>
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {dealPickerOpen ? (
          <>
            <motion.button
              type="button"
              className="fixed inset-0 z-[80] bg-black/40"
              onClick={() => setDealPickerOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.97 }}
              className="fixed left-1/2 top-1/2 z-[81] max-h-[82vh] w-[92%] max-w-5xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl border border-[var(--border)] bg-white p-4 shadow-[0_22px_70px_rgba(36,24,15,0.25)] sm:p-6"
            >
              <div className="flex items-center justify-between gap-3">
                <h4 className="font-[family-name:var(--font-poppins)] text-xl font-semibold text-[var(--foreground)]">
                  Select Deal
                </h4>
                <button
                  type="button"
                  onClick={() => setDealPickerOpen(false)}
                  className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm text-[var(--muted)] hover:bg-[var(--primary-soft)]"
                >
                  Close
                </button>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {deals.map((d) => {
                  const img = d.imageUrl || d.items?.[0]?.product?.imageUrl || "";
                  const productsText = getDealProductsLabel(d);
                  const pricing = getDealPrice(d);
                  return (
                    <button
                      key={`hero-deal-${d._id}`}
                      type="button"
                      onClick={() => {
                        setForm((prev) => ({ ...prev, deal: d._id }));
                        setDealPickerOpen(false);
                      }}
                      className="group relative overflow-hidden rounded-2xl border border-[var(--border)] bg-white p-3 text-left transition hover:bg-[#fcf8f3]"
                    >
                      <div className="relative h-24 overflow-hidden rounded-xl border border-[var(--border)] bg-[#fcf8f3]">
                        {img ? <Image src={img} alt={d.title} fill className="object-cover transition group-hover:scale-105" unoptimized /> : null}
                      </div>
                      <p className="mt-2 line-clamp-1 font-semibold text-[#2f1c12]">{d.title}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-[var(--muted)]">{productsText || d.description || "—"}</p>
                      <div className="mt-2 flex items-center justify-between gap-2 text-[11px]">
                        <p className="font-semibold text-[#5b2d17]">PKR {pricing.finalPrice}</p>
                        <p className="text-[10px] text-[var(--muted)] line-through">PKR {pricing.originalPrice}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </>
  );
}


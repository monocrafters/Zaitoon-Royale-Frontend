"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown, ArrowUp, Minus, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { API_BASE_URL, getAdminToken } from "@/lib/admin-auth";
import ModernLoader from "@/components/ui/modern-loader";

type ProductOption = {
  _id: string;
  name: string;
  price?: number;
  hasSizePricing?: boolean;
  sizePrices?: { small?: number; medium?: number; large?: number; xlarge?: number };
  imageUrl?: string;
  description?: string;
};

type DealPricing = {
  originalPrice: number;
  finalPrice: number;
};

type Deal = {
  _id: string;
  items?: Array<{ product: ProductOption; qty: number; size?: DealFormItem["size"] }>;
  products?: ProductOption[];
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
  ctaHref?: string;
  detailHref?: string;
  pricing?: DealPricing;
  isActive: boolean;
  order: number;
};

type DealFormItem = { productId: string; qty: number; size?: "small" | "medium" | "large" | "xlarge" | "" };

type DealFormState = {
  items: DealFormItem[];
  title: string;
  subtitle: string;
  description: string;
  badge: string;
  discountType: "percent" | "flat" | "none";
  discountValue: string;
  couponCode: string;
  imageUrl: string;
  startsAt: string;
  endsAt: string;
  theme: "warm" | "dark" | "green" | "purple" | "blue";
  ctaLabel: string;
  ctaHref: string;
  isActive: boolean;
};

const defaultForm: DealFormState = {
  items: [],
  title: "",
  subtitle: "",
  description: "",
  badge: "Limited Deal",
  discountType: "percent",
  discountValue: "20",
  couponCode: "",
  imageUrl: "",
  startsAt: "",
  endsAt: "",
  theme: "warm",
  ctaLabel: "See Deal",
  ctaHref: "#offers",
  isActive: true,
};

const dealBadgeOptions = [
  "",
  "Trending",
  "Most Ordered",
  "Best Seller",
  "New Arrival",
  "Chef's Special",
  "Limited Deal",
] as const;

function computeDealPricing(basePrice: number, discountType: DealFormState["discountType"], discountValue: string) {
  const base = Number(basePrice) || 0;
  const v = Number(discountValue) || 0;
  if (discountType === "percent") return { originalPrice: base, finalPrice: Math.max(0, Math.round(base - (base * Math.max(0, v)) / 100)) };
  if (discountType === "flat") return { originalPrice: base, finalPrice: Math.max(0, Math.round(base - Math.max(0, v))) };
  return { originalPrice: base, finalPrice: Math.max(0, Math.round(base)) };
}

export default function AdminDealsPage() {
  const router = useRouter();
  const token = useMemo(() => getAdminToken(), []);

  const [loading, setLoading] = useState(true);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [error, setError] = useState("");

  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<Deal | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState<DealFormState>(defaultForm);
  const [imageUploading, setImageUploading] = useState(false);

  useEffect(() => {
    if (!token) {
      router.replace("/admin_Login");
      return;
    }

    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const [dealsRes, productsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/deals`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_BASE_URL}/products`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        const dealsPayload = await dealsRes.json();
        const productsPayload = await productsRes.json();
        if (!dealsRes.ok) throw new Error(dealsPayload.message || "Unable to load deals.");
        if (!productsRes.ok) throw new Error(productsPayload.message || "Unable to load products.");
        setDeals(dealsPayload.deals || []);
        setProducts(productsPayload.products || []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unable to load deals.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [router, token]);

  const onLocalImageSelect = async (file: File | null) => {
    if (!file) return;
    setFormError("");
    setImageUploading(true);
    try {
      const body = new FormData();
      body.append("image", file);
      const res = await fetch(`${API_BASE_URL}/upload/image`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body,
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.message || "Unable to upload image.");
      setForm((p) => ({ ...p, imageUrl: payload.url }));
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Unable to upload image.");
    } finally {
      setImageUploading(false);
    }
  };

  const openAdd = () => {
    setForm(defaultForm);
    setFormError("");
    setAddOpen(true);
  };

  const openEdit = (deal: Deal) => {
    const normalizedItems =
      deal.items && deal.items.length
        ? deal.items
            .map((it) => ({
              productId: it.product?._id,
              qty: Math.max(1, Number(it.qty) || 1),
              size: (it.size || "") as DealFormItem["size"],
            }))
            .filter((it) => it.productId)
        : (deal.products || []).map((p) => ({ productId: p._id, qty: 1, size: "" as DealFormItem["size"] }));

    setEditing(deal);
    setForm({
      items: normalizedItems,
      title: deal.title || "",
      subtitle: deal.subtitle || "",
      description: deal.description || "",
      badge: deal.badge || "",
      discountType: deal.discountType || "percent",
      discountValue: String(deal.discountValue ?? ""),
      couponCode: deal.couponCode || "",
      imageUrl: deal.imageUrl || "",
      startsAt: deal.startsAt ? new Date(deal.startsAt).toISOString().slice(0, 16) : "",
      endsAt: deal.endsAt ? new Date(deal.endsAt).toISOString().slice(0, 16) : "",
      theme: deal.theme || "warm",
      ctaLabel: deal.ctaLabel || "See Deal",
      ctaHref: deal.ctaHref || "#offers",
      isActive: deal.isActive,
    });
    setFormError("");
    setEditOpen(true);
  };

  const reorder = async (next: Deal[]) => {
    setDeals(next);
    try {
      await fetch(`${API_BASE_URL}/deals/reorder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ orderedIds: next.map((d) => d._id) }),
      });
    } catch {
      // optimistic
    }
  };

  const move = (id: string, dir: "up" | "down") => {
    const idx = deals.findIndex((d) => d._id === id);
    if (idx < 0) return;
    const swapWith = dir === "up" ? idx - 1 : idx + 1;
    if (swapWith < 0 || swapWith >= deals.length) return;
    const next = [...deals];
    const temp = next[idx];
    next[idx] = next[swapWith];
    next[swapWith] = temp;
    reorder(next);
  };

  const toggleActive = async (deal: Deal) => {
    const nextActive = !deal.isActive;
    setDeals((prev) => prev.map((d) => (d._id === deal._id ? { ...d, isActive: nextActive } : d)));
    try {
      await fetch(`${API_BASE_URL}/deals/${deal._id}`, {
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
        ...form,
        items: form.items,
        discountValue: Number(form.discountValue) || 0,
        startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
      };
      const res = await fetch(`${API_BASE_URL}/deals`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const out = await res.json();
      if (!res.ok) throw new Error(out.message || "Unable to create deal.");
      setDeals((prev) => [...prev, out.deal]);
      setAddOpen(false);
    } catch (e2) {
      setFormError(e2 instanceof Error ? e2.message : "Unable to create deal.");
    } finally {
      setSaving(false);
    }
  };

  const update = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    setFormError("");
    try {
      const payload = {
        ...form,
        items: form.items,
        discountValue: Number(form.discountValue) || 0,
        startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
      };
      const res = await fetch(`${API_BASE_URL}/deals/${editing._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const out = await res.json();
      if (!res.ok) throw new Error(out.message || "Unable to update deal.");
      setDeals((prev) => prev.map((d) => (d._id === out.deal._id ? out.deal : d)));
      setEditOpen(false);
      setEditing(null);
      setForm(defaultForm);
    } catch (e2) {
      setFormError(e2 instanceof Error ? e2.message : "Unable to update deal.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`${API_BASE_URL}/deals/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const out = await res.json();
      if (!res.ok) throw new Error(out.message || "Unable to delete deal.");
      setDeals((prev) => prev.filter((d) => d._id !== id));
    } finally {
      setDeletingId("");
    }
  };

  if (loading) {
    return (
      <div className="rounded-3xl border border-[var(--border)] bg-white px-6 py-8">
        <ModernLoader label="Loading deals..." />
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-poppins)] text-2xl font-semibold text-[var(--foreground)]">
            Deals
          </h2>
          <p className="text-sm text-[var(--muted)]">Create and manage homepage deals.</p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#472212]"
        >
          <Plus className="h-4 w-4" />
          Add Deal
        </button>
      </div>

      {error ? (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      ) : null}

      {deals.length === 0 ? (
        <div className="mt-6 rounded-3xl border border-dashed border-[var(--border)] bg-white p-10 text-center shadow-sm">
          <h3 className="font-[family-name:var(--font-poppins)] text-xl font-semibold text-[var(--foreground)]">
            No deals yet
          </h3>
          <p className="mt-2 text-sm text-[var(--muted)]">Add your first deal to show on the homepage.</p>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {deals.map((deal, index) => (
            <div
              key={deal._id}
              className="rounded-3xl border border-white/60 bg-white/80 p-4 shadow-[0_10px_35px_rgba(36,24,15,0.08)] backdrop-blur-md"
            >
              <div className="relative mb-3 h-36 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--primary-soft)]">
                {deal.imageUrl ? (
                  <Image src={deal.imageUrl} alt={deal.title} fill className="object-cover" unoptimized />
                ) : null}
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/15 to-transparent" />
                <div className="absolute left-3 top-3 flex items-center gap-2">
                  {deal.badge ? (
                    <span className="rounded-full bg-white/85 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-[#2f1c12]">
                      {deal.badge}
                    </span>
                  ) : null}
                  {deal.discountType !== "none" ? (
                    <span className="rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-white">
                      {deal.discountType === "percent" ? `${deal.discountValue || 0}% OFF` : `PKR ${deal.discountValue || 0} OFF`}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Deal • #{index + 1}</p>
                  <p className="mt-1 line-clamp-1 font-[family-name:var(--font-poppins)] text-lg font-semibold text-[var(--foreground)]">
                    {deal.title}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs text-[var(--muted)]">{deal.description || "—"}</p>
                  {deal.items?.length ? (
                    <p className="mt-2 line-clamp-2 text-xs font-medium text-[#5b2d17]">
                      Products:{" "}
                      {deal.items
                        .map((it) => {
                          const qty = Math.max(1, Number(it.qty) || 1);
                          const size = String(it.size || "").trim();
                          const label = size ? `${size} ${it.product?.name || "Item"}` : it.product?.name || "Item";
                          return `${qty}x ${label}`;
                        })
                        .join(", ")}
                    </p>
                  ) : deal.products?.length ? (
                    <p className="mt-2 line-clamp-2 text-xs font-medium text-[#5b2d17]">
                      Products: {deal.products.map((p) => `1x ${p.name}`).join(", ")}
                    </p>
                  ) : null}
                  {deal.pricing ? (
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      Price:{" "}
                      <span className="font-semibold text-[#2f1c12]">PKR {deal.pricing.finalPrice}</span>{" "}
                      <span className="ml-1 text-[11px] text-[var(--muted)] line-through">PKR {deal.pricing.originalPrice}</span>
                    </p>
                  ) : null}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openEdit(deal)}
                    className="rounded-xl border border-[var(--border)] p-2 text-[var(--muted)] hover:bg-[var(--primary-soft)]"
                    aria-label="Edit deal"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(deal._id, "up")}
                    disabled={index === 0}
                    className="rounded-xl border border-[var(--border)] p-2 text-[var(--muted)] hover:bg-[var(--primary-soft)] disabled:opacity-40"
                    aria-label="Move up"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(deal._id, "down")}
                    disabled={index === deals.length - 1}
                    className="rounded-xl border border-[var(--border)] p-2 text-[var(--muted)] hover:bg-[var(--primary-soft)] disabled:opacity-40"
                    aria-label="Move down"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(deal._id)}
                    disabled={deletingId === deal._id}
                    className="rounded-xl border border-red-200 p-2 text-red-600 hover:bg-red-50 disabled:opacity-40"
                    aria-label="Delete deal"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-[var(--muted)]">
                  {deal.endsAt ? <span>Ends: {new Date(deal.endsAt).toLocaleString()}</span> : <span>No end time</span>}
                </div>
                <button
                  type="button"
                  onClick={() => toggleActive(deal)}
                  className={[
                    "rounded-full px-3 py-1 text-xs font-medium transition",
                    deal.isActive
                      ? "bg-[var(--primary-soft)] text-[var(--primary)]"
                      : "border border-[var(--border)] bg-white text-[var(--muted)] hover:bg-[var(--primary-soft)]",
                  ].join(" ")}
                >
                  {deal.isActive ? "Active" : "Inactive"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <DealModal
        open={addOpen}
        title="Add Deal"
        submitLabel={saving ? "Saving..." : "Add Deal"}
        onClose={() => setAddOpen(false)}
        onSubmit={create}
        form={form}
        setForm={setForm}
        products={products}
        error={formError}
        saving={saving}
        onLocalImageSelect={onLocalImageSelect}
        imageUploading={imageUploading}
      />

      <DealModal
        open={editOpen}
        title="Edit Deal"
        submitLabel={saving ? "Updating..." : "Save Changes"}
        onClose={() => {
          setEditOpen(false);
          setEditing(null);
        }}
        onSubmit={update}
        form={form}
        setForm={setForm}
        products={products}
        error={formError}
        saving={saving}
        onLocalImageSelect={onLocalImageSelect}
        imageUploading={imageUploading}
      />
    </>
  );
}

type DealModalProps = {
  open: boolean;
  title: string;
  submitLabel: string;
  onClose: () => void;
  onSubmit: (e: FormEvent) => void;
  form: DealFormState;
  setForm: React.Dispatch<React.SetStateAction<DealFormState>>;
  products: ProductOption[];
  error: string;
  saving: boolean;
  onLocalImageSelect: (file: File | null) => void;
  imageUploading: boolean;
};

function DealModal({
  open,
  title,
  submitLabel,
  onClose,
  onSubmit,
  form,
  setForm,
  products,
  error,
  saving,
  onLocalImageSelect,
  imageUploading,
}: DealModalProps) {
  const selectedIds = useMemo(() => form.items.map((it) => it.productId), [form.items]);
  const selectedProducts = useMemo(
    () => products.filter((p) => selectedIds.includes(p._id)),
    [products, selectedIds]
  );
  const base = form.items.reduce((sum, it) => {
    const p = products.find((x) => x._id === it.productId);
    const basePrice = Number(p?.price) || 0;
    const size = String(it.size || "").trim() as DealFormItem["size"];
    const pick = (k: "small" | "medium" | "large" | "xlarge") => Number(p?.sizePrices?.[k]) || 0;
    const unit =
      p?.hasSizePricing
        ? (size && pick(size) > 0 ? pick(size) : pick("medium") > 0 ? pick("medium") : basePrice)
        : basePrice;
    const qty = Math.max(1, Number(it.qty) || 1);
    return sum + unit * qty;
  }, 0);
  const preview = computeDealPricing(base, form.discountType, form.discountValue);
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [draftItems, setDraftItems] = useState<DealFormItem[]>(form.items);

  if (!open) return null;

  const openProductPicker = () => {
    setDraftItems(form.items);
    setProductPickerOpen(true);
  };

  const toggleDraftProduct = (id: string) => {
    setDraftItems((prev) => {
      const exists = prev.find((x) => x.productId === id);
      if (exists) return prev.filter((x) => x.productId !== id);
      const p = products.find((x) => x._id === id);
      const size = p?.hasSizePricing ? ("medium" as DealFormItem["size"]) : ("" as DealFormItem["size"]);
      return [...prev, { productId: id, qty: 1, size }];
    });
  };

  const setDraftSize = (id: string, size: DealFormItem["size"]) => {
    setDraftItems((prev) => prev.map((it) => (it.productId === id ? { ...it, size } : it)));
  };

  const setFormSize = (id: string, size: DealFormItem["size"]) => {
    setForm((prev) => ({ ...prev, items: prev.items.map((it) => (it.productId === id ? { ...it, size } : it)) }));
  };

  const changeDraftQty = (id: string, delta: number) => {
    setDraftItems((prev) =>
      prev.map((it) => (it.productId === id ? { ...it, qty: Math.max(1, (Number(it.qty) || 1) + delta) } : it))
    );
  };

  const changeFormQty = (id: string, delta: number) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((it) => (it.productId === id ? { ...it, qty: Math.max(1, (Number(it.qty) || 1) + delta) } : it)),
    }));
  };

  return (
    <AnimatePresence>
      <motion.button
        key="deal-modal-backdrop"
        type="button"
        className="fixed inset-0 z-[70] bg-black/35"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />
      <motion.div
        key="deal-modal-content"
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.97 }}
        transition={{ duration: 0.2 }}
        className="fixed left-1/2 top-1/2 z-[71] max-h-[85vh] w-[92%] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl border border-[var(--border)] bg-white p-4 shadow-[0_22px_70px_rgba(36,24,15,0.2)] sm:p-6"
      >
        <h3 className="font-[family-name:var(--font-poppins)] text-2xl font-semibold text-[var(--foreground)]">
          {title}
        </h3>
        <form className="mt-5 space-y-4" onSubmit={onSubmit}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="block">
              <span className="mb-2 block text-sm font-medium text-[var(--foreground)]">Products</span>
              <button
                type="button"
                onClick={openProductPicker}
                className="inline-flex w-full items-center justify-center rounded-xl border border-[var(--border)] bg-[#fcf8f3] px-3 py-2.5 text-sm font-medium text-[#2f1c12] hover:bg-[var(--primary-soft)]"
              >
                Add Products
              </button>
              {selectedProducts.length ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedProducts.map((p) => {
                    const qty = Math.max(
                      1,
                      Number(form.items.find((it) => it.productId === p._id)?.qty) || 1
                    );
                    const size = String(form.items.find((it) => it.productId === p._id)?.size || "").trim();
                    const sizeLabel = size ? `${size} ` : "";
                    return (
                      <span
                        key={`selected-${p._id}`}
                        className="inline-flex items-center gap-2 rounded-full border border-[#e7d6c6] bg-white px-2.5 py-1 text-xs font-medium text-[#5b2d17]"
                      >
                        <span className="max-w-[200px] truncate">
                          {qty}x {p.hasSizePricing ? `${sizeLabel}${p.name}` : p.name}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          {p.hasSizePricing ? (
                            <select
                              value={String(form.items.find((it) => it.productId === p._id)?.size || "medium")}
                              onChange={(e) => setFormSize(p._id, e.target.value as DealFormItem["size"])}
                              className="h-6 rounded-full border border-[#eadccf] bg-[#fcf8f3] px-2 text-[11px] font-semibold text-[#5b2d17] outline-none"
                              aria-label="Select size"
                            >
                              <option value="small">Small</option>
                              <option value="medium">Medium</option>
                              <option value="large">Large</option>
                              <option value="xlarge">XL</option>
                            </select>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => changeFormQty(p._id, -1)}
                            className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[#eadccf] bg-[#fcf8f3] text-[#5b2d17] hover:bg-[var(--primary-soft)]"
                            aria-label="Decrease quantity"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => changeFormQty(p._id, 1)}
                            className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[#eadccf] bg-[#fcf8f3] text-[#5b2d17] hover:bg-[var(--primary-soft)]"
                            aria-label="Increase quantity"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </span>
                      </span>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-2 text-xs text-[var(--muted)]">No product selected yet.</p>
              )}
            </div>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[var(--foreground)]">Title</span>
              <input
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                className="w-full rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm outline-none focus:border-[#b98b6a]"
                placeholder={selectedProducts[0]?.name || ""}
              />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[var(--foreground)]">Badge (optional)</span>
              <select
                value={form.badge}
                onChange={(e) => setForm((p) => ({ ...p, badge: e.target.value }))}
                className="w-full rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm outline-none focus:border-[#b98b6a]"
              >
                {dealBadgeOptions.map((b) => (
                  <option key={b || "none"} value={b}>
                    {b ? b : "None"}
                  </option>
                ))}
              </select>
            </label>
            <div className="rounded-2xl border border-[var(--border)] bg-[#fcf8f3] px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">Price (auto)</p>
              <p className="mt-1 font-[family-name:var(--font-poppins)] text-lg font-semibold text-[#2f1c12]">
                PKR {preview.finalPrice}
                <span className="ml-2 text-xs font-medium text-[var(--muted)] line-through">PKR {preview.originalPrice}</span>
              </p>
            </div>
          </div>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-[var(--foreground)]">Description</span>
            <textarea
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              className="min-h-[90px] w-full rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm outline-none focus:border-[#b98b6a]"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[var(--foreground)]">Discount type</span>
              <select
                value={form.discountType}
                onChange={(e) => setForm((p) => ({ ...p, discountType: e.target.value as DealFormState["discountType"] }))}
                className="w-full rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm outline-none focus:border-[#b98b6a]"
              >
                <option value="percent">Percent</option>
                <option value="flat">Flat</option>
                <option value="none">None</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[var(--foreground)]">Value</span>
              <input
                type="number"
                value={form.discountValue}
                onChange={(e) => setForm((p) => ({ ...p, discountValue: e.target.value }))}
                className="w-full rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm outline-none focus:border-[#b98b6a]"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[var(--foreground)]">Coupon (optional)</span>
              <input
                value={form.couponCode}
                onChange={(e) => setForm((p) => ({ ...p, couponCode: e.target.value }))}
                className="w-full rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm outline-none focus:border-[#b98b6a]"
              />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[var(--foreground)]">Image URL</span>
              <input
                type="url"
                value={form.imageUrl}
                onChange={(e) => setForm((p) => ({ ...p, imageUrl: e.target.value }))}
                className="w-full rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm outline-none focus:border-[#b98b6a]"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[var(--foreground)]">Local image</span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => onLocalImageSelect(e.target.files?.[0] || null)}
                className="w-full rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm outline-none file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--primary-soft)] file:px-3 file:py-1.5 file:text-[var(--primary)]"
              />
            </label>
          </div>

          {imageUploading ? (
            <div className="rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--muted)]">
              Uploading image...
            </div>
          ) : null}

          {form.imageUrl ? (
            <div className="rounded-2xl border border-[var(--border)] bg-[#fcf8f3] p-3">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--muted)]">Preview</p>
              <div className="relative h-40 overflow-hidden rounded-xl border border-[var(--border)]">
                <Image src={form.imageUrl} alt="Deal preview" fill className="object-cover" unoptimized />
              </div>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[var(--foreground)]">Starts at (optional)</span>
              <input
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) => setForm((p) => ({ ...p, startsAt: e.target.value }))}
                className="w-full rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm outline-none focus:border-[#b98b6a]"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[var(--foreground)]">Ends at (optional)</span>
              <input
                type="datetime-local"
                value={form.endsAt}
                onChange={(e) => setForm((p) => ({ ...p, endsAt: e.target.value }))}
                className="w-full rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm outline-none focus:border-[#b98b6a]"
              />
            </label>
          </div>

          <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
            />
            Active
          </label>

          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
          ) : null}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm text-[var(--muted)] hover:bg-[var(--primary-soft)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-[var(--primary)] px-4 py-2 text-sm text-white hover:bg-[#472212] disabled:opacity-70"
            >
              {submitLabel}
            </button>
          </div>
        </form>

        <AnimatePresence>
          {productPickerOpen ? (
            <>
              <motion.button
                key="product-picker-backdrop"
                type="button"
                className="fixed inset-0 z-[80] bg-black/40"
                onClick={() => setProductPickerOpen(false)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              />
              <motion.div
                key="product-picker-content"
                initial={{ opacity: 0, y: 20, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.97 }}
                className="fixed left-1/2 top-1/2 z-[81] max-h-[82vh] w-[92%] max-w-4xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl border border-[var(--border)] bg-white p-4 shadow-[0_22px_70px_rgba(36,24,15,0.25)] sm:p-6"
              >
                <div className="flex items-center justify-between gap-3">
                  <h4 className="font-[family-name:var(--font-poppins)] text-xl font-semibold text-[var(--foreground)]">
                    Select Products
                  </h4>
                  <p className="text-xs text-[var(--muted)]">{draftItems.length} selected</p>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {products.map((p) => {
                    const draft = draftItems.find((x) => x.productId === p._id);
                    const checked = Boolean(draft);
                    const qty = Math.max(1, Number(draft?.qty) || 1);
                    const size = String(draft?.size || "medium");
                    return (
                      <button
                        key={`picker-${p._id}`}
                        type="button"
                        onClick={() => toggleDraftProduct(p._id)}
                        className={[
                          "relative overflow-hidden rounded-2xl border p-3 text-left transition",
                          checked
                            ? "border-[#5b2d17] bg-[#f9f1e8] shadow-[0_0_0_1px_rgba(91,45,23,0.2)]"
                            : "border-[var(--border)] bg-white hover:bg-[#fcf8f3]",
                        ].join(" ")}
                      >
                        {checked ? (
                          <span className="absolute right-2 top-2 rounded-full bg-[#5b2d17] px-2 py-0.5 text-[10px] font-semibold text-white">
                            ✓
                          </span>
                        ) : null}
                        <div className="relative h-24 overflow-hidden rounded-xl border border-[var(--border)] bg-[#fcf8f3]">
                          {p.imageUrl ? <Image src={p.imageUrl} alt={p.name} fill className="object-cover" unoptimized /> : null}
                        </div>
                        <p className="mt-2 line-clamp-1 font-semibold text-[#2f1c12]">{p.name}</p>
                        <p className="mt-1 text-xs text-[var(--muted)] line-clamp-2">{p.description || "No details available."}</p>
                        <p className="mt-2 text-xs font-semibold text-[#5b2d17]">PKR {p.price ?? 0}</p>

                        {checked ? (
                          <div className="mt-2 space-y-2">
                            <div className="inline-flex items-center gap-2 rounded-full border border-[#eadccf] bg-white px-2 py-1">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  changeDraftQty(p._id, -1);
                                }}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#fcf8f3] text-[#5b2d17] hover:bg-[var(--primary-soft)]"
                                aria-label="Decrease quantity"
                              >
                                <Minus className="h-3.5 w-3.5" />
                              </button>
                              <span className="min-w-[36px] text-center text-xs font-semibold text-[#2f1c12]">{qty}x</span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  changeDraftQty(p._id, 1);
                                }}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#fcf8f3] text-[#5b2d17] hover:bg-[var(--primary-soft)]"
                                aria-label="Increase quantity"
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </button>
                            </div>

                            {p.hasSizePricing ? (
                              <select
                                value={size}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                }}
                                onChange={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setDraftSize(p._id, e.target.value as DealFormItem["size"]);
                                }}
                                className="w-full rounded-xl border border-[#eadccf] bg-white px-3 py-2 text-xs font-semibold text-[#2f1c12] outline-none"
                                aria-label="Select size"
                              >
                                <option value="small">Small</option>
                                <option value="medium">Medium</option>
                                <option value="large">Large</option>
                                <option value="xlarge">XL</option>
                              </select>
                            ) : null}
                          </div>
                        ) : null}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-5 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setProductPickerOpen(false)}
                    className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm text-[var(--muted)] hover:bg-[var(--primary-soft)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const first = products.find((p) => p._id === draftItems[0]?.productId);
                      setForm((prev) => ({
                        ...prev,
                        items: draftItems,
                        title: prev.title || first?.name || "",
                        imageUrl: prev.imageUrl || first?.imageUrl || "",
                      }));
                      setProductPickerOpen(false);
                    }}
                    disabled={draftItems.length === 0}
                    className="rounded-xl bg-[var(--primary)] px-4 py-2 text-sm text-white hover:bg-[#472212] disabled:opacity-60"
                  >
                    Add Selected
                  </button>
                </div>
              </motion.div>
            </>
          ) : null}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}


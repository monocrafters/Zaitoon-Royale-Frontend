"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { API_BASE_URL, getAdminToken } from "@/lib/admin-auth";
import ModernLoader from "@/components/ui/modern-loader";

type CategoryOption = {
  _id: string;
  name: string;
};

type Product = {
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
  quantity?: number;
  badge?:
    | ""
    | "Trending"
    | "Most Ordered"
    | "Best Seller"
    | "New Arrival"
    | "Chef's Special"
    | "Limited Deal";
  category?: {
    _id?: string;
    name?: string;
  };
};

type ProductFormState = {
  name: string;
  category: string;
  price: string;
  hasSizePricing: boolean;
  sizePrices: {
    small: string;
    medium: string;
    large: string;
    xlarge: string;
  };
  description: string;
  imageUrl: string;
  badge:
    | ""
    | "Trending"
    | "Most Ordered"
    | "Best Seller"
    | "New Arrival"
    | "Chef's Special"
    | "Limited Deal";
};

const defaultForm: ProductFormState = {
  name: "",
  category: "",
  price: "",
  hasSizePricing: false,
  sizePrices: {
    small: "",
    medium: "",
    large: "",
    xlarge: "",
  },
  description: "",
  imageUrl: "",
  badge: "",
};

const sizeOrder: Array<keyof ProductFormState["sizePrices"]> = ["small", "medium", "large", "xlarge"];

const getCardPrice = (product: Product) => {
  if (product.hasSizePricing) {
    return Number(product.sizePrices?.medium) || Number(product.price) || 0;
  }
  return Number(product.price) || 0;
};

const PRODUCTS_CACHE_KEY = "restaurant_products_cache_v1";

export default function ProductsPage() {
  const router = useRouter();
  const token = useMemo(() => getAdminToken(), []);

  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [fetchError, setFetchError] = useState("");

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const [form, setForm] = useState<ProductFormState>(defaultForm);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);

  useEffect(() => {
    if (!token) {
      router.replace("/admin_Login");
      return;
    }

    const init = async () => {
      const cached =
        typeof window !== "undefined" ? window.sessionStorage.getItem(PRODUCTS_CACHE_KEY) : null;
      if (cached) {
        try {
          setProducts(JSON.parse(cached));
          setLoading(false);
        } catch {
          // ignore malformed cache
        }
      }

      try {
        const [productsRes, categoriesRes] = await Promise.all([
          fetch(`${API_BASE_URL}/products`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_BASE_URL}/categories`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (!productsRes.ok || !categoriesRes.ok) {
          throw new Error("Unable to load products.");
        }

        const productsPayload = await productsRes.json();
        const categoriesPayload = await categoriesRes.json();

        const loadedProducts = productsPayload.products || [];
        setProducts(loadedProducts);
        setCategories(categoriesPayload.categories || []);

        if (typeof window !== "undefined") {
          window.sessionStorage.setItem(PRODUCTS_CACHE_KEY, JSON.stringify(loadedProducts));
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to load products.";
        setFetchError(message);
      } finally {
        setLoading(false);
      }
    };

    init();
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
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body,
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.message || "Unable to upload image.");
      setForm((prev) => ({ ...prev, imageUrl: payload.url }));
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to upload image.");
    } finally {
      setImageUploading(false);
    }
  };

  const syncProductsState = (updater: (prev: Product[]) => Product[]) => {
    setProducts((prev) => {
      const updated = updater(prev);
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(PRODUCTS_CACHE_KEY, JSON.stringify(updated));
      }
      return updated;
    });
  };

  const openAddModal = () => {
    setForm({
      ...defaultForm,
      category: categories[0]?._id || "",
    });
    setFormError("");
    setAddModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setSelectedProduct(product);
    setForm({
      name: product.name || "",
      category: product.category?._id || "",
      price: String(product.price ?? ""),
      hasSizePricing: Boolean(product.hasSizePricing),
      sizePrices: {
        small: String(product.sizePrices?.small ?? ""),
        medium: String(product.sizePrices?.medium ?? ""),
        large: String(product.sizePrices?.large ?? ""),
        xlarge: String(product.sizePrices?.xlarge ?? ""),
      },
      description: product.description || "",
      imageUrl: product.imageUrl || "",
      badge: product.badge || "",
    });
    setFormError("");
    setEditModalOpen(true);
  };

  const openDeleteModal = (product: Product) => {
    setSelectedProduct(product);
    setDeleteModalOpen(true);
    setFormError("");
  };

  const saveProduct = async (event: FormEvent<HTMLFormElement>, isEdit = false) => {
    event.preventDefault();
    setSaving(true);
    setFormError("");

    try {
      const endpoint = isEdit
        ? `${API_BASE_URL}/products/${selectedProduct?._id}`
        : `${API_BASE_URL}/products`;
      const method = isEdit ? "PUT" : "POST";

      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...form,
          price: Number(form.price) || 0,
          hasSizePricing: form.hasSizePricing,
          sizePrices: {
            small: Number(form.sizePrices.small) || 0,
            medium: Number(form.sizePrices.medium) || 0,
            large: Number(form.sizePrices.large) || 0,
            xlarge: Number(form.sizePrices.xlarge) || 0,
          },
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.message || "Unable to save product.");
      }

      if (isEdit) {
        syncProductsState((prev) =>
          prev.map((item) => (item._id === payload.product._id ? payload.product : item))
        );
        setEditModalOpen(false);
      } else {
        syncProductsState((prev) => [payload.product, ...prev]);
        setAddModalOpen(false);
      }
      setForm(defaultForm);
      setSelectedProduct(null);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to save product.");
    } finally {
      setSaving(false);
    }
  };

  const deleteProduct = async () => {
    if (!selectedProduct) return;

    setDeleting(true);
    setFormError("");

    try {
      const response = await fetch(`${API_BASE_URL}/products/${selectedProduct._id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.message || "Unable to delete product.");
      }

      syncProductsState((prev) => prev.filter((item) => item._id !== selectedProduct._id));
      setDeleteModalOpen(false);
      setSelectedProduct(null);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to delete product.");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-3xl border border-[var(--border)] bg-white px-6 py-8">
        <ModernLoader label="Loading products..." />
      </div>
    );
  }

  return (
    <>
      <div>
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-[family-name:var(--font-poppins)] text-2xl font-semibold text-[var(--foreground)]">
            All Products
          </h2>
          <button
            type="button"
            onClick={openAddModal}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--primary)] px-3 py-2 text-sm font-medium text-white hover:bg-[#472212] sm:px-4 sm:py-2.5"
          >
            <Plus className="h-4 w-4" />
            Add Product
          </button>
        </div>
        <p className="mt-1 text-sm text-[var(--muted)]">Manage products quickly from one place.</p>
      </div>

      {fetchError ? (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {fetchError}
        </div>
      ) : null}

      {products.length === 0 ? (
        <div className="mt-6 rounded-3xl border border-dashed border-[var(--border)] bg-white p-10 text-center shadow-sm">
          <h3 className="font-[family-name:var(--font-poppins)] text-xl font-semibold text-[var(--foreground)]">
            No products yet
          </h3>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Add your first product and start managing inventory.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
          {products.map((product) => (
            <motion.article
              key={product._id}
              whileHover={{ y: -3 }}
              onClick={() => router.push(`/admin/products/${product._id}`)}
              className="cursor-pointer rounded-3xl border border-white/60 bg-white/60 p-4 shadow-[0_10px_35px_rgba(36,24,15,0.08)] backdrop-blur-md"
            >
              <div className="space-y-3">
                <div className="relative overflow-hidden rounded-2xl border border-[var(--border)]">
                  {product.imageUrl ? (
                    <div className="relative h-28 w-full">
                      <Image
                        src={product.imageUrl}
                        alt={product.name}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                  ) : (
                    <div className="flex h-28 items-center justify-center bg-[var(--primary-soft)] text-xs text-[var(--muted)]">
                      No image
                    </div>
                  )}
                  <div className="absolute right-2 top-2 z-10 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        openEditModal(product);
                      }}
                      className="rounded-lg border border-white/70 bg-white/90 p-1.5 text-[var(--muted)] shadow-sm backdrop-blur hover:bg-[var(--primary-soft)]"
                      aria-label={`Edit ${product.name}`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        openDeleteModal(product);
                      }}
                      className="rounded-lg border border-red-200 bg-white/90 p-1.5 text-red-600 shadow-sm backdrop-blur hover:bg-red-50"
                      aria-label={`Delete ${product.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <div>
                  <h3 className="line-clamp-1 font-[family-name:var(--font-poppins)] text-lg font-semibold text-[var(--foreground)]">
                    {product.name}
                  </h3>
                  <p className="mt-1 line-clamp-1 text-xs text-[var(--muted)]">
                    {product.description || "No description"}
                  </p>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="rounded-full bg-[var(--primary-soft)] px-2.5 py-1 text-[var(--primary)]">
                    {product.category?.name || "Uncategorized"}
                  </span>
                  <span className="font-semibold text-[var(--primary)]">
                    PKR {getCardPrice(product)}
                  </span>
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      )}

      <AnimatePresence>
        {addModalOpen && (
          <ProductModal
            title="Add Product"
            submitLabel={saving ? "Saving..." : "Add Product"}
            form={form}
            setForm={setForm}
            categories={categories}
            onClose={() => setAddModalOpen(false)}
            onSubmit={(event) => saveProduct(event, false)}
            error={formError}
            saving={saving}
            onLocalImageSelect={onLocalImageSelect}
            imageUploading={imageUploading}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editModalOpen && selectedProduct && (
          <ProductModal
            title="Edit Product"
            submitLabel={saving ? "Updating..." : "Save Changes"}
            form={form}
            setForm={setForm}
            categories={categories}
            onClose={() => {
              setEditModalOpen(false);
              setSelectedProduct(null);
            }}
            onSubmit={(event) => saveProduct(event, true)}
            error={formError}
            saving={saving}
            onLocalImageSelect={onLocalImageSelect}
            imageUploading={imageUploading}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteModalOpen && selectedProduct && (
          <>
            <motion.button
              type="button"
              className="fixed inset-0 z-[72] bg-black/35"
              onClick={() => setDeleteModalOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.97 }}
              transition={{ duration: 0.2 }}
              className="fixed left-1/2 top-1/2 z-[73] max-h-[85vh] w-[92%] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl border border-[var(--border)] bg-white p-4 shadow-[0_22px_70px_rgba(36,24,15,0.2)] sm:p-6"
            >
              <h3 className="font-[family-name:var(--font-poppins)] text-2xl font-semibold text-[var(--foreground)]">
                Delete Product
              </h3>
              <p className="mt-3 text-sm text-[var(--muted)]">
                Are you sure you want to delete <b>{selectedProduct.name}</b>?
              </p>
              {formError ? (
                <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                  {formError}
                </div>
              ) : null}
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteModalOpen(false)}
                  className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm text-[var(--muted)] hover:bg-[var(--primary-soft)]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={deleteProduct}
                  disabled={deleting}
                  className="rounded-xl bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-70"
                >
                  {deleting ? "Deleting..." : "Delete Product"}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

type ProductModalProps = {
  title: string;
  submitLabel: string;
  form: ProductFormState;
  setForm: React.Dispatch<React.SetStateAction<ProductFormState>>;
  categories: CategoryOption[];
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  error: string;
  saving: boolean;
  onLocalImageSelect: (file: File | null) => void;
  imageUploading?: boolean;
};

function ProductModal({
  title,
  submitLabel,
  form,
  setForm,
  categories,
  onClose,
  onSubmit,
  error,
  saving,
  onLocalImageSelect,
  imageUploading = false,
}: ProductModalProps) {
  const [sizeKey, setSizeKey] = useState<keyof ProductFormState["sizePrices"]>("medium");
  const [sizePrice, setSizePrice] = useState("");

  useEffect(() => {
    if (!form.hasSizePricing) return;
    setSizePrice(form.sizePrices[sizeKey] || "");
  }, [form.hasSizePricing, form.sizePrices, sizeKey]);

  const upsertSizePrice = () => {
    setForm((prev) => ({
      ...prev,
      sizePrices: {
        ...prev.sizePrices,
        [sizeKey]: sizePrice,
      },
    }));
  };

  const addedSizes = sizeOrder.filter((k) => Number(form.sizePrices[k]) > 0);

  return (
    <>
      <motion.button
        type="button"
        className="fixed inset-0 z-[70] bg-black/35"
        onClick={onClose}
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
          {title}
        </h3>
        <form className="mt-5 space-y-4" onSubmit={onSubmit}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[var(--foreground)]">Name</span>
              <input
                type="text"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                className="w-full rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm outline-none focus:border-[#b98b6a]"
                required
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[var(--foreground)]">
                Category
              </span>
              <select
                value={form.category}
                onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
                className="w-full rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm outline-none focus:border-[#b98b6a]"
                required
              >
                <option value="">Select category</option>
                {categories.map((item) => (
                  <option key={item._id} value={item._id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[var(--foreground)]">Price</span>
              <input
                type="number"
                value={form.price}
                onChange={(event) => setForm((prev) => ({ ...prev, price: event.target.value }))}
                className={[
                  "w-full rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm outline-none focus:border-[#b98b6a]",
                  form.hasSizePricing ? "cursor-not-allowed bg-[#f3eee8] text-[var(--muted)]" : "",
                ].join(" ")}
                disabled={form.hasSizePricing}
                required={!form.hasSizePricing}
                placeholder={form.hasSizePricing ? "Disabled when size pricing is enabled" : ""}
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[var(--foreground)]">Badge</span>
              <select
                value={form.badge}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, badge: event.target.value as ProductFormState["badge"] }))
                }
                className="w-full rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm outline-none focus:border-[#b98b6a]"
              >
                <option value="">Select badge</option>
                <option value="Best Seller">Best Seller</option>
                <option value="Most Ordered">Most Ordered</option>
                <option value="Trending">Trending</option>
                <option value="New Arrival">New Arrival</option>
                <option value="Chef's Special">Chef's Special</option>
                <option value="Limited Deal">Limited Deal</option>
              </select>
            </label>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[#fcf8f3] p-3">
            <label className="flex items-center gap-2 text-sm font-medium text-[var(--foreground)]">
              <input
                type="checkbox"
                checked={form.hasSizePricing}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    hasSizePricing: event.target.checked,
                    price: event.target.checked ? "" : prev.price,
                  }))
                }
              />
              Enable size based pricing (optional)
            </label>

            {form.hasSizePricing ? (
              <div className="mt-3 space-y-3">
                <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                      Size
                    </span>
                    <select
                      value={sizeKey}
                      onChange={(event) => setSizeKey(event.target.value as keyof ProductFormState["sizePrices"])}
                      className="w-full rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm outline-none focus:border-[#b98b6a]"
                    >
                      <option value="small">Small</option>
                      <option value="medium">Medium</option>
                      <option value="large">Large</option>
                      <option value="xlarge">XLarge</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                      Price
                    </span>
                    <input
                      type="number"
                      value={sizePrice}
                      onChange={(event) => setSizePrice(event.target.value)}
                      className="w-full rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm outline-none focus:border-[#b98b6a]"
                      placeholder="Enter price"
                    />
                  </label>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={upsertSizePrice}
                      className="rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#472212]"
                    >
                      Add
                    </button>
                  </div>
                </div>

                {addedSizes.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {addedSizes.map((k) => (
                      <button
                        key={`size-pill-${k}`}
                        type="button"
                        onClick={() => {
                          setSizeKey(k);
                          setSizePrice(form.sizePrices[k]);
                        }}
                        className="rounded-full border border-[#e7d6c6] bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#5b2d17]"
                      >
                        {k}: PKR {Number(form.sizePrices[k]) || 0}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[var(--muted)]">No size prices added yet.</p>
                )}

                <p className="text-xs text-[var(--muted)]">
                  Product cards will show Medium price by default.
                </p>
              </div>
            ) : null}
          </div>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-[var(--foreground)]">Description</span>
            <textarea
              value={form.description}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, description: event.target.value }))
              }
              className="min-h-[90px] w-full rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm outline-none focus:border-[#b98b6a]"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[var(--foreground)]">Image URL</span>
              <input
                type="url"
                value={form.imageUrl}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, imageUrl: event.target.value }))
                }
                className="w-full rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm outline-none focus:border-[#b98b6a]"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[var(--foreground)]">
                Local Image
              </span>
              <input
                type="file"
                accept="image/*"
                onChange={(event) => onLocalImageSelect(event.target.files?.[0] || null)}
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
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                Image Preview
              </p>
              <div className="relative h-36 overflow-hidden rounded-xl border border-[var(--border)]">
                <Image src={form.imageUrl} alt="Product preview" fill className="object-cover" unoptimized />
              </div>
            </div>
          ) : null}

          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </div>
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
      </motion.div>
    </>
  );
}

"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { API_BASE_URL, getAdminToken } from "@/lib/admin-auth";
import ModernLoader from "@/components/ui/modern-loader";

type Category = {
  _id: string;
  name: string;
  description: string;
  imageUrl?: string;
  isActive?: boolean;
  productsCount?: number;
};

type CategoryFormState = {
  name: string;
  description: string;
  imageUrl: string;
};

const defaultForm: CategoryFormState = {
  name: "",
  description: "",
  imageUrl: "",
};
const CATEGORIES_CACHE_KEY = "restaurant_categories_cache_v1";

export default function CategoriesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [fetchError, setFetchError] = useState("");
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [form, setForm] = useState<CategoryFormState>(defaultForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [imageUploading, setImageUploading] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const token = useMemo(() => getAdminToken(), []);

  useEffect(() => {
    if (!token) {
      router.replace("/admin_Login");
      return;
    }

    const init = async () => {
      const cached =
        typeof window !== "undefined" ? window.sessionStorage.getItem(CATEGORIES_CACHE_KEY) : null;
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as Category[];
          setCategories(parsed);
          setLoading(false);
        } catch {
          // Ignore malformed cache.
        }
      }

      try {
        const categoriesRes = await fetch(`${API_BASE_URL}/categories`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!categoriesRes.ok) {
          const payload = await categoriesRes.json();
          throw new Error(payload.message || "Unable to load categories.");
        }

        const categoryData = await categoriesRes.json();

        setCategories(categoryData.categories || []);
        if (typeof window !== "undefined") {
          window.sessionStorage.setItem(
            CATEGORIES_CACHE_KEY,
            JSON.stringify(categoryData.categories || [])
          );
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unable to load categories.";

        if (
          message.toLowerCase().includes("session") ||
          message.toLowerCase().includes("unauthorized")
        ) {
          router.replace("/admin_Login");
        } else {
          setFetchError(message);
        }
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [router, token]);

  const openAddModal = () => {
    setForm(defaultForm);
    setFormError("");
    setAddModalOpen(true);
  };

  const openEditModal = (category: Category) => {
    setSelectedCategory(category);
    setForm({
      name: category.name || "",
      description: category.description || "",
      imageUrl: category.imageUrl || "",
    });
    setFormError("");
    setEditModalOpen(true);
  };

  const openDeleteModal = (category: Category) => {
    setSelectedCategory(category);
    setFormError("");
    setDeleteModalOpen(true);
  };

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

  const saveNewCategory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setFormError("");

    try {
      const response = await fetch(`${API_BASE_URL}/categories`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.message || "Unable to add category.");
      }

      setCategories((prev) => {
        const updated = [{ ...payload.category, productsCount: 0 }, ...prev];
        if (typeof window !== "undefined") {
          window.sessionStorage.setItem(CATEGORIES_CACHE_KEY, JSON.stringify(updated));
        }
        return updated;
      });
      setAddModalOpen(false);
      setForm(defaultForm);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to save category.");
    } finally {
      setSaving(false);
    }
  };

  const saveEditedCategory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedCategory) return;

    setSaving(true);
    setFormError("");

    try {
      const response = await fetch(`${API_BASE_URL}/categories/${selectedCategory._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.message || "Unable to edit category.");
      }

      setCategories((prev) => {
        const updated = prev.map((item) =>
          item._id === selectedCategory._id
            ? { ...payload.category, productsCount: item.productsCount || 0 }
            : item
        );
        if (typeof window !== "undefined") {
          window.sessionStorage.setItem(CATEGORIES_CACHE_KEY, JSON.stringify(updated));
        }
        return updated;
      });
      setEditModalOpen(false);
      setSelectedCategory(null);
      setForm(defaultForm);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to update category.");
    } finally {
      setSaving(false);
    }
  };

  const deleteCategory = async () => {
    if (!selectedCategory) return;

    setDeleting(true);
    setFormError("");

    try {
      const response = await fetch(`${API_BASE_URL}/categories/${selectedCategory._id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.message || "Unable to delete category.");
      }

      setCategories((prev) => {
        const updated = prev.filter((item) => item._id !== selectedCategory._id);
        if (typeof window !== "undefined") {
          window.sessionStorage.setItem(CATEGORIES_CACHE_KEY, JSON.stringify(updated));
        }
        return updated;
      });
      setDeleteModalOpen(false);
      setSelectedCategory(null);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to delete category.");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="rounded-3xl border border-[var(--border)] bg-white px-6 py-5 shadow-sm">
          <ModernLoader label="Loading categories..." />
        </div>
      </main>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate font-[family-name:var(--font-poppins)] text-xl font-semibold text-[var(--foreground)] sm:text-2xl">
            All Categories
          </h2>
          <p className="mt-0.5 line-clamp-1 text-xs text-[var(--muted)] sm:text-sm">Manage your restaurant food categories.</p>
        </div>
        <button
          type="button"
          onClick={openAddModal}
          className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-[var(--primary)] px-3 text-xs font-medium text-white hover:bg-[#472212] sm:gap-2 sm:px-4 sm:py-2.5 sm:text-sm"
        >
          <Plus className="h-4 w-4" />
          Add Category
        </button>
      </div>

      {fetchError ? (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 sm:mt-4 sm:rounded-2xl sm:px-4 sm:py-3 sm:text-sm">
          {fetchError}
        </div>
      ) : null}

      {categories.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-[var(--border)] bg-white p-6 text-center shadow-sm sm:mt-6 sm:rounded-3xl sm:p-10">
          <h3 className="font-[family-name:var(--font-poppins)] text-lg font-semibold text-[var(--foreground)] sm:text-xl">
            No categories yet
          </h3>
          <p className="mt-2 text-xs text-[var(--muted)] sm:text-sm">
            Start by adding your first category to organize menu items.
          </p>
          <button
            type="button"
            onClick={openAddModal}
            className="mt-4 rounded-xl border border-[var(--border)] px-4 py-2 text-xs text-[var(--foreground)] hover:bg-[var(--primary-soft)] sm:mt-5 sm:text-sm"
          >
            Add first category
          </button>
        </div>
      ) : (
        <div className="mt-4 grid gap-2 sm:mt-6 sm:gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {categories.map((category) => (
            <motion.article
              key={category._id}
              whileHover={{ y: -4 }}
              transition={{ duration: 0.18 }}
              onClick={() => router.push(`/admin/categories/${category._id}`)}
              className="cursor-pointer border-y border-[var(--border)] bg-white px-3 py-3 sm:rounded-3xl sm:border sm:border-white/60 sm:bg-white/60 sm:p-5 sm:shadow-[0_10px_35px_rgba(36,24,15,0.08)] sm:backdrop-blur-md"
            >
              <div className="space-y-2.5 sm:space-y-4">
                <div className="overflow-hidden rounded-xl border border-[var(--border)] sm:rounded-2xl">
                  {category.imageUrl ? (
                    <div className="relative h-28 w-full sm:h-36">
                      <Image
                        src={category.imageUrl}
                        alt={category.name}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                  ) : (
                    <div className="flex h-28 items-center justify-center bg-[var(--primary-soft)] text-xs text-[var(--muted)] sm:h-36 sm:text-sm">
                      No image
                    </div>
                  )}
                </div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-[family-name:var(--font-poppins)] text-base font-semibold text-[var(--foreground)] sm:text-xl">
                      {category.name}
                    </h3>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--muted)] sm:mt-2 sm:text-sm sm:leading-6">
                      {category.description || "No description added yet."}
                    </p>
                    <div className="mt-2 inline-flex rounded-full bg-[var(--primary-soft)] px-2.5 py-1 text-[10px] font-medium text-[var(--primary)] sm:mt-3 sm:px-3 sm:text-xs">
                      Products: {category.productsCount || 0}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        openEditModal(category);
                      }}
                      className="rounded-lg border border-[var(--border)] p-1.5 text-[var(--muted)] hover:bg-[var(--primary-soft)] sm:rounded-xl sm:p-2"
                      aria-label={`Edit ${category.name}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        openDeleteModal(category);
                      }}
                      className="rounded-lg border border-red-200 p-1.5 text-red-500 hover:bg-red-50 sm:rounded-xl sm:p-2"
                      aria-label={`Delete ${category.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      )}

      <AnimatePresence>
        {addModalOpen && (
          <CategoryModal
            title="Add Category"
            submitLabel={saving ? "Saving..." : "Add Category"}
            form={form}
            setForm={setForm}
            onClose={() => setAddModalOpen(false)}
            onSubmit={saveNewCategory}
            error={formError}
            saving={saving}
            onLocalImageSelect={onLocalImageSelect}
            imageUploading={imageUploading}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editModalOpen && selectedCategory && (
          <CategoryModal
            title="Edit Category"
            submitLabel={saving ? "Updating..." : "Save Changes"}
            form={form}
            setForm={setForm}
            onClose={() => {
              setEditModalOpen(false);
              setSelectedCategory(null);
            }}
            onSubmit={saveEditedCategory}
            error={formError}
            saving={saving}
            onLocalImageSelect={onLocalImageSelect}
            imageUploading={imageUploading}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteModalOpen && selectedCategory && (
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
                Delete Category
              </h3>
              <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                Are you sure you want to delete <b>{selectedCategory.name}</b>?
              </p>
              <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                Warning: All products under this category will also be deleted permanently.
              </div>
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
                  onClick={deleteCategory}
                  disabled={deleting}
                  className="rounded-xl bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-70"
                >
                  {deleting ? "Deleting..." : "Delete Category"}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

type CategoryModalProps = {
  title: string;
  submitLabel: string;
  form: CategoryFormState;
  setForm: React.Dispatch<React.SetStateAction<CategoryFormState>>;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  error: string;
  saving: boolean;
  onLocalImageSelect: (file: File | null) => void;
  imageUploading?: boolean;
};

function CategoryModal({
  title,
  submitLabel,
  form,
  setForm,
  onClose,
  onSubmit,
  error,
  saving,
  onLocalImageSelect,
  imageUploading = false,
}: CategoryModalProps) {
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
        className="fixed left-1/2 top-1/2 z-[71] max-h-[85vh] w-[92%] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl border border-[var(--border)] bg-white p-4 shadow-[0_22px_70px_rgba(36,24,15,0.2)] sm:p-6"
      >
        <h3 className="font-[family-name:var(--font-poppins)] text-2xl font-semibold text-[var(--foreground)]">
          {title}
        </h3>
        <form className="mt-5 space-y-4" onSubmit={onSubmit}>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-[var(--foreground)]">Name</span>
            <input
              type="text"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              className="w-full rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm outline-none focus:border-[#b98b6a]"
              placeholder="e.g. Fast Food"
              required
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-[var(--foreground)]">
              Description
            </span>
            <textarea
              value={form.description}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, description: event.target.value }))
              }
              className="min-h-[96px] w-full rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm outline-none focus:border-[#b98b6a]"
              placeholder="Short category description"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[var(--foreground)]">
                Image URL
              </span>
              <input
                type="url"
                value={form.imageUrl}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, imageUrl: event.target.value }))
                }
                className="w-full rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm outline-none focus:border-[#b98b6a]"
                placeholder="https://example.com/image.jpg"
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
              <div className="relative h-40 overflow-hidden rounded-xl border border-[var(--border)]">
                <Image
                  src={form.imageUrl}
                  alt="Category preview"
                  fill
                  className="object-cover"
                  unoptimized
                />
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

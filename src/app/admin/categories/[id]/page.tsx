"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";

import { API_BASE_URL, getAdminToken } from "@/lib/admin-auth";
import ModernLoader from "@/components/ui/modern-loader";

type Category = {
  _id: string;
  name: string;
  description?: string;
  imageUrl?: string;
};

type Product = {
  _id: string;
  name: string;
  description?: string;
  price?: number;
  imageUrl?: string;
};

export default function CategoryDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const token = useMemo(() => getAdminToken(), []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [category, setCategory] = useState<Category | null>(null);
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    if (!token) {
      router.replace("/admin_Login");
      return;
    }

    const load = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/categories/${params.id}/products`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.message || "Unable to load category details.");
        }

        setCategory(payload.category);
        setProducts(payload.products || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load category details.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [params.id, router, token]);

  if (loading) {
    return (
      <div className="rounded-3xl border border-[var(--border)] bg-white px-6 py-8">
        <ModernLoader label="Loading category details..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl border border-white/60 bg-white/60 shadow-[0_10px_35px_rgba(36,24,15,0.08)] backdrop-blur-md">
        {category?.imageUrl ? (
          <div className="relative h-64 sm:h-72 lg:h-80">
            <Image src={category.imageUrl} alt={category.name} fill className="object-cover" unoptimized />
          </div>
        ) : (
          <div className="flex h-64 items-center justify-center bg-[var(--primary-soft)] text-sm text-[var(--muted)] sm:h-72 lg:h-80">
            No image available
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/10" />
        <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
          <h2 className="font-[family-name:var(--font-poppins)] text-2xl font-semibold text-white sm:text-3xl">
            {category?.name || "Category"}
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-white/90 sm:text-base">
            {category?.description || "No description added for this category."}
          </p>
          <div className="mt-3 inline-flex rounded-full border border-white/30 bg-black/35 px-3 py-1 text-sm font-medium text-white backdrop-blur">
            Products: {products.length}
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      ) : products.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[var(--border)] bg-white p-10 text-center text-[var(--muted)]">
          No products found in this category.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
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
                    {category?.name || "Category"}
                  </span>
                  <span className="font-semibold text-[var(--primary)]">
                    {typeof product.price === "number" ? `PKR ${product.price}` : "Price not set"}
                  </span>
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      )}
    </div>
  );
}

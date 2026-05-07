"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Boxes } from "lucide-react";

import { API_BASE_URL, getAdminToken } from "@/lib/admin-auth";
import ModernLoader from "@/components/ui/modern-loader";

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
  category?: {
    _id?: string;
    name?: string;
  };
};

export default function ProductDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const token = useMemo(() => getAdminToken(), []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [product, setProduct] = useState<Product | null>(null);

  useEffect(() => {
    if (!token) {
      router.replace("/admin_Login");
      return;
    }

    const load = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/products/${params.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.message || "Unable to load product details.");
        }

        setProduct(payload.product);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load product details.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [params.id, router, token]);

  if (loading) {
    return (
      <div className="rounded-3xl border border-[var(--border)] bg-white px-6 py-8">
        <ModernLoader label="Loading product details..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/products"
          className="inline-flex items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to products
        </Link>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      ) : (
        <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <motion.div
            whileHover={{ y: -2 }}
            className="overflow-hidden rounded-3xl border border-white/60 bg-white/80 p-3 shadow-[0_10px_35px_rgba(36,24,15,0.08)] backdrop-blur-md sm:p-4"
          >
            {product?.imageUrl ? (
              <div className="relative flex h-[280px] items-center justify-center rounded-2xl bg-[#f8f1e9] sm:h-[360px] lg:h-[460px]">
                <Image
                  src={product.imageUrl}
                  alt={product.name}
                  fill
                  className="object-contain p-2 sm:p-4"
                  unoptimized
                />
              </div>
            ) : (
              <div className="flex h-[280px] items-center justify-center rounded-2xl bg-[var(--primary-soft)] text-sm text-[var(--muted)] sm:h-[360px] lg:h-[460px]">
                No image available
              </div>
            )}
          </motion.div>

          <motion.div
            whileHover={{ y: -2 }}
            className="rounded-3xl border border-white/60 bg-white/80 p-5 shadow-[0_10px_35px_rgba(36,24,15,0.08)] backdrop-blur-md sm:p-6"
          >
            <div className="mb-4 inline-flex rounded-xl bg-[var(--primary-soft)] p-2 text-[var(--primary)]">
              <Boxes className="h-4 w-4" />
            </div>

            <h2 className="font-[family-name:var(--font-poppins)] text-3xl font-semibold text-[var(--foreground)]">
              {product?.name || "Product"}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
              {product?.description || "No product description available."}
            </p>

            <div className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-2xl border border-[var(--border)] bg-[#fcf8f3] px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Category</p>
                <p className="mt-1 font-medium text-[var(--foreground)]">
                  {product?.category?.name || "No category"}
                </p>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[#fcf8f3] px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Price</p>
                <p className="mt-1 font-medium text-[var(--foreground)]">PKR {product?.price || 0}</p>
              </div>
            </div>

            {product?.hasSizePricing ? (
              <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[#fcf8f3] p-4">
                <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Size pricing</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {(["small", "medium", "large", "xlarge"] as const).map((k) => (
                    <p key={`admin-size-${k}`} className="capitalize text-sm text-[var(--foreground)]">
                      {k}: <span className="font-semibold text-[var(--primary)]">PKR {Number(product?.sizePrices?.[k]) || 0}</span>
                    </p>
                  ))}
                </div>
                <p className="mt-2 text-xs text-[var(--muted)]">Cards show Medium by default.</p>
              </div>
            ) : null}
          </motion.div>
        </section>
      )}
    </div>
  );
}

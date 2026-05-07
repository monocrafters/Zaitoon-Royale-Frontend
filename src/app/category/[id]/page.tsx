"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { ShoppingCart } from "lucide-react";

import { API_BASE_URL } from "@/lib/admin-auth";
import { addItemToCart } from "@/lib/cart-client";
import SiteHeader from "@/components/public/site-header";
import ModernLoader from "@/components/ui/modern-loader";
import { readSessionCache, writeSessionCache } from "@/lib/session-cache";

type CategoryDetail = {
  _id: string;
  name: string;
  description?: string;
  imageUrl?: string;
};

type Product = {
  _id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  price?: number;
  badge?: string;
};

const fakeRatings = [4.5, 4.9, 4.7, 4.6, 4.8];

export default function CategoryDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const categoryId = String(params?.id || "");
  const [category, setCategory] = useState<CategoryDetail | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        setError("");
        if (!categoryId) {
          setError("Category not found.");
          setLoading(false);
          return;
        }
        const CACHE_TTL_MS = 2 * 60 * 1000;
        const CACHE_KEY = `restaurant_category_detail_${categoryId}`;
        const cached = readSessionCache<{ category: CategoryDetail | null; products: Product[] }>(
          CACHE_KEY,
          CACHE_TTL_MS
        );
        const hadCache = Boolean(cached?.category);
        if (cached) {
          setCategory(cached.category);
          setProducts(cached.products || []);
          setLoading(false);
        } else {
          setLoading(true);
        }

        const res = await fetch(`${API_BASE_URL}/categories/public/${categoryId}/products`, {
          cache: "no-store",
        });
        const payload = await res.json();
        if (!res.ok) {
          if (hadCache) return;
          throw new Error(payload.message || "Unable to load category.");
        }
        setCategory(payload.category || null);
        setProducts(payload.products || []);
        writeSessionCache(CACHE_KEY, { category: payload.category || null, products: payload.products || [] });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Unable to load category.";
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [categoryId]);

  const productCount = useMemo(() => products.length, [products.length]);

  if (loading) {
    return (
      <main className="min-h-[60vh] bg-[#f5efe8] px-4 pt-28">
        <SiteHeader />
        <div className="mx-auto max-w-7xl rounded-3xl border border-[#eadccf] bg-white p-8">
          <ModernLoader label="Loading category..." />
        </div>
      </main>
    );
  }

  if (error || !category) {
    return (
      <main className="min-h-[60vh] bg-[#f5efe8] px-4 pt-28">
        <SiteHeader />
        <div className="mx-auto max-w-7xl rounded-3xl border border-red-200 bg-red-50 p-8 text-red-700">
          {error || "Category not found."}
        </div>
      </main>
    );
  }

  return (
    <main className="bg-[#f5efe8] antialiased">
      <SiteHeader />
      <section className="relative left-1/2 w-screen -translate-x-1/2 pt-[64px] sm:left-auto sm:w-auto sm:translate-x-0 sm:px-6 sm:pt-[88px]">
        <div className="relative overflow-hidden sm:mx-auto sm:max-w-7xl sm:rounded-3xl sm:border sm:border-[#eadccf] sm:bg-white">
          <div className="relative h-[250px] sm:h-[340px]">
            {category.imageUrl ? (
              <Image
                src={category.imageUrl}
                alt={category.name}
                fill
                className="object-cover"
                unoptimized
              />
            ) : null}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          </div>
          <div className="absolute bottom-0 left-0 right-0 px-4 py-5 sm:px-8 sm:py-7">
            <h1 className="font-[family-name:var(--font-poppins)] text-3xl font-semibold text-white">
              {category.name}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/90">
              {category.description || " "}
            </p>
            <p className="mt-3 text-sm font-semibold text-white/95">
              {productCount} items
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-10 pt-5 sm:px-6">
        <div className="mt-1 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {products.map((p, idx) => (
            <article
              key={p._id}
              role="button"
              tabIndex={0}
              onClick={() => router.push(`/product/${p._id}`)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") router.push(`/product/${p._id}`);
              }}
              className="overflow-hidden rounded-3xl border border-[#eadccf] bg-gradient-to-b from-[#fff7ea] via-white to-[#f6ece2] p-3"
            >
              <div className="relative overflow-hidden rounded-2xl bg-white/60">
                <div className="relative h-32">
                  {p.imageUrl ? (
                    <Image src={p.imageUrl} alt={p.name} fill className="object-cover" unoptimized />
                  ) : null}
                </div>
              </div>
              <h3 className="mt-3 line-clamp-1 font-[family-name:var(--font-poppins)] text-sm font-semibold text-[#24130c]">
                {p.name}
              </h3>
              <p className="mt-1 line-clamp-1 text-[12px] leading-4 text-[#6f5647]">{p.description || ""}</p>
              <div className="mt-2 flex items-center gap-1">
                <span className="text-[10px] leading-none text-[#ffb347]">★★★★★</span>
                <span className="text-[10px] font-semibold text-[#6f5647]">({fakeRatings[idx % fakeRatings.length].toFixed(1)})</span>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-[#5b2d17]">PKR {p.price ?? 0}</p>
                <button
                  type="button"
                  onClick={async (event) => {
                    event.stopPropagation();
                    await addItemToCart(p._id, "", 1, event.currentTarget);
                  }}
                  aria-label="Add to cart"
                  className="inline-flex items-center gap-1 rounded-2xl bg-gradient-to-br from-[#5b2d17] to-[#8b3f1c] px-3 py-2 text-xs font-semibold text-white transition hover:brightness-[1.05] sm:px-3.5 sm:py-2.5"
                >
                  <ShoppingCart className="h-4 w-4" />
                  <span>Add</span>
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}


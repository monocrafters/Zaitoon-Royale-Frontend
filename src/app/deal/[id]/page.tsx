"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Clock3, ShoppingCart } from "lucide-react";
import { motion } from "framer-motion";

import { API_BASE_URL } from "@/lib/admin-auth";
import { addDealToCart } from "@/lib/cart-client";
import SiteHeader from "@/components/public/site-header";
import ModernLoader from "@/components/ui/modern-loader";

type DealItem = {
  qty: number;
  size?: "" | "small" | "medium" | "large" | "xlarge" | string;
  product: {
    _id: string;
    name: string;
    imageUrl?: string;
    description?: string;
  };
};

type Deal = {
  _id: string;
  title: string;
  subtitle?: string;
  description?: string;
  badge?: string;
  imageUrl?: string;
  endsAt?: string | null;
  pricing?: { originalPrice: number; finalPrice: number };
  items?: DealItem[];
  products?: Array<{ _id: string; name: string }>;
};

function formatCountdown(endIso: string | null | undefined) {
  if (!endIso) return null;
  const end = new Date(endIso).getTime();
  const ms = end - Date.now();
  if (ms <= 0) return { hours: "00", minutes: "00", seconds: "00", ended: true };
  const totalSeconds = Math.floor(ms / 1000);
  const hours = String(Math.floor((totalSeconds % 86400) / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return { hours, minutes, seconds, ended: false };
}

function getProductsLine(deal?: Deal | null) {
  if (!deal) return "";
  const items = Array.isArray(deal.items) ? deal.items : [];
  if (items.length) {
    return items
      .map((it) => {
        const qty = Math.max(1, Number(it.qty) || 1);
        const raw = String(it.size || "").trim();
        const size = raw ? `${raw[0].toUpperCase()}${raw.slice(1)} ` : "";
        return `${qty}x ${size}${it.product?.name || ""}`.trim();
      })
      .filter(Boolean)
      .join(" • ");
  }
  const old = Array.isArray(deal.products) ? deal.products : [];
  return old.map((p) => p.name).filter(Boolean).join(" • ");
}

export default function DealDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = useMemo(() => String(params?.id || "").trim(), [params?.id]);

  const [deal, setDeal] = useState<Deal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`${API_BASE_URL}/deals/public/${id}`, { cache: "no-store" });
        const payload = await res.json();
        if (!res.ok) throw new Error(payload.message || "Unable to load deal.");
        setDeal((payload?.deal as Deal) || null);
      } catch (e) {
        setDeal(null);
        setError(e instanceof Error ? e.message : "Unable to load deal.");
      } finally {
        setLoading(false);
      }
    };

    if (id) void load();
  }, [id]);

  const countdown = useMemo(() => {
    void tick;
    return formatCountdown(deal?.endsAt);
  }, [deal?.endsAt, tick]);

  if (loading) {
    return (
      <main className="bg-[#f5efe8] text-[#2f1c12]">
        <SiteHeader />
        <div className="mx-auto max-w-7xl px-4 pb-10 pt-[96px] sm:px-6">
          <ModernLoader label="Loading deal..." />
        </div>
      </main>
    );
  }

  if (error || !deal) {
    return (
      <main className="bg-[#f5efe8] text-[#2f1c12]">
        <SiteHeader />
        <div className="mx-auto max-w-7xl px-4 pb-10 pt-[96px] sm:px-6">
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error || "Deal not found."}
          </div>
          <Link
            href="/offers"
            className="mt-5 inline-flex rounded-xl border border-[#eadccf] bg-white px-4 py-2 text-sm font-semibold text-[#5b2d17] hover:bg-[#f4efe8]"
          >
            Back to offers
          </Link>
        </div>
      </main>
    );
  }

  const productsLine = getProductsLine(deal);
  const finalPrice = Number(deal.pricing?.finalPrice) || 0;
  const originalPrice = Number(deal.pricing?.originalPrice) || 0;
  const whatsappMessage = `Assalam o Alaikum, I want to order this deal: *${deal.title}*\nPrice: PKR ${finalPrice}\nDeal ID: ${deal._id}`;
  const whatsappHref = `https://wa.me/923001234567?text=${encodeURIComponent(whatsappMessage)}`;

  return (
    <main className="bg-[#f5efe8] text-[#2f1c12]">
      <SiteHeader />
      <div className="mx-auto max-w-7xl px-4 pb-12 pt-[96px] sm:px-6">
        <div className="grid gap-8 lg:grid-cols-[1fr_1fr] lg:items-center">
          <div className="relative flex h-[320px] items-center justify-center overflow-hidden bg-transparent sm:h-[450px]">
            {deal.imageUrl ? (
              <Image src={deal.imageUrl} alt={deal.title} fill className="object-contain" unoptimized />
            ) : (
              <div className="text-sm text-[#6b625a]">No image</div>
            )}
          </div>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
            {deal.badge ? (
              <p className="inline-flex rounded-full bg-[#fffaf4] px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#7a3f22]">
                {deal.badge}
              </p>
            ) : null}

            <h1 className="mt-2 font-[family-name:var(--font-poppins)] text-4xl font-semibold leading-tight text-[#111] sm:text-5xl">
              {deal.title}
            </h1>
            {deal.subtitle ? <p className="mt-2 text-sm font-semibold text-[#6b625a]">{deal.subtitle}</p> : null}
            <p className="mt-4 text-sm leading-7 text-[#6b625a] sm:text-base">{deal.description || productsLine || "—"}</p>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <span className="text-4xl font-semibold text-[#b84a2b]">PKR {finalPrice}</span>
              {originalPrice ? (
                <span className="text-sm font-semibold text-[#8a6f5e] line-through">PKR {originalPrice}</span>
              ) : null}
              {countdown ? (
                <span className="inline-flex items-center gap-2 rounded-2xl border border-[#eadccf] bg-white px-3 py-2 text-xs font-semibold text-[#5b2d17]">
                  <Clock3 className="h-4 w-4" />
                  {countdown.ended ? "Ended" : `${countdown.hours}:${countdown.minutes}:${countdown.seconds}`}
                </span>
              ) : null}
            </div>

            <div className="mt-7 grid grid-cols-3 gap-1.5 sm:flex sm:flex-nowrap sm:gap-2">
              <button
                type="button"
                onClick={async () => {
                  if (!deal?._id) return;
                  await addDealToCart(deal._id, 1, undefined, {
                    title: deal.title,
                    imageUrl: deal.imageUrl || "",
                    unitPrice: finalPrice,
                  });
                  router.push(`/checkout?direct=deal&id=${encodeURIComponent(deal._id)}`);
                }}
                className="inline-flex h-10 items-center justify-center whitespace-nowrap rounded-xl bg-[#5b2d17] px-2 text-[11px] font-semibold !text-white hover:brightness-[1.03] sm:h-11 sm:min-w-[130px] sm:px-4 sm:text-sm"
              >
                Order Now
              </button>
              <button
                type="button"
                onClick={async (event) => {
                  if (!deal?._id) return;
                  await addDealToCart(
                    deal._id,
                    1,
                    event.currentTarget,
                    { title: deal.title, imageUrl: deal.imageUrl || "", unitPrice: finalPrice }
                  );
                }}
                className="inline-flex h-10 items-center justify-center gap-1 whitespace-nowrap rounded-xl bg-[#111] px-2 text-[11px] font-semibold text-white hover:bg-black sm:h-11 sm:min-w-[150px] sm:gap-2 sm:px-4 sm:text-sm"
              >
                <ShoppingCart className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                Add Deal to Cart
              </button>
              <a
                href={whatsappHref}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 items-center justify-center whitespace-nowrap rounded-xl border border-black/15 bg-white px-2.5 text-[11px] font-semibold text-[#111] hover:bg-[#f4efe8] sm:h-11 sm:min-w-[170px] sm:px-4 sm:text-sm"
              >
                WhatsApp Order
              </a>
            </div>
            <Link href="/offers" className="mt-4 inline-flex text-sm font-semibold text-[#5b2d17] hover:underline">
              Back to offers
            </Link>
          </motion.div>
        </div>

        <section className="mt-12">
          <h2 className="font-[family-name:var(--font-poppins)] text-2xl font-semibold text-[#111]">Included items</h2>
          {Array.isArray(deal.items) && deal.items.length ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {deal.items.map((it, idx) => {
                const qty = Math.max(1, Number(it.qty) || 1);
                const size = String(it.size || "").trim();
                const name = it.product?.name || "Item";
                const href = it.product?._id ? `/product/${it.product._id}` : "/menu";
                return (
                  <Link
                    key={`${it.product?._id || "p"}_${idx}`}
                    href={href}
                    className="rounded-3xl border border-[#eadccf] bg-white p-4 shadow-[0_10px_24px_rgba(47,28,18,0.06)] transition hover:-translate-y-0.5"
                  >
                    <div className="flex items-start gap-3">
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-[#eadccf] bg-[#fffaf4]">
                        {it.product?.imageUrl ? (
                          <Image src={it.product.imageUrl} alt={name} fill className="object-cover" unoptimized />
                        ) : null}
                      </div>
                      <div className="min-w-0">
                        <p className="line-clamp-1 text-sm font-semibold text-[#2f1c12]">{name}</p>
                        <p className="mt-1 text-[11px] font-semibold text-[#7a3f22]">
                          {qty}x {size ? `${size} ` : ""}
                        </p>
                        {it.product?.description ? (
                          <p className="mt-1 line-clamp-2 text-xs text-[#6f5647]">{it.product.description}</p>
                        ) : null}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-[#dccbbb] bg-[#fffaf4] p-6 text-sm text-[#6f5647]">
              {productsLine || "No items available for this deal."}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

"use client";

import Link from "next/link";
import { Home, UtensilsCrossed } from "lucide-react";

import SiteHeader from "@/components/public/site-header";

export default function NotFoundPage() {
  return (
    <main className="min-h-screen bg-[#f5efe8] text-[#2f1c12] antialiased">
      <SiteHeader />
      <section className="mx-auto flex max-w-5xl flex-col items-center px-4 pb-20 pt-[108px] text-center sm:px-6">
        <div className="rounded-3xl border border-[#eadccf] bg-white px-6 py-10 shadow-[0_12px_35px_rgba(47,28,18,0.08)] sm:px-10">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#7d6b5d]">Zaitoon Royale</p>
          <h1 className="mt-2 font-[family-name:var(--font-poppins)] text-4xl font-semibold text-[#111] sm:text-5xl">404</h1>
          <p className="mt-3 text-lg font-semibold text-[#2f1c12]">Page not found</p>
          <p className="mt-2 text-sm text-[#6f5647]">
            Jo page aap dhoond rahe hain woh available nahi hai. Chaliye menu ya homepage se order continue karte hain.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-xl bg-[#111] px-4 py-2.5 text-sm font-semibold !text-white"
            >
              <Home className="h-4 w-4" />
              Back Home
            </Link>
            <Link
              href="/menu"
              className="inline-flex items-center gap-2 rounded-xl border border-[#dccbbb] bg-white px-4 py-2.5 text-sm font-semibold text-[#5b2d17]"
            >
              <UtensilsCrossed className="h-4 w-4" />
              Browse Menu
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

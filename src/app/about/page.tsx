"use client";

import Image from "next/image";
import { ChefHat, Flame, Sparkles, Users } from "lucide-react";
import SiteHeader from "@/components/public/site-header";

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-[#f5efe8] text-[#2f1c12]">
      <SiteHeader />
      <section className="mx-auto w-full max-w-6xl px-4 pb-20 pt-[90px] sm:px-6 sm:pt-[102px]">
        <div className="grid items-center gap-4 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <p className="inline-flex items-center gap-1 rounded-full border border-[#e1d2c4] bg-white px-3 py-1 text-xs font-semibold text-[#7a3f22]">
              <Sparkles className="h-3.5 w-3.5" />
              Our Story
            </p>
            <h1 className="mt-3 font-[family-name:var(--font-poppins)] text-3xl font-semibold text-[#1c130e] sm:text-4xl">
              About Zaitoon Royale
            </h1>
            <p className="mt-3 text-sm leading-6 text-[#6f5647]">
              Zaitoon Royale delivers a premium dining experience where authentic South Asian flavor meets modern presentation.
              We focus on fresh ingredients, signature recipes, and warm hospitality in every order.
            </p>
            <div className="mt-5 grid gap-2 sm:grid-cols-3">
              <div className="rounded-xl border border-[#e1d2c4] bg-white px-3 py-2.5 text-sm font-medium text-[#2f1c12]">15+ Signature Dishes</div>
              <div className="rounded-xl border border-[#e1d2c4] bg-white px-3 py-2.5 text-sm font-medium text-[#2f1c12]">Fast Delivery</div>
              <div className="rounded-xl border border-[#e1d2c4] bg-white px-3 py-2.5 text-sm font-medium text-[#2f1c12]">Family Friendly</div>
            </div>
          </div>
          <div className="relative h-[230px] overflow-hidden rounded-3xl border border-[#e1d2c4] sm:h-[320px]">
            <Image
              src="https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=1400&q=80"
              alt="Restaurant interior"
              fill
              unoptimized
              className="object-cover"
            />
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-[#e1d2c4] bg-white p-4">
            <ChefHat className="h-5 w-5 text-[#7a3f22]" />
            <p className="mt-2 text-sm font-semibold text-[#2f1c12]">Expert Chefs</p>
            <p className="mt-1 text-xs leading-5 text-[#6f5647]">Every dish is prepared by trained chefs with consistent quality checks and plating standards.</p>
          </div>
          <div className="rounded-2xl border border-[#e1d2c4] bg-white p-4">
            <Flame className="h-5 w-5 text-[#7a3f22]" />
            <p className="mt-2 text-sm font-semibold text-[#2f1c12]">Authentic Taste</p>
            <p className="mt-1 text-xs leading-5 text-[#6f5647]">Traditional flavors are served with a refined modern style for a memorable dining experience.</p>
          </div>
          <div className="rounded-2xl border border-[#e1d2c4] bg-white p-4">
            <Users className="h-5 w-5 text-[#7a3f22]" />
            <p className="mt-2 text-sm font-semibold text-[#2f1c12]">For Everyone</p>
            <p className="mt-1 text-xs leading-5 text-[#6f5647]">From family dinners to quick solo meals, our menu is designed for every kind of guest.</p>
          </div>
        </div>
      </section>
    </main>
  );
}


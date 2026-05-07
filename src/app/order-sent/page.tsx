"use client";

import Link from "next/link";
import { motion } from "framer-motion";

import SiteHeader from "@/components/public/site-header";

export default function OrderSentPage() {
  const sprinkles = Array.from({ length: 22 }).map((_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    delay: Math.random() * 0.6,
    duration: 1.2 + Math.random() * 1.1,
    color: ["#f59e0b", "#ef4444", "#10b981", "#3b82f6", "#a855f7"][i % 5],
  }));

  return (
    <main className="min-h-screen bg-[#f5efe8] text-[#2f1c12] antialiased">
      <SiteHeader />
      <section className="px-0 pb-10 pt-[96px] sm:mx-auto sm:max-w-4xl sm:px-6">
        <div className="relative overflow-hidden border-y border-[#eadccf] bg-white p-6 text-center sm:rounded-3xl sm:border sm:p-10">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {sprinkles.map((s) => (
              <motion.span
                key={s.id}
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: [0, 120], opacity: [0, 1, 0] }}
                transition={{ delay: s.delay, duration: s.duration, repeat: Infinity, repeatDelay: 0.3 }}
                style={{ left: s.left, backgroundColor: s.color }}
                className="absolute top-0 h-2 w-1 rounded-full"
              />
            ))}
          </div>
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 240, damping: 16 }}
            className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#5b2d17] text-4xl text-white"
          >
            🎉
          </motion.div>

          <motion.h1
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.3 }}
            className="mt-4 font-[family-name:var(--font-poppins)] text-3xl font-semibold text-[#111]"
          >
            Hurray! Order Sent
          </motion.h1>
          <motion.p
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.22, duration: 0.3 }}
            className="mt-2 text-sm text-[#6f5647] sm:text-base"
          >
            Now your order is on the way.
          </motion.p>

          <motion.div
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.3 }}
            className="mt-6 flex flex-wrap items-center justify-center gap-2"
          >
            <Link href="/orders" className="rounded-xl border border-[#eadccf] bg-white px-4 py-2 text-sm font-semibold text-[#5b2d17]">
              View orders
            </Link>
            <Link href="/menu" className="rounded-xl border border-[#eadccf] bg-white px-4 py-2 text-sm font-semibold text-[#5b2d17]">
              Back to Menu
            </Link>
            <Link href="/" className="rounded-xl bg-[#111] px-4 py-2 text-sm font-semibold !text-white">
              Go Home
            </Link>
          </motion.div>
        </div>
      </section>
    </main>
  );
}


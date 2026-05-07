"use client";

import Link from "next/link";
import SiteHeader from "@/components/public/site-header";
import { useCustomerSession } from "@/lib/customer-auth";

export default function ProfilePage() {
  const { hasSession, profile } = useCustomerSession();
  return (
    <main className="min-h-screen bg-[#f5efe8] text-[#2f1c12]">
      <SiteHeader />
      <section className="mx-auto w-full max-w-4xl px-4 pb-20 pt-[90px] sm:px-6 sm:pt-[102px]">
        <h1 className="font-[family-name:var(--font-poppins)] text-3xl font-semibold text-[#1c130e]">Profile</h1>
        {!hasSession ? (
          <p className="mt-4 text-sm text-[#6f5647]">Checkout ke baad profile yahan show hogi.</p>
        ) : (
          <div className="mt-5 rounded-2xl border border-[#e1d2c4] bg-white p-6">
            <p className="text-sm text-[#8a6f5e]">Name</p>
            <p className="text-lg font-semibold">{profile?.name || "-"}</p>
            <p className="mt-3 text-sm text-[#8a6f5e]">Phone</p>
            <p className="text-base font-medium">{profile?.phone || "-"}</p>
            <p className="mt-3 text-sm text-[#8a6f5e]">Email</p>
            <p className="text-base font-medium">{profile?.email || "-"}</p>
            <Link href="/profile/edit" className="mt-5 inline-block rounded-xl bg-[#5b2d17] px-5 py-2.5 text-sm font-semibold text-white">
              Edit profile
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}


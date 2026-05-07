"use client";

import SiteHeader from "@/components/public/site-header";
import SiteFooter from "@/components/public/site-footer";

export default function TermsAndConditionsPage() {
  return (
    <main className="min-h-screen bg-[#f5efe8] text-[#2f1c12]">
      <SiteHeader />
      <section className="mx-auto w-full max-w-4xl px-4 pb-20 pt-[92px] sm:px-6 sm:pt-[104px]">
        <div className="rounded-2xl border border-[#e4d5c7] bg-white p-5 sm:p-6">
          <h1 className="font-[family-name:var(--font-poppins)] text-2xl font-semibold text-[#1c130e]">Terms & Conditions</h1>
          <p className="mt-2 text-sm text-[#6f5647]">Last updated: May 2026</p>

          <div className="mt-5 space-y-4 text-sm leading-6 text-[#3a271b]">
            <p>
              By placing an order on our platform, you agree to provide accurate contact and delivery information and to
              accept our order confirmation process.
            </p>
            <p>
              Delivery times are estimated and may vary due to traffic, weather, or operational constraints.
            </p>
            <p>
              Cancelled or modified orders may be subject to restaurant policy based on preparation status.
            </p>
            <p>
              Misuse of the platform, abusive behavior, or fraudulent activity may result in restricted service access.
            </p>
          </div>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}

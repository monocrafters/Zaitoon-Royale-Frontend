"use client";

import SiteHeader from "@/components/public/site-header";
import SiteFooter from "@/components/public/site-footer";

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-[#f5efe8] text-[#2f1c12]">
      <SiteHeader />
      <section className="mx-auto w-full max-w-4xl px-4 pb-20 pt-[92px] sm:px-6 sm:pt-[104px]">
        <div className="rounded-2xl border border-[#e4d5c7] bg-white p-5 sm:p-6">
          <h1 className="font-[family-name:var(--font-poppins)] text-2xl font-semibold text-[#1c130e]">Privacy Policy</h1>
          <p className="mt-2 text-sm text-[#6f5647]">Last updated: May 2026</p>

          <div className="mt-5 space-y-4 text-sm leading-6 text-[#3a271b]">
            <p>
              We collect basic customer data such as name, phone, email, delivery address, and order details to process
              orders and provide support services.
            </p>
            <p>
              We use your information to confirm orders, deliver food, share order updates, and improve service quality.
              We do not sell personal data to third parties.
            </p>
            <p>
              Payment, technical, and analytics providers may process limited operational data required for secure platform
              functionality.
            </p>
            <p>
              You can request profile updates or account data corrections by contacting our support team.
            </p>
          </div>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}

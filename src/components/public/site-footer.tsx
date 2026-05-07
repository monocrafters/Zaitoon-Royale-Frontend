import Link from "next/link";
import { Globe, Mail, MessageCircle, Phone } from "lucide-react";
import { useRestaurantSettings } from "@/lib/restaurant-settings";

export default function SiteFooter() {
  const settings = useRestaurantSettings();
  return (
    <footer className="border-t border-[#e4d3c4] bg-gradient-to-b from-[#f3e8dd] to-[#eadbcc]">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="grid gap-7 md:grid-cols-3">
          <div className="rounded-3xl border border-[#e7d6c6] bg-white/65 p-5 backdrop-blur">
            <p className="font-[family-name:var(--font-poppins)] text-xl font-semibold text-[#2f1c12]">{settings.brandName}</p>
            <p className="mt-2 text-sm leading-6 text-[#6f5647]">
              Premium taste, clean quality, and fast delivery. Crafted for families and food lovers in Lahore.
            </p>
          </div>
          <div className="rounded-3xl border border-[#e7d6c6] bg-white/65 p-5 backdrop-blur">
            <p className="font-[family-name:var(--font-poppins)] text-sm font-semibold uppercase tracking-wide text-[#5b2d17]">
              Quick Links
            </p>
            <div className="mt-3 space-y-2 text-sm text-[#6f5647]">
              <Link href="/#home" className="block rounded-lg px-2 py-1 transition hover:bg-[#f7efe6] hover:text-[#2f1c12]">Home</Link>
              <Link href="/menu" className="block rounded-lg px-2 py-1 transition hover:bg-[#f7efe6] hover:text-[#2f1c12]">Menu</Link>
              <Link href="/offers" className="block rounded-lg px-2 py-1 transition hover:bg-[#f7efe6] hover:text-[#2f1c12]">Offers</Link>
              <Link href="/contact-us" className="block rounded-lg px-2 py-1 transition hover:bg-[#f7efe6] hover:text-[#2f1c12]">Contact</Link>
              <Link href="/privacy-policy" className="block rounded-lg px-2 py-1 transition hover:bg-[#f7efe6] hover:text-[#2f1c12]">Privacy Policy</Link>
              <Link href="/terms-and-conditions" className="block rounded-lg px-2 py-1 transition hover:bg-[#f7efe6] hover:text-[#2f1c12]">Terms & Conditions</Link>
            </div>
          </div>
          <div className="rounded-3xl border border-[#e7d6c6] bg-white/65 p-5 backdrop-blur">
            <p className="font-[family-name:var(--font-poppins)] text-sm font-semibold uppercase tracking-wide text-[#5b2d17]">
              Contact
            </p>
            <div className="mt-3 space-y-2 text-sm text-[#6f5647]">
              <p className="flex items-center gap-2"><Phone className="h-4 w-4" /> {settings.contactPhone}</p>
              <p className="flex items-center gap-2"><Mail className="h-4 w-4" /> {settings.contactEmail}</p>
              <div className="flex items-center gap-3 pt-1 text-[#5b2d17]">
                <a href={settings.socialLinks.facebook || "#"} aria-label="Website"><Globe className="h-5 w-5" /></a>
                <a href={settings.socialLinks.instagram || "#"} aria-label="Social"><MessageCircle className="h-5 w-5" /></a>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-6 border-t border-[#e5d2c1] pt-4 text-center text-xs text-[#7a6a5d]">
          <p>© {new Date().getFullYear()} {settings.brandName} — All rights reserved.</p>
          <div className="mt-2 flex items-center justify-center gap-3">
            <Link href="/privacy-policy" className="underline-offset-2 hover:underline">Privacy Policy</Link>
            <span>•</span>
            <Link href="/terms-and-conditions" className="underline-offset-2 hover:underline">Terms & Conditions</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

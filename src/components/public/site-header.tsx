"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, MapPin, Menu, Package, Pencil, Phone, ShoppingCart, TicketPercent, UtensilsCrossed, X } from "lucide-react";
import { API_BASE_URL } from "@/lib/admin-auth";
import { useCartUnreadCount } from "@/lib/cart-client";
import { getCustomerToken, useCustomerSession } from "@/lib/customer-auth";
import { useRestaurantSettings } from "@/lib/restaurant-settings";
import ReviewPromptModal from "@/components/public/review-prompt-modal";

const baseNavLinks = [
  { href: "/#home", label: "Home" },
  { href: "/menu", label: "Menu" },
  { href: "/offers", label: "Offers" },
  { href: "/about", label: "About" },
  { href: "/contact-us", label: "Contact" },
  { href: "/support", label: "Support" },
];

export default function SiteHeader() {
  const pathname = usePathname();
  const cartUnreadCount = useCartUnreadCount();
  const { hasSession, profile } = useCustomerSession();
  const [isMounted, setIsMounted] = useState(false);
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [supportUnreadCount, setSupportUnreadCount] = useState(0);
  const showSessionActions = isMounted && hasSession;
  const customerName = useMemo(() => String(profile?.name || "").trim(), [profile?.name]);
  const customerPhone = useMemo(() => String(profile?.phone || "").trim(), [profile?.phone]);
  const customerInitial = customerName ? customerName.charAt(0).toUpperCase() : "U";
  const customerAvatar = String(profile?.profileImageUrl || "").trim();
  const settings = useRestaurantSettings();
  // Hydration safety: server doesn't have localStorage, so only show profile data after mount.
  const displayName = isMounted ? customerName : "";
  const displayPhone = isMounted ? customerPhone : "";
  const displayAvatar = isMounted ? customerAvatar : "";
  const displayInitial = isMounted ? customerInitial : "U";
  const mobileItems = [
    { href: "/", label: "Home", icon: House, active: pathname === "/" },
    { href: "/menu", label: "Menu", icon: UtensilsCrossed, active: pathname === "/menu" || pathname?.startsWith("/product") || pathname?.startsWith("/category") },
    { href: "/offers", label: "Deals", icon: TicketPercent, active: pathname === "/offers" || pathname?.startsWith("/deal") },
    { href: "/cart", label: "Cart", icon: ShoppingCart, active: pathname === "/cart" || pathname === "/checkout" || pathname === "/confirmation" },
    ...(showSessionActions
      ? [{ href: "/orders", label: "Orders", icon: Package, active: pathname === "/orders" || pathname?.startsWith("/orders/") }]
      : []),
  ];

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted || !hasSession) {
      setSupportUnreadCount(0);
      return;
    }
    const loadUnread = async () => {
      const token = getCustomerToken();
      if (!token) return;
      try {
        const res = await fetch(`${API_BASE_URL}/support/my`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const data = await res.json();
        if (!res.ok) return;
        const list = Array.isArray(data.tickets) ? data.tickets : [];
        const total = list.reduce((sum: number, c: { unreadForCustomer?: number }) => sum + Math.max(0, Number(c.unreadForCustomer || 0)), 0);
        setSupportUnreadCount(total);
      } catch {
        // silent
      }
    };
    void loadUnread();
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void loadUnread();
    }, 20000);
    return () => window.clearInterval(timer);
  }, [isMounted, hasSession, pathname]);

  return (
    <>
      <header className="fixed top-0 z-50 w-full border-b border-[#eadccf] bg-[#fffaf4]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/#home" className="flex items-center gap-3">
            <div className="flex h-10 w-auto items-center justify-center">
              {settings.adminLogoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={settings.adminLogoUrl}
                  alt={settings.brandName}
                  className="h-10 w-auto max-w-[220px] object-contain"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#5b2d17] text-white">ZR</div>
              )}
            </div>
            <div>
              <p className="font-[family-name:var(--font-poppins)] text-sm font-semibold">{settings.brandName}</p>
              <p className="text-xs text-[#7f6757]">{settings.tagline}</p>
            </div>
          </Link>

          <nav className="hidden items-center gap-8 lg:flex">
            {baseNavLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="relative font-[family-name:var(--font-poppins)] text-sm text-[#6f5647] transition hover:text-[#2f1c12]"
              >
                {link.label}
                {link.href === "/support" && supportUnreadCount > 0 ? (
                  <span className="absolute -right-4 -top-2 inline-flex min-w-5 items-center justify-center rounded-full bg-[#b84a2b] px-1.5 text-[10px] font-bold leading-5 text-white">
                    {supportUnreadCount > 99 ? "99+" : supportUnreadCount}
                  </span>
                ) : null}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-2 lg:flex">
            {showSessionActions ? (
              <Link
                href="/orders"
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#dccbbb] bg-white px-2.5 py-2 text-sm font-semibold text-[#5b2d17] transition hover:bg-[#f6ece2] sm:px-3"
                aria-label="Orders"
              >
                <Package className="h-[18px] w-[18px] shrink-0 sm:h-4 sm:w-4" aria-hidden />
                Orders
              </Link>
            ) : null}
            <Link
              href="/cart"
              className="relative rounded-xl border border-[#dccbbb] bg-white p-2.5 text-[#5b2d17] transition hover:bg-[#f6ece2]"
              aria-label="Open cart"
            >
              <ShoppingCart className="h-5 w-5" />
              {cartUnreadCount > 0 ? (
                <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-[#b84a2b] px-1.5 text-[10px] font-bold leading-5 text-white">
                  {cartUnreadCount > 99 ? "99+" : cartUnreadCount}
                </span>
              ) : null}
            </Link>
            {showSessionActions ? (
              <Link
                href="/profile/edit"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#dccbbb] bg-white text-[#5b2d17] transition hover:bg-[#f6ece2]"
                aria-label="Edit profile"
              >
                {displayAvatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={displayAvatar} alt={displayName || "Profile"} className="h-7 w-7 rounded-full object-cover" />
                ) : (
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#f3e4d7] text-xs font-semibold text-[#5b2d17]">
                    {displayInitial}
                  </span>
                )}
              </Link>
            ) : null}
          </div>

          <div className="inline-flex items-center gap-2 lg:hidden">
            {showSessionActions ? (
              <Link href="/profile" className="inline-flex items-center gap-2 rounded-xl border border-[#dccbbb] bg-white px-2 py-1.5">
                {displayAvatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={displayAvatar} alt={displayName || "Profile"} className="h-7 w-7 rounded-full object-cover" />
                ) : (
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#f3e4d7] text-xs font-semibold text-[#5b2d17]">
                    {displayInitial}
                  </span>
                )}
                <span className="max-w-[84px] truncate text-xs font-semibold text-[#2f1c12]">{displayName || "Profile"}</span>
              </Link>
            ) : null}
            <button
              type="button"
              aria-label="Open menu"
              onClick={() => setSidebarOpen(true)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#dccbbb] bg-white text-[#5b2d17]"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>
      <div className={`fixed inset-0 z-[70] transition-opacity duration-300 lg:hidden ${isSidebarOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`}>
        <button
          type="button"
          aria-label="Close menu"
          className="absolute inset-0 bg-black/35"
          onClick={() => setSidebarOpen(false)}
        />
        <aside className={`absolute right-0 top-0 flex h-full w-[80%] max-w-[295px] flex-col border-l border-[#dccbbb] bg-[#fffaf4] px-4 pb-5 pt-4 shadow-2xl transition-transform duration-300 ease-out ${isSidebarOpen ? "translate-x-0" : "translate-x-full"}`}>
          <div className="flex items-start justify-between gap-2 rounded-2xl border border-[#e7d7c9] bg-[#fff3e7] p-2.5">
            <div className="flex min-w-0 flex-1 items-center gap-3 pr-2">
              {displayAvatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={displayAvatar} alt={displayName || "Profile"} className="h-12 w-12 rounded-full object-cover" />
              ) : (
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#f3e4d7] text-base font-semibold text-[#5b2d17]">
                  {displayInitial}
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[#2f1c12]">{displayName || "Guest Customer"}</p>
                <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-[#6f5647]">
                  <Phone className="h-3.5 w-3.5" />
                  {displayPhone || "+92 300 1234567"}
                </p>
              </div>
            </div>
            <div className="ml-1 flex shrink-0 items-center gap-1.5">
              <Link href="/profile/edit" onClick={() => setSidebarOpen(false)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#dccbbb] bg-white text-[#5b2d17]">
                <Pencil className="h-4 w-4" />
              </Link>
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setSidebarOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#dccbbb] bg-white text-[#5b2d17]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="mt-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8a6f5e]">Quick menu</p>
            <nav className="mt-2 space-y-2">
              <Link onClick={() => setSidebarOpen(false)} href="/about" className="block rounded-xl bg-white px-3 py-2.5 text-sm font-medium text-[#2f1c12]">About</Link>
              <Link onClick={() => setSidebarOpen(false)} href="/contact-us" className="block rounded-xl bg-white px-3 py-2.5 text-sm font-medium text-[#2f1c12]">Contact Us</Link>
              <Link onClick={() => setSidebarOpen(false)} href="/support" className="relative block rounded-xl bg-white px-3 py-2.5 text-sm font-medium text-[#2f1c12]">
                Support
                {supportUnreadCount > 0 ? (
                  <span className="absolute right-2.5 top-1/2 inline-flex min-w-5 -translate-y-1/2 items-center justify-center rounded-full bg-[#b84a2b] px-1.5 text-[10px] font-bold leading-5 text-white">
                    {supportUnreadCount > 99 ? "99+" : supportUnreadCount}
                  </span>
                ) : null}
              </Link>
            </nav>
          </div>
          <div className="mt-auto pt-4">
            <p className="text-sm font-semibold text-[#5b2d17]">{settings.brandName}</p>
            <p className="mt-1 flex items-center gap-1 text-xs text-[#6f5647]"><MapPin className="h-3.5 w-3.5 shrink-0" /> {settings.contactAddress}</p>
            <p className="mt-1 flex items-center gap-1 text-xs text-[#6f5647]"><Phone className="h-3.5 w-3.5 shrink-0" /> {settings.contactPhone}</p>
            <div className="mt-3 flex items-center gap-3 text-[#7a3f22]">
              <a href={settings.socialLinks.instagram || "https://instagram.com"} target="_blank" rel="noreferrer" aria-label="Instagram" className="rounded-xl bg-white p-2.5">
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.8"><rect x="3.5" y="3.5" width="17" height="17" rx="5" /><circle cx="12" cy="12" r="3.5" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" /></svg>
              </a>
              <a href={settings.socialLinks.youtube || "https://youtube.com"} target="_blank" rel="noreferrer" aria-label="YouTube" className="rounded-xl bg-white p-2.5">
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current"><path d="M21 8.5a2.4 2.4 0 0 0-1.7-1.7C17.8 6.4 12 6.4 12 6.4s-5.8 0-7.3.4A2.4 2.4 0 0 0 3 8.5 25 25 0 0 0 2.6 12c0 1.2.1 2.3.4 3.5a2.4 2.4 0 0 0 1.7 1.7c1.5.4 7.3.4 7.3.4s5.8 0 7.3-.4a2.4 2.4 0 0 0 1.7-1.7c.3-1.2.4-2.3.4-3.5 0-1.2-.1-2.3-.4-3.5ZM10.2 14.8V9.2L15 12l-4.8 2.8Z"/></svg>
              </a>
              <a href={settings.socialLinks.tiktok || "https://www.tiktok.com"} target="_blank" rel="noreferrer" aria-label="TikTok" className="rounded-xl bg-white p-2.5">
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current"><path d="M14.5 3c.4 1.9 1.5 3.1 3.5 3.4v2.6c-1.4 0-2.6-.4-3.5-1v6c0 3-2.2 5-5.1 5-2.7 0-4.9-2-4.9-4.8s2.2-4.8 4.9-4.8c.3 0 .7 0 1 .1V12a2.7 2.7 0 0 0-1-.2c-1.5 0-2.5 1-2.5 2.4s1 2.4 2.5 2.4c1.6 0 2.5-1 2.5-2.8V3h2.6Z"/></svg>
              </a>
            </div>
          </div>
        </aside>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-[60] border-t border-[#dccbbb] bg-[#fffaf4]/95 px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 backdrop-blur lg:hidden">
        <ul className="flex items-end justify-around gap-1">
          {mobileItems.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={[
                    "flex min-w-[52px] flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-1.5 text-[10px] font-medium transition [&_span]:text-current",
                    item.active
                      ? "bg-[#5b2d17] !text-white [&_svg]:text-white [&_span]:!text-white"
                      : "text-[#6f5647] hover:bg-[#f3e8dc]",
                  ].join(" ")}
                >
                  <span className="relative">
                    <Icon className="h-4 w-4" aria-hidden />
                    {item.href === "/cart" && cartUnreadCount > 0 ? (
                      <span className="absolute -right-2 -top-2 inline-flex min-w-4 items-center justify-center rounded-full bg-[#b84a2b] px-1 text-[9px] font-bold leading-4 text-white">
                        {cartUnreadCount > 99 ? "99+" : cartUnreadCount}
                      </span>
                    ) : null}
                  </span>
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      {showSessionActions ? <ReviewPromptModal /> : null}
    </>
  );
}


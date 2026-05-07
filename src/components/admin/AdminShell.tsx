"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  X,
} from "lucide-react";

import { adminMenuItems, adminPageTitleMap } from "@/components/admin/admin-menu";
import { API_BASE_URL, getAdminToken } from "@/lib/admin-auth";
import { useRestaurantSettings } from "@/lib/restaurant-settings";

type AdminInfo = {
  name?: string;
  email?: string;
};

type SidebarProps = {
  mobile?: boolean;
  collapsed: boolean;
  pathname: string;
  onToggleCollapse: () => void;
  onCloseMobile: () => void;
};

function AdminSidebar({
  mobile = false,
  collapsed,
  pathname,
  onToggleCollapse,
  onCloseMobile,
}: SidebarProps) {
  const settings = useRestaurantSettings();
  return (
    <motion.aside
      className="h-full border-r border-[var(--border)] bg-white/95 backdrop-blur"
      initial={false}
      animate={{ width: mobile ? 280 : collapsed ? 74 : 280 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
    >
      <div className="flex h-full flex-col">
        <div className="relative flex h-[78px] items-center border-b border-[var(--border)] px-3">
          {collapsed && !mobile ? (
            <div className="flex w-full justify-center">
              <button
                type="button"
                onClick={onToggleCollapse}
                className="rounded-xl border border-[var(--border)] p-2 text-[var(--muted)] transition hover:bg-[var(--primary-soft)]"
                aria-label="Expand sidebar"
              >
                <Menu className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <>
              <div className="flex w-full items-center gap-3 justify-start">
                {settings.adminLogoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={settings.adminLogoUrl}
                    alt={settings.brandName}
                    className="h-10 w-auto max-w-[210px] object-contain"
                  />
                ) : (
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--primary-soft)] text-[var(--primary)]">
                    <LayoutDashboard className="h-5 w-5" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate font-[family-name:var(--font-poppins)] text-sm font-semibold text-[var(--foreground)]">
                    {settings.brandName}
                  </p>
                  <p className="text-xs text-[var(--muted)]">Admin Panel</p>
                </div>
              </div>

              {!mobile && (
                <button
                  type="button"
                  onClick={onToggleCollapse}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-xl border border-[var(--border)] p-2 text-[var(--muted)] transition hover:bg-[var(--primary-soft)]"
                  aria-label="Collapse sidebar"
                >
                  <Menu className="h-4 w-4" />
                </button>
              )}
              {mobile && (
                <button
                  type="button"
                  onClick={onCloseMobile}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-xl border border-[var(--border)] p-2 text-[var(--muted)]"
                  aria-label="Close sidebar"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </>
          )}
        </div>

        {!collapsed || mobile ? (
          <nav className="flex-1 space-y-1 overflow-y-auto p-3">
            {adminMenuItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;

              if (!item.enabled) {
                return (
                  <button
                    key={item.href}
                    type="button"
                    className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-sm text-[var(--muted)] opacity-60"
                    title={`${item.label} (coming soon)`}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onCloseMobile}
                  className={[
                    "flex items-center gap-3 rounded-2xl px-3 py-3 text-sm transition",
                    isActive
                      ? "bg-[var(--primary-soft)] font-medium text-[var(--primary)]"
                      : "text-[var(--muted)] hover:bg-[#fbf6ef] hover:text-[var(--foreground)]",
                  ].join(" ")}
                  title={item.label}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        ) : (
          <nav className="flex-1 space-y-2 overflow-y-auto p-2">
            {adminMenuItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;

              const baseClass = [
                "mx-auto flex h-10 w-10 items-center justify-center rounded-xl transition",
                isActive
                  ? "bg-[var(--primary-soft)] text-[var(--primary)]"
                  : "text-[var(--muted)] hover:bg-[#fbf6ef] hover:text-[var(--foreground)]",
                !item.enabled ? "opacity-60" : "",
              ].join(" ");

              if (!item.enabled) {
                return (
                  <button
                    key={item.href}
                    type="button"
                    className={baseClass}
                    title={`${item.label} (coming soon)`}
                  >
                    <Icon className="h-5 w-5" />
                  </button>
                );
              }

              return (
                <Link key={item.href} href={item.href} className={baseClass} title={item.label}>
                  <Icon className="h-5 w-5" />
                </Link>
              );
            })}
          </nav>
        )}
      </div>
    </motion.aside>
  );
}

type AdminShellProps = {
  admin: AdminInfo | null;
  onLogoutConfirm: () => void;
  children: React.ReactNode;
};

type HeaderNotification = {
  id: string;
  title: string;
  href: string;
  type: "support" | "contact";
  unreadCount: number;
};

export default function AdminShell({ admin, onLogoutConfirm, children }: AdminShellProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [notificationMenuOpen, setNotificationMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [mobileActionMenuOpen, setMobileActionMenuOpen] = useState(false);
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [recentNotifications, setRecentNotifications] = useState<HeaderNotification[]>([]);
  const actionMenuRef = useRef<HTMLDivElement | null>(null);

  const currentTitle = useMemo(() => {
    if (pathname.startsWith("/admin/categories/")) {
      return adminPageTitleMap["/admin/categories/detail"];
    }
    if (pathname.startsWith("/admin/products/")) {
      return adminPageTitleMap["/admin/products/detail"];
    }
    if (pathname.startsWith("/admin/orders/")) {
      return adminPageTitleMap["/admin/orders/detail"];
    }

    return adminPageTitleMap[pathname] || "Dashboard";
  }, [pathname]);
  useEffect(() => {
    const loadNotifications = async () => {
      const token = getAdminToken();
      if (!token) return;
      try {
        const res = await fetch(`${API_BASE_URL}/notifications/admin`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const payload = await res.json();
        if (!res.ok) return;
        setUnreadNotifications(Number(payload.summary?.totalUnread || 0));
        const list = Array.isArray(payload.notifications) ? payload.notifications : [];
        setRecentNotifications(
          list.slice(0, 5).map((n: { id?: string; title?: string; href?: string; type?: string }) => ({
            id: String(n.id || ""),
            title: String(n.title || "New notification"),
            href: String(n.href || "/admin/notifications"),
            type: n.type === "contact" ? "contact" : "support",
            unreadCount: Math.max(0, Number((n as { unreadCount?: number }).unreadCount || 0)),
          }))
        );
      } catch {
        // silent
      }
    };

    void loadNotifications();
    const timer = window.setInterval(() => void loadNotifications(), 12000);
    return () => window.clearInterval(timer);
  }, [pathname]);

  useEffect(() => {
    const handleOutside = (event: MouseEvent) => {
      if (!actionMenuRef.current) return;
      if (!actionMenuRef.current.contains(event.target as Node)) {
        setNotificationMenuOpen(false);
        setProfileMenuOpen(false);
        setMobileActionMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const requestLogout = () => {
    setNotificationMenuOpen(false);
    setProfileMenuOpen(false);
    setMobileActionMenuOpen(false);
    setLogoutModalOpen(true);
  };

  return (
    <main className="min-h-screen bg-transparent">
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.button
              type="button"
              className="fixed inset-0 z-40 bg-black/35 lg:hidden"
              aria-label="Close mobile menu"
              onClick={() => setMobileMenuOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            <motion.div
              className="fixed left-0 top-0 z-50 h-screen lg:hidden"
              initial={{ x: -320 }}
              animate={{ x: 0 }}
              exit={{ x: -320 }}
              transition={{ type: "spring", stiffness: 340, damping: 33 }}
            >
              <AdminSidebar
                mobile
                collapsed={collapsed}
                pathname={pathname}
                onToggleCollapse={() => setCollapsed((prev) => !prev)}
                onCloseMobile={() => setMobileMenuOpen(false)}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:block">
        <AdminSidebar
          collapsed={collapsed}
          pathname={pathname}
          onToggleCollapse={() => setCollapsed((prev) => !prev)}
          onCloseMobile={() => setMobileMenuOpen(false)}
        />
      </div>

      <div
        className={[
          "transition-[padding] duration-300 ease-out",
          collapsed ? "lg:pl-[74px]" : "lg:pl-[280px]",
        ].join(" ")}
      >
        <header
          className={[
            "fixed left-0 right-0 top-0 z-20 border-b border-[var(--border)] bg-white/95 backdrop-blur",
            "transition-[left] duration-300 ease-out",
            collapsed ? "lg:left-[74px]" : "lg:left-[280px]",
          ].join(" ")}
        >
          <div
            ref={actionMenuRef}
            className="relative flex h-[64px] items-center justify-between gap-2 px-3 sm:h-[74px] sm:gap-3 sm:px-6"
          >
            <div className="min-w-0 flex items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="rounded-xl border border-[var(--border)] p-1.5 text-[var(--muted)] lg:hidden"
                aria-label="Open mobile menu"
              >
                <Menu className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
              <div className="min-w-0">
                <p className="hidden text-xs text-[var(--muted)] sm:block">Admin Panel</p>
                <h1 className="truncate font-[family-name:var(--font-poppins)] text-[19px] font-semibold leading-tight text-[var(--foreground)] sm:text-xl">
                  {currentTitle}
                </h1>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
              <button
                type="button"
                onClick={() => {
                  setNotificationMenuOpen((prev) => !prev);
                  setProfileMenuOpen(false);
                }}
                className="relative rounded-xl border border-[var(--border)] p-1.5 text-[var(--muted)] transition hover:bg-[var(--primary-soft)] sm:p-2"
                aria-label="Notifications"
              >
                <Bell className="h-4 w-4 sm:h-5 sm:w-5" />
                {unreadNotifications > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--primary)] px-1 text-[10px] font-semibold text-white">
                    {unreadNotifications}
                  </span>
                )}
              </button>
              <AnimatePresence>
                {notificationMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.98 }}
                    transition={{ duration: 0.16 }}
                    className="absolute right-4 top-[68px] z-30 w-[290px] rounded-2xl border border-[var(--border)] bg-white p-3 shadow-[0_14px_40px_rgba(36,24,15,0.12)] sm:right-[230px]"
                  >
                    <p className="px-2 pb-2 text-sm font-semibold text-[var(--foreground)]">
                      Notifications
                    </p>
                    <div className="space-y-1">
                      {recentNotifications.length ? (
                        recentNotifications.map((item) => (
                          <Link
                            key={item.id}
                            href={item.href}
                            onClick={() => setNotificationMenuOpen(false)}
                            className={[
                              "flex items-center justify-between gap-2 rounded-xl px-2 py-2 text-sm hover:bg-[var(--primary-soft)]",
                              item.unreadCount > 0 ? "font-semibold text-[var(--foreground)]" : "text-[var(--muted)]",
                            ].join(" ")}
                          >
                            <span className="line-clamp-1">{item.title}</span>
                            {item.unreadCount > 0 ? (
                              <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-[var(--primary)] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                                {item.unreadCount}
                              </span>
                            ) : null}
                          </Link>
                        ))
                      ) : (
                        <div className="rounded-xl px-2 py-2 text-sm text-[var(--muted)]">
                          No new notifications.
                        </div>
                      )}
                      <Link
                        href="/admin/notifications"
                        onClick={() => setNotificationMenuOpen(false)}
                        className="mt-1 block rounded-xl border border-[var(--border)] px-2 py-2 text-center text-xs font-semibold text-[var(--foreground)] hover:bg-[#fbf6ef]"
                      >
                        View all notifications
                      </Link>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <Link
                href="/admin/settings"
                className="hidden rounded-xl border border-[var(--border)] px-3 py-2 text-sm text-[var(--muted)] transition hover:bg-[var(--primary-soft)] sm:inline-flex"
              >
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </Link>

              <button
                type="button"
                onClick={() => {
                  setProfileMenuOpen((prev) => !prev);
                  setNotificationMenuOpen(false);
                }}
                className="hidden items-center gap-2 rounded-xl border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)] transition hover:bg-[var(--primary-soft)] sm:inline-flex"
              >
                <span>{admin?.name || "Admin"}</span>
                <ChevronDown className="h-4 w-4" />
              </button>
              <AnimatePresence>
                {profileMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.98 }}
                    transition={{ duration: 0.16 }}
                    className="absolute right-[66px] top-[68px] z-30 hidden w-[230px] rounded-2xl border border-[var(--border)] bg-white p-2 shadow-[0_14px_40px_rgba(36,24,15,0.12)] sm:block"
                  >
                    <p className="px-3 py-2 text-sm font-medium text-[var(--foreground)]">
                      {admin?.name || "Admin"}
                    </p>
                    <p className="px-3 pb-2 text-xs text-[var(--muted)]">
                      {admin?.email || "admin@restaurant.com"}
                    </p>
                    <button
                      type="button"
                      onClick={requestLogout}
                      className="mt-1 flex w-full rounded-xl px-3 py-2 text-left text-sm text-[#9b1c1c] hover:bg-red-50"
                    >
                      Logout
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              <button
                type="button"
                onClick={() => {
                  setMobileActionMenuOpen((prev) => !prev);
                  setNotificationMenuOpen(false);
                  setProfileMenuOpen(false);
                }}
                className="inline-flex items-center gap-1 rounded-xl border border-[var(--border)] px-2.5 py-1.5 text-sm text-[var(--foreground)] transition hover:bg-[var(--primary-soft)] sm:hidden"
              >
                <span>Admin</span>
                <ChevronDown className="h-4 w-4" />
              </button>
              <AnimatePresence>
                {mobileActionMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.98 }}
                    transition={{ duration: 0.16 }}
                    className="absolute right-4 top-[68px] z-30 w-[220px] rounded-2xl border border-[var(--border)] bg-white p-2 shadow-[0_14px_40px_rgba(36,24,15,0.12)] sm:hidden"
                  >
                    <p className="px-3 py-2 text-sm font-medium text-[var(--foreground)]">
                      {admin?.name || "Admin"}
                    </p>
                    <button
                      type="button"
                      onClick={requestLogout}
                      className="mt-1 flex w-full rounded-xl px-3 py-2 text-left text-sm text-[#9b1c1c] hover:bg-red-50"
                    >
                      Logout
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              <button
                type="button"
                onClick={requestLogout}
                className="hidden items-center gap-2 rounded-xl bg-[var(--primary)] px-3 py-2 text-sm text-white transition hover:bg-[#472212] sm:inline-flex"
              >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </header>

        <div className="pt-[80px] sm:pt-[90px]">
          <div className="p-4 sm:p-6">{children}</div>
        </div>
      </div>

      <AnimatePresence>
        {logoutModalOpen && (
          <>
            <motion.button
              type="button"
              className="fixed inset-0 z-[60] bg-black/35"
              onClick={() => setLogoutModalOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              aria-label="Close logout modal"
            />
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.96 }}
              transition={{ duration: 0.2 }}
              className="fixed left-1/2 top-1/2 z-[61] max-h-[85vh] w-[92%] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl border border-[var(--border)] bg-white p-4 shadow-[0_22px_70px_rgba(36,24,15,0.2)] sm:p-6"
            >
              <h2 className="font-[family-name:var(--font-poppins)] text-2xl font-semibold text-[var(--foreground)]">
                Confirm Logout
              </h2>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                Are you sure you want to logout from your admin session?
              </p>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setLogoutModalOpen(false)}
                  className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm text-[var(--muted)] hover:bg-[var(--primary-soft)]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={onLogoutConfirm}
                  className="rounded-xl bg-[var(--primary)] px-4 py-2 text-sm text-white hover:bg-[#472212]"
                >
                  Logout
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </main>
  );
}

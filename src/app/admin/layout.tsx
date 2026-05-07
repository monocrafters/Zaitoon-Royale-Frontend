"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import AdminShell from "@/components/admin/AdminShell";
import { API_BASE_URL, clearAdminAuth, getAdminToken } from "@/lib/admin-auth";
import ModernLoader from "@/components/ui/modern-loader";

type AdminProfile = {
  name: string;
  email: string;
};

const ADMIN_CACHE_KEY = "restaurant_admin_profile_cache";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [admin, setAdmin] = useState<AdminProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAdmin = async () => {
      const token = getAdminToken();

      if (!token) {
        router.replace("/admin_Login");
        return;
      }

      const cachedAdmin =
        typeof window !== "undefined" ? window.sessionStorage.getItem(ADMIN_CACHE_KEY) : null;

      if (cachedAdmin) {
        try {
          setAdmin(JSON.parse(cachedAdmin));
          setLoading(false);
        } catch {
          // Ignore malformed cache and continue to network fetch.
        }
      }

      try {
        const response = await fetch(`${API_BASE_URL}/admin/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Unable to load admin.");
        }

        setAdmin(data.admin);
        if (typeof window !== "undefined") {
          window.sessionStorage.setItem(ADMIN_CACHE_KEY, JSON.stringify(data.admin));
        }
      } catch {
        clearAdminAuth();
        if (typeof window !== "undefined") {
          window.sessionStorage.removeItem(ADMIN_CACHE_KEY);
        }
        router.replace("/admin_Login");
      } finally {
        setLoading(false);
      }
    };

    loadAdmin();
  }, [router]);

  const handleLogout = () => {
    clearAdminAuth();
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(ADMIN_CACHE_KEY);
    }
    router.replace("/admin_Login");
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="rounded-3xl border border-[var(--border)] bg-white px-6 py-5 shadow-sm">
          <ModernLoader label="Preparing your workspace..." />
        </div>
      </main>
    );
  }

  return (
    <AdminShell admin={admin} onLogoutConfirm={handleLogout}>
      {children}
    </AdminShell>
  );
}

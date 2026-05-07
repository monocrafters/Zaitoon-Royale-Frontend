"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, LockKeyhole, Mail, ShieldCheck } from "lucide-react";

import { API_BASE_URL, getAdminToken, setAdminAuth } from "@/lib/admin-auth";
import { useRestaurantSettings } from "@/lib/restaurant-settings";

export default function AdminLoginPage() {
  const router = useRouter();
  const settings = useRestaurantSettings();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = getAdminToken();

    if (token) {
      router.replace("/admin/dashboard");
    }
  }, [router]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE_URL}/admin/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to sign in.");
      }

      setAdminAuth(data.token);
      router.replace("/admin/dashboard");
    } catch {
      setError("Invalid email or password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="grid w-full max-w-6xl overflow-hidden rounded-[32px] border border-[var(--border)] bg-[var(--card)] shadow-[0_24px_80px_rgba(92,47,24,0.12)] lg:grid-cols-[1.1fr_0.9fr]">
        <section className="hidden flex-col justify-between bg-[linear-gradient(180deg,#2d160d_0%,#5c2f18_100%)] p-10 text-white lg:flex">
          <div className="flex items-center gap-3">
            {settings.adminLogoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={settings.adminLogoUrl}
                alt={settings.brandName}
                className="h-11 w-auto max-w-[70px] rounded-2xl object-contain"
              />
            ) : (
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/12">
                <ShieldCheck className="h-5 w-5" />
              </div>
            )}
            <div>
              <p className="font-[family-name:var(--font-poppins)] text-lg font-semibold">{settings.brandName}</p>
              <p className="text-sm text-orange-100/80">Admin Portal</p>
            </div>
          </div>

          <div className="space-y-3">
            <h1 className="font-[family-name:var(--font-poppins)] text-4xl font-semibold leading-tight">
              Welcome back
            </h1>
            <p className="max-w-md text-base leading-7 text-orange-50/80">
              Sign in to continue.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-orange-50/90">
            Secure admin access
          </div>
        </section>

        <section className="flex items-center justify-center p-6 sm:p-10">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="w-full max-w-md"
          >
            <div className="mb-8 space-y-3">
              <h2 className="font-[family-name:var(--font-poppins)] text-3xl font-semibold text-[var(--foreground)]">
                Sign in
              </h2>
              <p className="text-sm leading-6 text-[var(--muted)]">Admin access</p>
            </div>

            <form className="space-y-5" onSubmit={handleSubmit}>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-[var(--foreground)]">
                  Email
                </span>
                <div className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-white px-4 py-3 shadow-sm">
                  <Mail className="h-4 w-4 text-[#a78a76]" />
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="manager@restaurant.com"
                    className="w-full bg-transparent text-sm text-[var(--foreground)] outline-none placeholder:text-[#b8a596]"
                    required
                  />
                </div>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-[var(--foreground)]">
                  Password
                </span>
                <div className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-white px-4 py-3 shadow-sm">
                  <LockKeyhole className="h-4 w-4 text-[#a78a76]" />
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter your password"
                    className="w-full bg-transparent text-sm text-[var(--foreground)] outline-none placeholder:text-[#b8a596]"
                    required
                  />
                </div>
              </label>

              {error ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--primary)] px-5 py-3.5 text-sm font-medium text-white transition hover:bg-[#472212] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? "Signing in..." : "Continue to dashboard"}
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          </motion.div>
        </section>
      </div>
    </main>
  );
}

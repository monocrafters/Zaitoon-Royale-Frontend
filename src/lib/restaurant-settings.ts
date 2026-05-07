"use client";

import { useEffect, useState } from "react";
import { API_BASE_URL, getAdminToken } from "@/lib/admin-auth";

export type RestaurantSettings = {
  brandName: string;
  tagline: string;
  adminLogoUrl: string;
  whatsappNumber: string;
  contactPhone: string;
  contactEmail: string;
  contactHours: string;
  contactAddress: string;
  mapEmbedUrl: string;
  socialLinks: {
    instagram: string;
    youtube: string;
    tiktok: string;
    facebook: string;
  };
};

export const defaultRestaurantSettings: RestaurantSettings = {
  brandName: "Zaitoon Royale",
  tagline: "Lahori Fine Dining",
  adminLogoUrl: "",
  whatsappNumber: "+923313269415",
  contactPhone: "+92 3313269415",
  contactEmail: "hello@zaitoonroyale.com",
  contactHours: "Daily: 11:00 AM - 12:00 AM",
  contactAddress: "Food Street, Lahore, Pakistan",
  mapEmbedUrl: "https://www.google.com/maps?q=MM+Alam+Road+Lahore&output=embed",
  socialLinks: { instagram: "", youtube: "", tiktok: "", facebook: "" },
};

const SETTINGS_CACHE_KEY = "restaurant_public_settings_cache_v1";
const SETTINGS_CACHE_TS_KEY = "restaurant_public_settings_cache_ts_v1";
const SETTINGS_TTL_MS = 10 * 60 * 1000;
let publicSettingsInflight: Promise<RestaurantSettings> | null = null;

const normalizeSettings = (raw: Partial<RestaurantSettings> | undefined): RestaurantSettings => ({
  ...defaultRestaurantSettings,
  ...(raw || {}),
  socialLinks: { ...defaultRestaurantSettings.socialLinks, ...(raw?.socialLinks || {}) },
});

export async function fetchPublicRestaurantSettings(): Promise<RestaurantSettings> {
  if (typeof window !== "undefined") {
    const ts = Number(window.sessionStorage.getItem(SETTINGS_CACHE_TS_KEY) || 0);
    const cached = window.sessionStorage.getItem(SETTINGS_CACHE_KEY);
    if (cached && Date.now() - ts < SETTINGS_TTL_MS) {
      try {
        return normalizeSettings(JSON.parse(cached));
      } catch {
        // ignore malformed cache
      }
    }
  }

  if (!publicSettingsInflight) {
    publicSettingsInflight = (async () => {
      const res = await fetch(`${API_BASE_URL}/settings/public`, { cache: "force-cache" });
      const data = await res.json();
      const normalized = res.ok ? normalizeSettings(data.settings || {}) : defaultRestaurantSettings;
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(normalized));
        window.sessionStorage.setItem(SETTINGS_CACHE_TS_KEY, String(Date.now()));
      }
      return normalized;
    })().finally(() => {
      publicSettingsInflight = null;
    });
  }

  return publicSettingsInflight;
}

export async function fetchAdminRestaurantSettings(): Promise<RestaurantSettings> {
  const token = getAdminToken();
  const res = await fetch(`${API_BASE_URL}/settings/admin`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Unable to load settings.");
  return { ...defaultRestaurantSettings, ...(data.settings || {}), socialLinks: { ...defaultRestaurantSettings.socialLinks, ...(data.settings?.socialLinks || {}) } };
}

export async function updateAdminRestaurantSettings(payload: Partial<RestaurantSettings>) {
  const token = getAdminToken();
  const res = await fetch(`${API_BASE_URL}/settings/admin`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Unable to update settings.");
  if (typeof window !== "undefined") {
    window.sessionStorage.removeItem(SETTINGS_CACHE_KEY);
    window.sessionStorage.removeItem(SETTINGS_CACHE_TS_KEY);
  }
  return data.settings as RestaurantSettings;
}

export const useRestaurantSettings = () => {
  const [settings, setSettings] = useState<RestaurantSettings>(defaultRestaurantSettings);
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const next = await fetchPublicRestaurantSettings();
      if (!cancelled) setSettings(next);
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, []);
  return settings;
};

"use client";

import { useEffect, useState } from "react";

import { API_BASE_URL } from "@/lib/admin-auth";

export const CUSTOMER_TOKEN_KEY = "restaurant_customer_token_v1";
export const CUSTOMER_PROFILE_KEY = "restaurant_customer_profile_v1";

const CUSTOMER_EVENT = "restaurant:customer-updated";

export type CustomerProfile = {
  id: string;
  name: string;
  phone: string;
  email?: string;
  profileImageUrl?: string;
  defaultAddress?: string;
  defaultCity?: string;
};

const emitCustomerUpdate = () => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CUSTOMER_EVENT));
};

export const setCustomerSession = (token: string, profile: CustomerProfile) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CUSTOMER_TOKEN_KEY, token);
  window.localStorage.setItem(CUSTOMER_PROFILE_KEY, JSON.stringify(profile));
  emitCustomerUpdate();
};

export const getCustomerToken = () => {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(CUSTOMER_TOKEN_KEY) || "";
};

export const getCustomerProfile = (): CustomerProfile | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CUSTOMER_PROFILE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CustomerProfile;
  } catch {
    return null;
  }
};

export const clearCustomerSession = () => {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(CUSTOMER_TOKEN_KEY);
  window.localStorage.removeItem(CUSTOMER_PROFILE_KEY);
  emitCustomerUpdate();
};

export const useCustomerSession = () => {
  const [hasSession, setHasSession] = useState(() => Boolean(getCustomerToken()));
  const [profile, setProfile] = useState<CustomerProfile | null>(() => getCustomerProfile());

  useEffect(() => {
    const sync = () => {
      setHasSession(Boolean(getCustomerToken()));
      setProfile(getCustomerProfile());
    };
    sync();
    if (typeof window === "undefined") return;
    window.addEventListener(CUSTOMER_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CUSTOMER_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return { hasSession, profile };
};

export const registerCustomerAtCheckout = async (payload: {
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
}) => {
  const res = await fetch(`${API_BASE_URL}/customers/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await res.json()) as {
    message?: string;
    token?: string;
    customer?: {
      id: string;
      name: string;
      phone: string;
      email?: string;
      profileImageUrl?: string;
      defaultAddress?: string;
      defaultCity?: string;
    };
  };
  if (!res.ok || !data.token || !data.customer?.id) {
    throw new Error(data.message || "Could not save your account details.");
  }
  setCustomerSession(data.token, {
    id: String(data.customer.id),
    name: data.customer.name || "",
    phone: data.customer.phone || "",
    email: data.customer.email || "",
    profileImageUrl: data.customer.profileImageUrl || "",
    defaultAddress: data.customer.defaultAddress || "",
    defaultCity: data.customer.defaultCity || "",
  });
  return data;
};

/** Loads saved delivery + profile from API and updates local session. */
export async function fetchCustomerMe(): Promise<CustomerProfile | null> {
  const token = getCustomerToken();
  if (!token) return null;
  const res = await fetch(`${API_BASE_URL}/customers/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const data = (await res.json()) as { customer?: Record<string, unknown> };
  if (!res.ok || !data.customer?.id) return null;
  const c = data.customer;
  const profile: CustomerProfile = {
    id: String(c.id),
    name: String(c.name ?? ""),
    phone: String(c.phone ?? ""),
    email: String(c.email ?? ""),
    profileImageUrl: String(c.profileImageUrl ?? ""),
    defaultAddress: String(c.defaultAddress ?? ""),
    defaultCity: String(c.defaultCity ?? ""),
  };
  setCustomerSession(token, profile);
  return profile;
}

export async function updateCustomerMe(payload: {
  name: string;
  email: string;
  defaultAddress: string;
  defaultCity: string;
  profileImageUrl?: string;
}) {
  const token = getCustomerToken();
  if (!token) throw new Error("Please login first.");
  const res = await fetch(`${API_BASE_URL}/customers/me`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok || !data.customer?.id) throw new Error(data.message || "Unable to update profile.");
  setCustomerSession(token, {
    id: String(data.customer.id),
    name: String(data.customer.name || ""),
    phone: String(data.customer.phone || ""),
    email: String(data.customer.email || ""),
    profileImageUrl: String(data.customer.profileImageUrl || ""),
    defaultAddress: String(data.customer.defaultAddress || ""),
    defaultCity: String(data.customer.defaultCity || ""),
  });
  return data.customer as CustomerProfile;
}

export async function uploadCustomerAvatar(file: File) {
  const token = getCustomerToken();
  if (!token) throw new Error("Please login first.");
  const form = new FormData();
  form.append("image", file);
  const res = await fetch(`${API_BASE_URL}/customers/me/avatar`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const data = await res.json();
  if (!res.ok || !data.url) throw new Error(data.message || "Unable to upload avatar.");
  return String(data.url);
}

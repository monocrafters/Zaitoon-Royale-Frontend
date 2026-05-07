"use client";

import { API_BASE_URL } from "@/lib/admin-auth";
import { getCustomerToken } from "@/lib/customer-auth";

export const SUPPORT_GUEST_TOKEN_KEY = "restaurant_support_guest_token_v1";
export const SUPPORT_GUEST_CONV_KEY = "restaurant_support_guest_conv_v1";

export const getSupportGuestToken = () => {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(SUPPORT_GUEST_TOKEN_KEY) || "";
};

export const getSupportGuestConversationId = () => {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(SUPPORT_GUEST_CONV_KEY) || "";
};

export const setSupportGuestSession = (conversationId: string, guestToken: string) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SUPPORT_GUEST_CONV_KEY, conversationId);
  window.localStorage.setItem(SUPPORT_GUEST_TOKEN_KEY, guestToken);
};

export const clearSupportGuestSession = () => {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SUPPORT_GUEST_CONV_KEY);
  window.localStorage.removeItem(SUPPORT_GUEST_TOKEN_KEY);
};

export async function startCustomerSupportChat() {
  const token = getCustomerToken();
  if (!token) throw new Error("Customer session missing.");
  const res = await fetch(`${API_BASE_URL}/support/my/start`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok || !data.ticket?._id) throw new Error(data.message || "Unable to start chat.");
  return String(data.ticket._id) as string;
}

export async function createGuestSupportChat(payload: { name: string; phone: string; email: string; message: string }) {
  const res = await fetch(`${API_BASE_URL}/support`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, subject: "Support Chat" }),
  });
  const data = await res.json();
  if (!res.ok || !data.ticket?._id) throw new Error(data.message || "Unable to start chat.");
  const id = String(data.ticket._id);
  const token = String(data.guestToken || "");
  if (token) setSupportGuestSession(id, token);
  return id;
}

export async function fetchSupportMessages(conversationId: string) {
  const customerToken = getCustomerToken();
  if (customerToken) {
    const res = await fetch(`${API_BASE_URL}/support/my/${conversationId}/messages`, {
      headers: { Authorization: `Bearer ${customerToken}` },
      cache: "no-store",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Unable to load chat.");
    return {
      conversation: data.conversation || null,
      messages: Array.isArray(data.messages) ? data.messages : [],
      meta: data.meta || null,
    };
  }

  const guestToken = getSupportGuestToken();
  if (!guestToken) throw new Error("Guest token missing.");
  const res = await fetch(`${API_BASE_URL}/support/guest/${conversationId}/messages`, {
    headers: { Authorization: `Bearer ${guestToken}` },
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Unable to load chat.");
  return {
    conversation: data.conversation || null,
    messages: Array.isArray(data.messages) ? data.messages : [],
    meta: data.meta || null,
  };
}

export async function sendSupportMessage(conversationId: string, text: string) {
  const customerToken = getCustomerToken();
  if (customerToken) {
    const res = await fetch(`${API_BASE_URL}/support/my/${conversationId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({ text }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Unable to send message.");
    return;
  }

  const guestToken = getSupportGuestToken();
  if (!guestToken) throw new Error("Guest token missing.");
  const res = await fetch(`${API_BASE_URL}/support/guest/${conversationId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${guestToken}` },
    body: JSON.stringify({ text }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Unable to send message.");
}

export async function sendSupportTyping(conversationId: string) {
  const customerToken = getCustomerToken();
  if (customerToken) {
    await fetch(`${API_BASE_URL}/support/my/${conversationId}/typing`, {
      method: "POST",
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    return;
  }
  const guestToken = getSupportGuestToken();
  if (!guestToken) return;
  // Guest typing is not tracked for now.
}


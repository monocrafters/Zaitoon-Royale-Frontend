"use client";

import { useCallback, useEffect, useState } from "react";

import { API_BASE_URL } from "@/lib/admin-auth";

const CART_ID_KEY = "restaurant_cart_id_v1";
const CART_UNREAD_KEY = "restaurant_cart_unread_count_v1";
const CART_SNAPSHOT_KEY = "restaurant_cart_snapshot_v1";
const CART_EVENT = "restaurant:cart-updated";

const createCartId = () =>
  `cart_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

export const getOrCreateCartId = () => {
  if (typeof window === "undefined") return "";
  const existing = window.localStorage.getItem(CART_ID_KEY);
  if (existing) return existing;
  const next = createCartId();
  window.localStorage.setItem(CART_ID_KEY, next);
  return next;
};

const emitCartUpdate = () => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CART_EVENT));
};

const readUnreadCount = () => {
  if (typeof window === "undefined") return 0;
  return Math.max(0, Number(window.localStorage.getItem(CART_UNREAD_KEY) || 0));
};

const writeUnreadCount = (value: number, emit = true) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CART_UNREAD_KEY, String(Math.max(0, value)));
  if (emit) emitCartUpdate();
};

const popButton = (el?: HTMLElement | null) => {
  if (!el) return;
  el.classList.add("cart-anim-host");
  el.classList.remove("cart-add-success", "cart-add-success-label", "cart-add-error");
  void el.offsetWidth;
  const label = (el.textContent || "").toLowerCase().replace(/\s+/g, " ").trim();
  const showLabel = label.includes("add to cart");
  el.classList.add(showLabel ? "cart-add-success-label" : "cart-add-success");
  window.setTimeout(() => {
    el.classList.remove("cart-add-success", "cart-add-success-label");
  }, 560);
};

const markButtonError = (el?: HTMLElement | null) => {
  if (!el) return;
  el.classList.add("cart-anim-host");
  el.classList.remove("cart-add-success", "cart-add-pop", "cart-add-error");
  void el.offsetWidth;
  el.classList.add("cart-add-error");
  window.setTimeout(() => {
    el.classList.remove("cart-add-error");
  }, 420);
};

export type CartSnapshotItem = {
  kind?: "product" | "deal";
  product?: {
    _id: string;
    name: string;
    imageUrl?: string;
  } | null;
  deal?: {
    _id: string;
    title: string;
    imageUrl?: string;
  } | null;
  title?: string;
  imageUrl?: string;
  qty: number;
  size?: string;
  unitPrice: number;
  lineTotal: number;
};

export type CartSnapshot = {
  cartId: string;
  items: CartSnapshotItem[];
  subtotal: number;
  totalItems: number;
};

const readCartSnapshotLocal = (): CartSnapshot | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CART_SNAPSHOT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CartSnapshot;
  } catch {
    return null;
  }
};

export const getCartSnapshotLocal = (): CartSnapshot | null => readCartSnapshotLocal();

const writeCartSnapshotLocal = (cart: CartSnapshot | null) => {
  if (typeof window === "undefined") return;
  if (!cart) {
    window.localStorage.removeItem(CART_SNAPSHOT_KEY);
    return;
  }
  window.localStorage.setItem(CART_SNAPSHOT_KEY, JSON.stringify(cart));
};

const getOptimisticBaseCart = (): CartSnapshot => {
  const existing = readCartSnapshotLocal();
  if (existing) return existing;
  return {
    cartId: getOrCreateCartId(),
    items: [],
    subtotal: 0,
    totalItems: 0,
  };
};

export const getCartUnreadCount = () => readUnreadCount();

export const markCartAsRead = () => {
  writeUnreadCount(0);
};

export const clearCartSnapshotLocal = () => {
  writeCartSnapshotLocal(null);
  writeUnreadCount(0, false);
  emitCartUpdate();
};

export const fetchCartSnapshot = async (): Promise<CartSnapshot | null> => {
  if (typeof window === "undefined") return null;
  const cartId = getOrCreateCartId();
  if (!cartId) return null;
  const res = await fetch(`${API_BASE_URL}/cart/${cartId}`, { cache: "no-store" });
  const data = await res.json();
  if (!res.ok) return null;
  const cart = (data?.cart as CartSnapshot) || null;
  writeCartSnapshotLocal(cart);
  return cart;
};

export const useCartSnapshot = () => {
  const [cart, setCart] = useState<CartSnapshot | null>(null);

  const load = useCallback(async () => {
    try {
      const next = await fetchCartSnapshot();
      setCart(next);
    } catch {
      // no-op for lightweight UI bar
    }
  }, []);

  useEffect(() => {
    const local = readCartSnapshotLocal();
    if (local) setCart(local);
    void load();
    if (typeof window === "undefined") return;
    const sync = () => {
      const optimistic = readCartSnapshotLocal();
      if (optimistic) setCart(optimistic);
    };
    const onFocus = () => void load();
    window.addEventListener(CART_EVENT, sync);
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener(CART_EVENT, sync);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  return { cart, refreshCart: load };
};

export const useCartUnreadCount = () => {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const sync = () => setCount(readUnreadCount());
    sync();
    if (typeof window === "undefined") return;
    window.addEventListener(CART_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CART_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return count;
};

export const addItemToCart = async (productId: string, size = "", qty = 1, clickedEl?: HTMLElement | null) => {
  if (!productId) return false;
  if (clickedEl?.dataset?.adding === "1") return false;
  if (clickedEl) clickedEl.dataset.adding = "1";
  const cartId = getOrCreateCartId();
  if (!cartId) {
    if (clickedEl) clickedEl.dataset.adding = "0";
    return false;
  }
  const addedQty = Math.max(1, Number(qty) || 1);

  // Optimistic UI: trigger tick first, then notify listeners slightly later
  // so React re-render doesn't immediately wipe the CSS class animation.
  const optimisticUnread = readUnreadCount() + addedQty;
  writeUnreadCount(optimisticUnread, false);
  popButton(clickedEl);

  const local = getOptimisticBaseCart();
  const normSize = String(size || "").trim().toLowerCase();
  const idx = local.items.findIndex(
      (it) => (it.kind || "product") === "product" && (it.product?._id || "") === productId && String(it.size || "") === normSize
    );
  if (idx >= 0) {
    local.items[idx].qty = Math.max(1, Number(local.items[idx].qty) + addedQty);
    local.items[idx].lineTotal = Number(local.items[idx].unitPrice || 0) * local.items[idx].qty;
  } else {
    local.items.unshift({
      kind: "product",
      product: { _id: productId, name: "Item", imageUrl: "" },
      qty: addedQty,
      size: normSize,
      unitPrice: 0,
      lineTotal: 0,
    });
  }
  local.totalItems = local.items.reduce((s, it) => s + Math.max(1, Number(it.qty) || 1), 0);
  local.subtotal = local.items.reduce((s, it) => s + (Number(it.lineTotal) || 0), 0);
  writeCartSnapshotLocal(local);
  emitCartUpdate();

  void fetch(`${API_BASE_URL}/cart/${cartId}/items`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productId, size, qty }),
  })
    .then((res) => {
      if (res.ok) {
        emitCartUpdate();
        return;
      }
      writeUnreadCount(Math.max(0, optimisticUnread - addedQty));
      markButtonError(clickedEl);
      emitCartUpdate();
    })
    .catch(() => {
      writeUnreadCount(Math.max(0, optimisticUnread - addedQty));
      markButtonError(clickedEl);
      emitCartUpdate();
    })
    .finally(() => {
      if (clickedEl) {
        window.setTimeout(() => {
          clickedEl.dataset.adding = "0";
        }, 240);
      }
    });

  return true;
};

export const addDealToCart = async (
  dealId: string,
  qty = 1,
  clickedEl?: HTMLElement | null,
  meta?: { title?: string; imageUrl?: string; unitPrice?: number }
) => {
  if (!dealId) return false;
  if (clickedEl?.dataset?.adding === "1") return false;
  if (clickedEl) clickedEl.dataset.adding = "1";
  const cartId = getOrCreateCartId();
  if (!cartId) {
    if (clickedEl) clickedEl.dataset.adding = "0";
    return false;
  }
  const addedQty = Math.max(1, Number(qty) || 1);
  const optimisticUnread = readUnreadCount() + addedQty;
  writeUnreadCount(optimisticUnread, false);
  popButton(clickedEl);
  const local = getOptimisticBaseCart();
  const idx = local.items.findIndex((it) => (it.kind || "product") === "deal" && (it.deal?._id || "") === dealId);
  if (idx >= 0) {
    local.items[idx].qty = Math.max(1, Number(local.items[idx].qty) + addedQty);
    local.items[idx].lineTotal = Number(local.items[idx].unitPrice || 0) * local.items[idx].qty;
  } else {
    local.items.unshift({
      kind: "deal",
      product: null,
      deal: { _id: dealId, title: meta?.title || "Deal", imageUrl: meta?.imageUrl || "" },
      title: meta?.title || "Deal",
      imageUrl: meta?.imageUrl || "",
      qty: addedQty,
      size: "",
      unitPrice: Number(meta?.unitPrice) || 0,
      lineTotal: (Number(meta?.unitPrice) || 0) * addedQty,
    });
  }
  local.totalItems = local.items.reduce((s, it) => s + Math.max(1, Number(it.qty) || 1), 0);
  local.subtotal = local.items.reduce((s, it) => s + (Number(it.lineTotal) || 0), 0);
  writeCartSnapshotLocal(local);
  emitCartUpdate();

  void fetch(`${API_BASE_URL}/cart/${cartId}/items`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dealId, qty: addedQty }),
  })
    .then((res) => {
      if (res.ok) {
        emitCartUpdate();
        return;
      }
      writeUnreadCount(Math.max(0, optimisticUnread - addedQty));
      markButtonError(clickedEl);
      emitCartUpdate();
    })
    .catch(() => {
      writeUnreadCount(Math.max(0, optimisticUnread - addedQty));
      markButtonError(clickedEl);
      emitCartUpdate();
    })
    .finally(() => {
      if (clickedEl) {
        window.setTimeout(() => {
          clickedEl.dataset.adding = "0";
        }, 240);
      }
    });
  return true;
};


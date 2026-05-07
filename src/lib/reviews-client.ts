"use client";

import { API_BASE_URL } from "@/lib/admin-auth";
import { getCustomerToken } from "@/lib/customer-auth";

export type ProductReview = {
  _id: string;
  customerName: string;
  customerPhone?: string;
  orderId: string;
  productId?: string;
  productTitle: string;
  productImageUrl?: string;
  rating: number;
  reviewText: string;
  createdAt: string;
};

export type PendingReviewItem = {
  orderId: string;
  orderCreatedAt: string;
  title: string;
  imageUrl?: string;
  qty: number;
};

export type ProductReviewSummary = {
  productTitle: string;
  avgRating: number;
  count: number;
  orderCount?: number;
  orderQty?: number;
  latestReviewText?: string;
  latestImageUrl?: string;
  latestCustomerName?: string;
};

export async function fetchProductReviewsByTitle(title: string) {
  const res = await fetch(`${API_BASE_URL}/reviews/product?title=${encodeURIComponent(title)}`, { cache: "no-store" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Unable to load reviews.");
  return data as { reviews: ProductReview[]; meta: { count: number; avgRating: number } };
}

export async function fetchMyPendingReviewItems() {
  const token = getCustomerToken();
  if (!token) throw new Error("Customer session missing.");
  const res = await fetch(`${API_BASE_URL}/reviews/my/pending`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Unable to load pending reviews.");
  return data as { pending: PendingReviewItem[] };
}

export async function submitMyReview(payload: {
  orderId?: string;
  productTitle: string;
  productId?: string;
  productImageUrl?: string;
  rating: number;
  reviewText?: string;
}) {
  const token = getCustomerToken();
  if (!token) throw new Error("Customer session missing.");
  const res = await fetch(`${API_BASE_URL}/reviews/my`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Unable to submit review.");
  return data as { message: string; review?: ProductReview; reviews?: ProductReview[] };
}

export async function fetchAdminReviews(q = "") {
  const token = localStorage.getItem("restaurant_admin_token") || "";
  const res = await fetch(`${API_BASE_URL}/reviews/admin?q=${encodeURIComponent(q)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Unable to load admin reviews.");
  return data as { reviews: ProductReview[] };
}

export async function fetchPublicReviewSummariesByTitles(titles: string[]) {
  const cleaned = Array.from(new Set(titles.map((t) => String(t || "").trim()).filter(Boolean)));
  if (!cleaned.length) return { summaries: [] as ProductReviewSummary[] };
  const res = await fetch(`${API_BASE_URL}/reviews/summary?titles=${encodeURIComponent(cleaned.join("||"))}`, {
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Unable to load review summaries.");
  return data as { summaries: ProductReviewSummary[] };
}


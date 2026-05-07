"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Star, X } from "lucide-react";
import { fetchMyPendingReviewItems, submitMyReview, type PendingReviewItem } from "@/lib/reviews-client";
import { useCustomerSession } from "@/lib/customer-auth";

const STORAGE_KEY = "restaurant_review_modal_dismissed_v1";

export default function ReviewPromptModal() {
  const pathname = usePathname();
  const { hasSession } = useCustomerSession();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<PendingReviewItem[]>([]);
  const [index, setIndex] = useState(0);
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!hasSession) {
      setOpen(false);
      setItems([]);
      return;
    }
    let cancelled = false;
    const run = async () => {
      try {
        const data = await fetchMyPendingReviewItems();
        const pending = Array.isArray(data.pending) ? data.pending : [];
        if (cancelled) return;
        setItems(pending);
        const dismissed = typeof window !== "undefined" ? window.sessionStorage.getItem(STORAGE_KEY) : "";
        setOpen(Boolean(pending.length && dismissed !== "1"));
      } catch {
        if (!cancelled) {
          setItems([]);
          setOpen(false);
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [hasSession, pathname]);

  const current = useMemo(() => items[index] || null, [items, index]);
  if (!open || !current) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/40 p-3 sm:items-center">
      <div className="w-full max-w-lg rounded-3xl border border-[#eadccf] bg-white p-4 shadow-2xl sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[#2f1c12]">How was your food?</p>
            <p className="mt-1 text-xs text-[#6f5647]">Please review your delivered item.</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              if (typeof window !== "undefined") window.sessionStorage.setItem(STORAGE_KEY, "1");
            }}
            className="rounded-lg border border-[#e8dfd4] p-1.5 text-[#6f5647]"
            aria-label="Close review modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 rounded-2xl border border-[#efe2d5] bg-[#fffaf4] p-3">
          <p className="text-sm font-semibold text-[#2f1c12]">{current.title}</p>
          <p className="mt-0.5 text-xs text-[#6f5647]">Order: {current.orderId}</p>
        </div>

        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#7d6b5d]">Stars</p>
          <div className="mt-2 flex items-center gap-1.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                className="rounded-lg p-1"
                aria-label={`Set ${n} stars`}
              >
                <Star className={`h-5 w-5 ${n <= rating ? "fill-[#ffb347] text-[#ffb347]" : "text-[#d7c4b3]"}`} />
              </button>
            ))}
          </div>
        </div>

        <label className="mt-4 block">
          <span className="text-xs font-semibold uppercase tracking-wide text-[#7d6b5d]">Review</span>
          <textarea
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value)}
            rows={3}
            placeholder="Write your feedback..."
            className="mt-2 w-full rounded-xl border border-[#dccbbb] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#b84a2b]"
          />
        </label>

        <button
          type="button"
          disabled={submitting}
          onClick={async () => {
            if (!current) return;
            setSubmitting(true);
            try {
              await submitMyReview({
                orderId: current.orderId,
                productTitle: current.title,
                productImageUrl: current.imageUrl || "",
                rating,
                reviewText,
              });
              const next = items.filter((_, i) => i !== index);
              setItems(next);
              setIndex(0);
              setRating(5);
              setReviewText("");
              if (next.length === 0) setOpen(false);
            } finally {
              setSubmitting(false);
            }
          }}
          className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-[#5b2d17] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-55"
        >
          {submitting ? "Submitting..." : "Submit review"}
        </button>
      </div>
    </div>
  );
}


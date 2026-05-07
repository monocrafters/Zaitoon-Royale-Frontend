"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Download, Package } from "lucide-react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import ModernLoader from "@/components/ui/modern-loader";
import { API_BASE_URL, getAdminToken } from "@/lib/admin-auth";

type OrderItem = {
  kind: "product" | "deal";
  title: string;
  imageUrl?: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
};

type AdminOrder = {
  _id: string;
  status: "pending" | "confirmed" | "preparing" | "on_the_way" | "delivered" | "cancelled";
  cancelReason?: string;
  totalItems: number;
  totalPayment: number;
  createdAt: string;
  customer: {
    name: string;
    phone: string;
    address: string;
    city?: string;
    notes?: string;
  };
  items: OrderItem[];
};

const statusLabel: Record<AdminOrder["status"], string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  preparing: "Preparing",
  on_the_way: "On the way",
  delivered: "Delivered",
  cancelled: "Cancelled",
};
const statusOptions: Array<AdminOrder["status"]> = [
  "pending",
  "confirmed",
  "preparing",
  "on_the_way",
  "delivered",
  "cancelled",
];
const cancelReasons = [
  "Customer requested cancellation",
  "Item out of stock",
  "Kitchen issue",
  "Payment verification failed",
  "Delivery area unavailable",
  "Other",
] as const;

const statusChipClass: Record<AdminOrder["status"], string> = {
  pending: "bg-amber-100 text-amber-900",
  confirmed: "bg-sky-100 text-sky-900",
  preparing: "bg-violet-100 text-violet-900",
  on_the_way: "bg-blue-100 text-blue-900",
  delivered: "bg-emerald-100 text-emerald-900",
  cancelled: "bg-rose-100 text-rose-900",
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

function downloadReceipt(order: AdminOrder) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFillColor(91, 45, 23);
  doc.rect(0, 0, pageWidth, 88, "F");
  doc.setTextColor(255, 248, 239);
  doc.setFontSize(20);
  doc.text("Zaitoon Royale", 40, 48);
  doc.setFontSize(11);
  doc.text("Restaurant Order Receipt", 40, 67);
  doc.setFontSize(10);
  doc.text(`Order ID: ${order._id}`, pageWidth - 250, 48);
  doc.text(`Generated: ${fmtDate(new Date().toISOString())}`, pageWidth - 250, 66);

  doc.setTextColor(36, 24, 15);
  doc.setFontSize(11);
  doc.text(`Customer: ${order.customer?.name || "—"}`, 40, 114);
  doc.text(`Phone: ${order.customer?.phone || "—"}`, 40, 132);
  doc.text(`Address: ${[order.customer?.address, order.customer?.city].filter(Boolean).join(", ") || "—"}`, 40, 150);
  doc.text(`Placed: ${fmtDate(order.createdAt)}`, 40, 168);
  doc.text(`Status: ${statusLabel[order.status]}`, 40, 186);

  const body = (order.items || []).map((it, idx) => [
    String(idx + 1),
    it.title,
    String(it.qty),
    `PKR ${it.unitPrice || 0}`,
    `PKR ${it.lineTotal || 0}`,
  ]);

  autoTable(doc, {
    startY: 208,
    head: [["#", "Item", "Qty", "Unit", "Line Total"]],
    body,
    styles: { fontSize: 10, cellPadding: 7 },
    headStyles: { fillColor: [91, 45, 23] },
    alternateRowStyles: { fillColor: [250, 244, 236] },
    margin: { left: 40, right: 40 },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || 260;
  doc.setFillColor(245, 239, 232);
  doc.roundedRect(40, finalY + 14, pageWidth - 80, 44, 8, 8, "F");
  doc.setFontSize(12);
  doc.text(`Total Payment: PKR ${order.totalPayment || 0}`, 52, finalY + 42);
  doc.save(`order-${order._id}.pdf`);
}

export default function AdminOrderDetailPage() {
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : "";
  const [order, setOrder] = useState<AdminOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [statusDraft, setStatusDraft] = useState<AdminOrder["status"]>("pending");
  const [cancelReasonDraft, setCancelReasonDraft] = useState("");
  const [customCancelReason, setCustomCancelReason] = useState("");

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError("");
      const token = getAdminToken();
      const res = await fetch(`${API_BASE_URL}/orders/admin/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Unable to load order.");
      setOrder(data.order || null);
      if (data.order?.status) setStatusDraft(data.order.status);
      const existingReason = String(data.order?.cancelReason || "");
      if (existingReason && cancelReasons.some((x) => x === existingReason)) {
        setCancelReasonDraft(existingReason);
        setCustomCancelReason("");
      } else if (existingReason) {
        setCancelReasonDraft("Other");
        setCustomCancelReason(existingReason);
      } else {
        setCancelReasonDraft("");
        setCustomCancelReason("");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load order.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveStatus = async () => {
    if (!order) return;
    const token = getAdminToken();
    const cancelReason =
      statusDraft === "cancelled"
        ? cancelReasonDraft === "Other"
          ? customCancelReason.trim()
          : cancelReasonDraft.trim()
        : "";
    if (statusDraft === "cancelled" && !cancelReason) {
      setError("Please select or enter a cancellation reason.");
      return;
    }
    try {
      setSaving(true);
      setError("");
      const res = await fetch(`${API_BASE_URL}/orders/admin/${order._id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: statusDraft, cancelReason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Unable to update status.");
      const next = data.order as AdminOrder;
      setOrder(next);
      if (next.status) setStatusDraft(next.status);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to update status.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Link href="/admin/orders" className="text-sm font-medium text-[var(--primary)] hover:underline">
          Back to orders
        </Link>
        {order ? (
          <button
            type="button"
            onClick={() => downloadReceipt(order)}
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-3 py-2 text-sm text-white hover:bg-[#472212]"
          >
            <Download className="h-4 w-4" />
            Download receipt
          </button>
        ) : null}
      </div>

      {loading ? <ModernLoader label="Loading order..." /> : null}
      {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      {!loading && order ? (
        <section className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Order ID</p>
              <h2 className="mt-1 text-lg font-semibold text-[var(--foreground)]">#{order._id}</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">Placed: {fmtDate(order.createdAt)}</p>
            </div>
            <span className={["inline-flex rounded-full px-2.5 py-1 text-xs font-semibold", statusChipClass[order.status]].join(" ")}>
              {statusLabel[order.status]}
            </span>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-[var(--border)] p-3">
              <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Customer</p>
              <p className="mt-1 font-medium text-[var(--foreground)]">{order.customer?.name || "—"}</p>
              <p className="text-sm text-[var(--muted)]">{order.customer?.phone || "—"}</p>
              <p className="mt-2 text-sm text-[var(--foreground)]">
                {[order.customer?.address, order.customer?.city].filter(Boolean).join(", ") || "—"}
              </p>
              {order.customer?.notes ? (
                <p className="mt-2 text-sm text-[var(--muted)]">Notes: {order.customer.notes}</p>
              ) : null}
            </div>
            <div className="rounded-xl border border-[var(--border)] p-3">
              <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Summary</p>
              <p className="mt-1 text-sm text-[var(--foreground)]">Items: {order.totalItems || 0}</p>
              <p className="text-sm font-semibold text-[var(--foreground)]">Total: PKR {order.totalPayment || 0}</p>
              {order.status === "cancelled" && order.cancelReason ? (
                <p className="mt-2 text-sm text-[#9b1c1c]">Reason: {order.cancelReason}</p>
              ) : null}
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-[var(--border)] bg-[#fbf6ef] p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Update status</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <label className="block">
                <span className="text-xs text-[var(--muted)]">Status</span>
                <select
                  value={statusDraft}
                  onChange={(e) => setStatusDraft(e.target.value as AdminOrder["status"])}
                  className="mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
                >
                  {statusOptions.map((s) => (
                    <option key={s} value={s}>
                      {statusLabel[s]}
                    </option>
                  ))}
                </select>
              </label>
              {statusDraft === "cancelled" ? (
                <label className="block">
                  <span className="text-xs text-[var(--muted)]">Cancellation reason</span>
                  <select
                    value={cancelReasonDraft}
                    onChange={(e) => setCancelReasonDraft(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
                  >
                    <option value="">Select reason...</option>
                    {cancelReasons.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <div />
              )}
              <button
                type="button"
                onClick={() => void saveStatus()}
                disabled={saving}
                className="rounded-xl bg-[var(--primary)] px-4 py-2 text-sm text-white hover:bg-[#472212] disabled:opacity-55"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
            {statusDraft === "cancelled" && cancelReasonDraft === "Other" ? (
              <input
                value={customCancelReason}
                onChange={(e) => setCustomCancelReason(e.target.value)}
                placeholder="Type cancellation reason"
                className="mt-2 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
              />
            ) : null}
          </div>

          <div className="mt-4 rounded-xl border border-[var(--border)]">
            <div className="border-b border-[var(--border)] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Products / Items
            </div>
            <ul className="divide-y divide-[var(--border)]">
              {(order.items || []).map((it, idx) => (
                <li key={`${it.title}-${idx}`} className="flex items-center gap-3 px-3 py-3">
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-[#faf6f0]">
                    {it.imageUrl ? (
                      <Image src={it.imageUrl} alt={it.title} fill className="object-cover" unoptimized />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[#c4b5a8]">
                        <Package className="h-6 w-6" aria-hidden />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-[var(--foreground)]">{it.title}</p>
                    <p className="text-xs text-[var(--muted)]">Qty {it.qty} · Unit PKR {it.unitPrice || 0}</p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold text-[var(--foreground)]">PKR {it.lineTotal || 0}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}
    </main>
  );
}


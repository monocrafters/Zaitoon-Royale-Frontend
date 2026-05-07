"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Download, Eye, RefreshCcw, Search, X } from "lucide-react";

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

const statusLabel: Record<AdminOrder["status"], string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  preparing: "Preparing",
  on_the_way: "On the way",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

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
  doc.text(
    `Address: ${[order.customer?.address, order.customer?.city].filter(Boolean).join(", ") || "—"}`,
    40,
    150
  );
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

export default function AdminOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [query, setQuery] = useState("");
  const [statusSavingFor, setStatusSavingFor] = useState<string>("");
  const [cancelModalOrder, setCancelModalOrder] = useState<AdminOrder | null>(null);
  const [cancelReasonDraft, setCancelReasonDraft] = useState("");
  const [customCancelReason, setCustomCancelReason] = useState("");

  const loadOrders = useCallback(async () => {
    try {
      setRefreshing(true);
      setLoading(true);
      setError("");
      const token = getAdminToken();
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (query.trim()) params.set("q", query.trim());
      const qs = params.toString();
      const res = await fetch(`${API_BASE_URL}/orders/admin${qs ? `?${qs}` : ""}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Unable to load orders.");
      setOrders(Array.isArray(data.orders) ? data.orders : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load orders.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter, query]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const summary = useMemo(() => {
    const total = orders.length;
    const pending = orders.filter((o) => o.status === "pending").length;
    const preparing = orders.filter((o) => o.status === "preparing" || o.status === "on_the_way").length;
    return { total, pending, preparing };
  }, [orders]);

  const updateStatus = async (orderId: string, nextStatus: AdminOrder["status"], cancelReason = "") => {
    try {
      setStatusSavingFor(orderId);
      const token = getAdminToken();
      const res = await fetch(`${API_BASE_URL}/orders/admin/${orderId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: nextStatus, cancelReason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Unable to update status.");
      setOrders((prev) => prev.map((o) => (o._id === orderId ? { ...o, status: nextStatus } : o)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to update status.");
    } finally {
      setStatusSavingFor("");
    }
  };

  const requestCancel = (order: AdminOrder) => {
    setCancelModalOrder(order);
    setCancelReasonDraft("");
    setCustomCancelReason("");
  };

  const confirmCancel = async () => {
    if (!cancelModalOrder) return;
    const reason = cancelReasonDraft === "Other" ? customCancelReason.trim() : cancelReasonDraft.trim();
    if (!reason) {
      setError("Please select or enter a cancellation reason.");
      return;
    }
    await updateStatus(cancelModalOrder._id, "cancelled", reason);
    setCancelModalOrder(null);
  };

  return (
    <main className="space-y-4">
      <section className="grid grid-cols-3 gap-2 sm:grid-cols-3 sm:gap-3">
        {[
          { label: "Total", value: summary.total },
          { label: "Pending", value: summary.pending },
          { label: "In progress", value: summary.preparing },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-[var(--border)] bg-white px-3 py-2 sm:p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)] sm:text-xs">{s.label}</p>
            <p className="mt-0.5 text-lg font-semibold text-[var(--foreground)] sm:mt-1 sm:text-2xl">{s.value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-white p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search..."
              className="w-full rounded-xl border border-[var(--border)] bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-[var(--primary)]"
            />
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-[128px] rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--primary)] sm:w-auto"
          >
            <option value="">All</option>
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {statusLabel[s]}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void loadOrders()}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] text-[var(--foreground)] hover:bg-[#fbf6ef]"
            aria-label="Refresh orders"
          >
            <RefreshCcw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </section>

      <section className="bg-transparent p-0 sm:rounded-2xl sm:border sm:border-[var(--border)] sm:bg-white sm:p-3 sm:p-4">
        {loading ? <ModernLoader label="Loading orders..." /> : null}
        {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
        {!loading && !error && orders.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--muted)]">No orders found.</p>
        ) : null}

        {!loading && orders.length > 0 ? (
          <>
            <div className="hidden overflow-x-auto sm:block">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-xs uppercase tracking-wide text-[var(--muted)]">
                  <th className="px-2 py-3 sm:px-3">Placed</th>
                  <th className="px-2 py-3 sm:px-3">Customer</th>
                  <th className="px-2 py-3 sm:px-3">Items</th>
                  <th className="px-2 py-3 sm:px-3">Total</th>
                  <th className="px-2 py-3 sm:px-3">Status</th>
                  <th className="px-2 py-3 sm:px-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order._id} className="border-b border-[var(--border)] last:border-b-0">
                    <td className="px-2 py-3 align-top text-[var(--foreground)] sm:px-3">{fmtDate(order.createdAt)}</td>
                    <td className="px-2 py-3 align-top sm:px-3">
                      <p className="font-medium text-[var(--foreground)]">{order.customer?.name || "Customer"}</p>
                      <p className="text-xs text-[var(--muted)]">{order.customer?.phone || "—"}</p>
                    </td>
                    <td className="px-2 py-3 align-top sm:px-3">{order.totalItems || 0}</td>
                    <td className="px-2 py-3 align-top font-semibold text-[var(--foreground)] sm:px-3">PKR {order.totalPayment || 0}</td>
                    <td className="px-2 py-3 align-top sm:px-3">
                      <span className={["inline-flex rounded-full px-2.5 py-1 text-xs font-semibold", statusChipClass[order.status]].join(" ")}>
                        {statusLabel[order.status]}
                      </span>
                    </td>
                    <td className="px-2 py-3 align-top sm:px-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={order.status}
                          disabled={statusSavingFor === order._id}
                          onChange={(e) => {
                            const next = e.target.value as AdminOrder["status"];
                            if (next === "cancelled") {
                              requestCancel(order);
                              return;
                            }
                            void updateStatus(order._id, next);
                          }}
                          className="rounded-lg border border-[var(--border)] px-2 py-1.5 text-xs outline-none focus:border-[var(--primary)]"
                        >
                          {statusOptions.map((s) => (
                            <option key={s} value={s}>
                              {statusLabel[s]}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => router.push(`/admin/orders/${order._id}`)}
                          className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-2 py-1.5 text-xs text-[var(--foreground)] hover:bg-[#fbf6ef]"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Details
                        </button>
                        <button
                          type="button"
                          onClick={() => downloadReceipt(order)}
                          className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-2 py-1.5 text-xs text-[var(--foreground)] hover:bg-[#fbf6ef]"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Receipt
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>

            <div className="space-y-2 sm:hidden">
              {orders.map((order) => (
                <article key={`m-${order._id}`} className="rounded-2xl border border-[var(--border)] bg-white p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[var(--foreground)]">{order.customer?.name || "Customer"}</p>
                      <p className="text-[11px] text-[var(--muted)]">{order.customer?.phone || "—"}</p>
                      <p className="mt-1 text-[11px] text-[var(--muted)]">{fmtDate(order.createdAt)}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold text-[var(--foreground)]">PKR {order.totalPayment || 0}</p>
                      <span className={["mt-1 inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold", statusChipClass[order.status]].join(" ")}>
                        {statusLabel[order.status]}
                      </span>
                    </div>
                  </div>

                  <div className="mt-2 flex items-center justify-between gap-2">
                    <p className="text-[11px] text-[var(--muted)]">{order.totalItems || 0} items</p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => router.push(`/admin/orders/${order._id}`)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] bg-white text-[var(--foreground)]"
                        aria-label="Open order details"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadReceipt(order)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] bg-white text-[var(--foreground)]"
                        aria-label="Download receipt"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-2">
                    <select
                      value={order.status}
                      disabled={statusSavingFor === order._id}
                      onChange={(e) => {
                        const next = e.target.value as AdminOrder["status"];
                        if (next === "cancelled") {
                          requestCancel(order);
                          return;
                        }
                        void updateStatus(order._id, next);
                      }}
                      className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
                    >
                      {statusOptions.map((s) => (
                        <option key={s} value={s}>
                          {statusLabel[s]}
                        </option>
                      ))}
                    </select>
                  </div>
                </article>
              ))}
            </div>
          </>
        ) : null}
      </section>
      {cancelModalOrder ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[70] bg-black/35"
            onClick={() => setCancelModalOrder(null)}
            aria-label="Close cancellation modal"
          />
          <div className="fixed left-1/2 top-1/2 z-[71] w-[92%] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[var(--border)] bg-white p-4 shadow-[0_20px_50px_rgba(0,0,0,0.22)]">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Cancel order</p>
                <h3 className="mt-1 text-base font-semibold text-[var(--foreground)]">#{cancelModalOrder._id}</h3>
              </div>
              <button
                type="button"
                onClick={() => setCancelModalOrder(null)}
                className="rounded-lg border border-[var(--border)] p-1.5 text-[var(--muted)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <label className="mt-4 block">
              <span className="text-xs text-[var(--muted)]">Reason</span>
              <select
                value={cancelReasonDraft}
                onChange={(e) => setCancelReasonDraft(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
              >
                <option value="">Select reason...</option>
                {cancelReasons.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            {cancelReasonDraft === "Other" ? (
              <input
                value={customCancelReason}
                onChange={(e) => setCustomCancelReason(e.target.value)}
                placeholder="Type cancellation reason"
                className="mt-2 w-full rounded-xl border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
              />
            ) : null}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCancelModalOrder(null)}
                className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)]"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => void confirmCancel()}
                className="rounded-xl bg-[#9b1c1c] px-3 py-2 text-sm font-semibold text-white"
              >
                Confirm cancellation
              </button>
            </div>
          </div>
        </>
      ) : null}
    </main>
  );
}


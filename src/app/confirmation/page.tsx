"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import SiteHeader from "@/components/public/site-header";
import { API_BASE_URL } from "@/lib/admin-auth";
import { clearCartSnapshotLocal, fetchCartSnapshot, getCartSnapshotLocal, getOrCreateCartId, type CartSnapshot } from "@/lib/cart-client";
import { getCustomerToken } from "@/lib/customer-auth";
import ModernLoader from "@/components/ui/modern-loader";

const formatNow = () => {
  const d = new Date();
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
};

function ConfirmationPageInner() {
  const router = useRouter();
  const search = useSearchParams();
  const [cart, setCart] = useState<CartSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState("");

  useEffect(() => {
    const load = async () => {
      const local = getCartSnapshotLocal();
      if (local) setCart(local);
      const fresh = await fetchCartSnapshot();
      if (fresh) setCart(fresh);
      setLoading(false);
    };
    void load();
  }, []);

  const customer = useMemo(
    () => ({
      name: search.get("name") || "Customer",
      phone: search.get("phone") || "",
      city: search.get("city") || "",
      address: search.get("address") || "",
      notes: search.get("notes") || "",
    }),
    [search]
  );

  const items = cart?.items || [];
  const total = Number(cart?.subtotal) || 0;

  const downloadInvoice = () => {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.setFillColor(33, 33, 33);
    doc.rect(0, 0, pageWidth, 84, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.text("Zaitoon Royale Invoice", 40, 52);
    doc.setFontSize(10);
    doc.text(`Date: ${formatNow()}`, pageWidth - 170, 52);

    doc.setTextColor(36, 24, 15);
    doc.setFontSize(11);
    doc.text(`Customer: ${customer.name}`, 40, 110);
    doc.text(`Phone: ${customer.phone || "—"}`, 40, 128);
    doc.text(`Address: ${[customer.address, customer.city].filter(Boolean).join(", ") || "—"}`, 40, 146);

    const body = items.map((it, idx) => {
      const title = it.kind === "deal" ? it.deal?.title || it.title || "Deal" : it.product?.name || it.title || "Item";
      const qty = Math.max(1, Number(it.qty) || 1);
      const unit = Number(it.unitPrice) || 0;
      const line = Number(it.lineTotal) || qty * unit;
      return [String(idx + 1), title, String(qty), `PKR ${unit}`, `PKR ${line}`];
    });

    autoTable(doc, {
      startY: 170,
      head: [["#", "Item", "Qty", "Unit", "Line Total"]],
      body,
      styles: { fontSize: 10, cellPadding: 7 },
      headStyles: { fillColor: [91, 45, 23] },
      alternateRowStyles: { fillColor: [250, 244, 236] },
      margin: { left: 40, right: 40 },
    });

    const finalY = (doc as any).lastAutoTable?.finalY || 220;
    doc.setFillColor(245, 239, 232);
    doc.roundedRect(40, finalY + 14, pageWidth - 80, 44, 8, 8, "F");
    doc.setFontSize(12);
    doc.text(`Total Payment: PKR ${total}`, 52, finalY + 42);
    doc.save(`invoice-${Date.now()}.pdf`);
  };

  const confirmOrder = async () => {
    if (!items.length) return;
    setConfirmError("");
    setConfirming(true);
    try {
      const payload = {
        customer: {
          name: customer.name,
          phone: customer.phone,
          city: customer.city,
          address: customer.address,
          notes: customer.notes,
        },
        items: items.map((it) => ({
          kind: it.kind === "deal" ? "deal" : "product",
          title: it.kind === "deal" ? it.deal?.title || it.title || "Deal" : it.product?.name || it.title || "Item",
          imageUrl: it.kind === "deal" ? it.deal?.imageUrl || it.imageUrl || "" : it.product?.imageUrl || it.imageUrl || "",
          qty: Math.max(1, Number(it.qty) || 1),
          unitPrice: Number(it.unitPrice) || 0,
          lineTotal: Number(it.lineTotal) || 0,
        })),
        totalItems: cart?.totalItems || 0,
        totalPayment: total,
      };
      const customerToken = getCustomerToken();
      const res = await fetch(`${API_BASE_URL}/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(customerToken ? { Authorization: `Bearer ${customerToken}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Unable to confirm order.");

      const cartId = getOrCreateCartId();
      void fetch(`${API_BASE_URL}/cart/${cartId}/clear`, { method: "DELETE" });
      clearCartSnapshotLocal();
      router.push("/order-sent");
    } catch (e) {
      setConfirmError(e instanceof Error ? e.message : "Unable to confirm order.");
    } finally {
      setConfirming(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f5efe8] text-[#2f1c12] antialiased">
      <SiteHeader />
      <section className="px-0 pb-28 pt-[96px] sm:mx-auto sm:max-w-7xl sm:px-6 sm:pb-10">
        <div className="px-4 sm:px-0">
          <h1 className="font-[family-name:var(--font-poppins)] text-3xl font-semibold text-[#111]">Order Confirmation</h1>
          <p className="mt-1 text-sm text-[#6f5647]">Your order is ready for processing.</p>
        </div>

        <div className="mt-5 grid gap-3 sm:gap-5 lg:grid-cols-[1fr_360px]">
          <section className="border-y border-[#eadccf] bg-white p-4 sm:rounded-3xl sm:border sm:p-5">
            <h2 className="text-base font-semibold text-[#1d140f]">Ordered Items</h2>
            {loading ? <ModernLoader className="mt-3" label="Loading items..." /> : null}
            {!loading && items.length === 0 ? <p className="mt-3 text-sm text-[#6f5647]">No items found.</p> : null}

            <div className="mt-3 space-y-2">
              {items.map((it, idx) => {
                const title = it.kind === "deal" ? it.deal?.title || it.title || "Deal" : it.product?.name || it.title || "Item";
                const image = it.kind === "deal" ? it.deal?.imageUrl || it.imageUrl || "" : it.product?.imageUrl || it.imageUrl || "";
                const qty = Math.max(1, Number(it.qty) || 1);
                const unit = Number(it.unitPrice) || 0;
                const line = Number(it.lineTotal) || qty * unit;
                return (
                  <article key={`${title}-${idx}`} className="flex items-center gap-2 rounded-xl border border-[#eadccf] bg-[#fffaf4] p-2.5">
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-white">
                      {image ? <Image src={image} alt={title} fill className="object-cover" unoptimized /> : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-sm font-semibold text-[#2f1c12]">{title}</p>
                      <p className="text-xs text-[#7d6b5d]">
                        Qty {qty} • Unit PKR {unit}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-[#5b2d17]">PKR {line}</p>
                  </article>
                );
              })}
            </div>
          </section>

          <aside className="hidden border-y border-[#eadccf] bg-white p-4 sm:rounded-3xl sm:border sm:p-5 lg:block">
            <h3 className="text-base font-semibold text-[#1d140f]">Payment Summary</h3>
            <div className="mt-3 space-y-2 text-sm text-[#6f5647]">
              <div className="flex items-center justify-between">
                <span>Customer</span>
                <span className="font-semibold text-[#2f1c12]">{customer.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Phone</span>
                <span className="font-semibold text-[#2f1c12]">{customer.phone || "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Total items</span>
                <span className="font-semibold text-[#2f1c12]">{cart?.totalItems || 0}</span>
              </div>
            </div>
            <div className="mt-4 border-t border-[#efe2d5] pt-4">
              <p className="text-base font-semibold text-[#2f1c12]">
                Total Payment <span className="ml-1 text-[#b84a2b]">PKR {total}</span>
              </p>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={downloadInvoice}
                className="rounded-xl border border-[#1d140f] bg-white px-3 py-2.5 text-xs font-semibold text-[#111] sm:text-sm"
              >
                Download Invoice
              </button>
              <button
                type="button"
                onClick={confirmOrder}
                disabled={confirming || !items.length}
                className="rounded-xl bg-[#111] px-3 py-2.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-55 sm:text-sm"
              >
                {confirming ? "Confirming..." : "Confirm Order"}
              </button>
            </div>
            {confirmError ? <p className="mt-2 text-xs text-red-600">{confirmError}</p> : null}
          </aside>
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+72px)] z-40 border-t border-[#eadccf] bg-[#fffaf4]/97 px-4 pb-3 pt-2 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-[#2f1c12]">
            Total <span className="ml-1 text-[#b84a2b]">PKR {total}</span>
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={downloadInvoice}
              className="rounded-xl border border-[#1d140f] bg-white px-3 py-2 text-xs font-semibold text-[#111]"
            >
              Invoice
            </button>
            <button
              type="button"
              onClick={confirmOrder}
              disabled={confirming || !items.length}
              className="rounded-xl bg-[#111] px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-55"
            >
              {confirming ? "Sending..." : "Confirm"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function ConfirmationPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#f5efe8] text-[#2f1c12] antialiased" />}>
      <ConfirmationPageInner />
    </Suspense>
  );
}


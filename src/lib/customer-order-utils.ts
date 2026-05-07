export type CustomerOrderItem = {
  kind?: string;
  title: string;
  qty: number;
  lineTotal: number;
  unitPrice?: number;
  imageUrl?: string;
};

export type CustomerOrder = {
  _id: string;
  status: string;
  cancelReason?: string;
  totalItems: number;
  totalPayment: number;
  createdAt: string;
  updatedAt?: string;
  customer?: {
    name?: string;
    phone?: string;
    address?: string;
    city?: string;
    notes?: string;
  };
  items: CustomerOrderItem[];
};

export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  preparing: "Preparing",
  on_the_way: "On the way",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export const ORDER_STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-50 text-amber-900 ring-amber-200",
  confirmed: "bg-sky-50 text-sky-900 ring-sky-200",
  preparing: "bg-violet-50 text-violet-900 ring-violet-200",
  on_the_way: "bg-blue-50 text-blue-900 ring-blue-200",
  delivered: "bg-emerald-50 text-emerald-900 ring-emerald-200",
  cancelled: "bg-red-50 text-red-800 ring-red-200",
};

export function formatPlacedDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return iso;
  }
}

export function formatItemsPreview(items: Pick<CustomerOrderItem, "title">[]) {
  return items
    .map((i) => String(i.title || "").trim())
    .filter(Boolean)
    .join(" · ");
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { API_BASE_URL, getAdminToken } from "@/lib/admin-auth";
import { RotateCw } from "lucide-react";

type ContactItem = {
  _id: string;
  name: string;
  phone?: string;
  email?: string;
  message: string;
  status: "new" | "reviewed";
  createdAt: string;
};

export default function AdminContactPage() {
  const [items, setItems] = useState<ContactItem[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const token = getAdminToken();
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (status) params.set("status", status);
      const res = await fetch(`${API_BASE_URL}/contact/admin?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Unable to load contact messages.");
      setItems(Array.isArray(data.contacts) ? data.contacts : []);
    } finally {
      setRefreshing(false);
    }
  }, [q, status]);

  useEffect(() => {
    const run = async () => {
      try {
        setError("");
        setLoading(true);
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unable to load contact messages.");
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [load]);

  const updateStatus = async (id: string, next: "new" | "reviewed") => {
    const token = getAdminToken();
    const res = await fetch(`${API_BASE_URL}/contact/admin/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status: next }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.message || "Unable to update status.");
      return;
    }
    setItems((prev) => prev.map((x) => (x._id === id ? { ...x, status: next } : x)));
  };

  const totalNew = useMemo(() => items.filter((x) => x.status === "new").length, [items]);

  return (
    <main className="-m-4 flex h-[calc(100vh-64px)] flex-col overflow-hidden sm:-m-6 sm:h-[calc(100vh-74px)]">
      <section className="shrink-0 border-b border-[#e4d5c7] bg-white p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, phone, email, message"
            className="min-w-0 flex-1 rounded-xl border border-[#dccbbb] px-3 py-2 text-sm outline-none focus:border-[#b84a2b]"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-[120px] rounded-xl border border-[#dccbbb] px-3 py-2 text-sm outline-none focus:border-[#b84a2b] sm:w-[170px]"
          >
            <option value="">All status</option>
            <option value="new">New</option>
            <option value="reviewed">Reviewed</option>
          </select>
          <button
            onClick={() => void load()}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#dccbbb] bg-[#fffaf4] text-[#5b2d17]"
            aria-label="Refresh contact messages"
          >
            <RotateCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </section>

      <section className="min-h-0 flex-1 overflow-y-auto bg-white p-3 sm:p-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="mb-3 rounded-xl border border-[#e4d5c7] bg-[#fffaf4] px-3 py-2 text-sm text-[#5b2d17]">
          New messages: <span className="font-semibold">{totalNew}</span>
        </div>
        {loading ? <p className="text-sm text-[#6f5647]">Loading messages...</p> : null}
        {error ? <p className="mb-2 text-sm text-red-600">{error}</p> : null}
        <div className="space-y-2">
          {items.map((item) => (
            <article key={item._id} className="rounded-2xl border border-[#e4d5c7] bg-white p-2.5 sm:p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-[#1c130e]">{item.name}</p>
                  <p className="text-xs text-[#6f5647]">{item.phone || item.email || "No contact info"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${item.status === "new" ? "bg-[#fff3e7] text-[#8a3f1a]" : "bg-[#ecf7ef] text-[#1f6b35]"}`}>
                    {item.status === "new" ? "New" : "Reviewed"}
                  </span>
                  {item.status === "new" ? (
                    <button onClick={() => void updateStatus(item._id, "reviewed")} className="rounded-lg border border-[#dccbbb] px-2.5 py-1 text-xs font-semibold text-[#5b2d17]">
                      Mark reviewed
                    </button>
                  ) : (
                    <button onClick={() => void updateStatus(item._id, "new")} className="rounded-lg border border-[#dccbbb] px-2.5 py-1 text-xs font-semibold text-[#5b2d17]">
                      Mark new
                    </button>
                  )}
                </div>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-[#2f1c12]">{item.message}</p>
              <p className="mt-2 text-[11px] text-[#8a6f5e]">
                {new Date(item.createdAt).toLocaleString([], { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })}
              </p>
            </article>
          ))}
          {!loading && items.length === 0 ? <p className="text-sm text-[#6f5647]">No contact messages found.</p> : null}
        </div>
      </section>
    </main>
  );
}

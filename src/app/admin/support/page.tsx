"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCw, SendHorizontal, UserRound } from "lucide-react";
import { API_BASE_URL, getAdminToken } from "@/lib/admin-auth";

type Conversation = {
  _id: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerProfileImageUrl?: string;
  subject: string;
  status: "open" | "in_progress" | "resolved";
  updatedAt: string;
  unreadForAdmin?: number;
  lastMessage?: { text: string; senderRole: "customer" | "admin"; createdAt: string } | null;
};

type ChatMessage = {
  senderRole: "customer" | "admin";
  text: string;
  createdAt: string;
};

const STATUS_LABELS: Record<Conversation["status"], string> = {
  open: "Open",
  in_progress: "In Progress",
  resolved: "Resolved",
};

export default function AdminSupportPage() {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState("");
  const [isDesktop, setIsDesktop] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadConversations = useCallback(async () => {
    setRefreshing(true);
    try {
      const token = getAdminToken();
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (status) params.set("status", status);
      const res = await fetch(`${API_BASE_URL}/support/admin?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Unable to load support conversations.");
      const list = Array.isArray(data.tickets) ? (data.tickets as Conversation[]) : [];
      setConversations(list);
      setActiveId((prev) => (isDesktop ? prev || list[0]?._id || "" : prev));
    } finally {
      setRefreshing(false);
    }
  }, [query, status, isDesktop]);

  useEffect(() => {
    const syncViewport = () => setIsDesktop(window.innerWidth >= 1024);
    syncViewport();
    window.addEventListener("resize", syncViewport);
    return () => window.removeEventListener("resize", syncViewport);
  }, []);

  const loadMessages = useCallback(async () => {
    if (!activeId) {
      setMessages([]);
      return;
    }
    const token = getAdminToken();
    const res = await fetch(`${API_BASE_URL}/support/admin/${activeId}/messages`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Unable to load messages.");
    setMessages(Array.isArray(data.messages) ? data.messages : []);
  }, [activeId]);

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError("");
        await loadConversations();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unable to load support conversations.");
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [loadConversations]);

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    if (!activeId) return;
    const timer = setInterval(() => {
      void loadConversations();
      void loadMessages();
    }, 4000);
    return () => clearInterval(timer);
  }, [activeId, loadConversations, loadMessages]);

  const activeConversation = useMemo(
    () => conversations.find((x) => x._id === activeId) || null,
    [conversations, activeId]
  );

  const sendReply = async () => {
    if (!activeId || !reply.trim()) return;
    const token = getAdminToken();
    const text = reply.trim();
    setReply("");
    const res = await fetch(`${API_BASE_URL}/support/admin/${activeId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ text }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.message || "Unable to send message.");
      return;
    }
    await loadMessages();
    await loadConversations();
  };

  const updateStatus = async (nextStatus: Conversation["status"]) => {
    if (!activeId) return;
    const token = getAdminToken();
    const res = await fetch(`${API_BASE_URL}/support/admin/${activeId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status: nextStatus }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.message || "Unable to update status.");
      return;
    }
    await loadConversations();
  };

  return (
    <main className="-m-4 flex h-[calc(100vh-64px)] flex-col overflow-hidden sm:-m-6 sm:h-[calc(100vh-74px)]">
      <section className="shrink-0 border-b border-[#e4d5c7] bg-white p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by customer, phone, subject"
            className="min-w-0 flex-1 rounded-xl border border-[#dccbbb] px-3 py-2 text-sm outline-none focus:border-[#b84a2b]"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-[120px] rounded-xl border border-[#dccbbb] px-3 py-2 text-sm outline-none focus:border-[#b84a2b] sm:w-[170px]"
          >
            <option value="">All status</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
          </select>
          <button
            onClick={() => void loadConversations()}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#dccbbb] bg-[#fffaf4] text-[#5b2d17]"
            aria-label="Refresh support conversations"
          >
            <RotateCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </section>

      <section className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[320px_1fr]">
        <aside className="min-h-0 overflow-y-auto border-r border-[#e4d5c7] bg-white p-3">
          {loading ? <p className="text-sm text-[#6f5647]">Loading conversations...</p> : null}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <ul className="space-y-1.5">
            {conversations.map((c) => (
              <li key={c._id}>
                {(() => {
                  const unreadCount = Math.max(0, Number(c.unreadForAdmin || 0));
                  const hasUnreadWhileClosed = unreadCount > 0 && !(isDesktop && activeId === c._id);
                  return (
                <button
                  type="button"
                  onClick={() => {
                    if (typeof window !== "undefined" && window.innerWidth < 1024) {
                      router.push(`/admin/support/${c._id}`);
                      return;
                    }
                    setActiveId(c._id);
                  }}
                  className={`w-full rounded-xl border px-2.5 py-2 text-left ${
                    activeId === c._id ? "border-[#b84a2b] bg-[#fff3e7]" : "border-[#eadccf] bg-[#fffaf4]"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <div className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white">
                      {c.customerProfileImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.customerProfileImageUrl} alt={c.customerName || "Customer"} className="h-10 w-10 rounded-full object-cover" />
                      ) : (
                        <UserRound className="h-5 w-5 text-[#b59a88]" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className={[
                            "truncate text-xs sm:text-sm",
                            hasUnreadWhileClosed ? "font-bold text-[#1c130e]" : "font-semibold text-[#2f1c12]",
                          ].join(" ")}
                        >
                          {c.customerName || "Customer"} · {c.subject}
                        </p>
                        {hasUnreadWhileClosed ? (
                          <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-[#b84a2b] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                            {unreadCount}
                          </span>
                        ) : null}
                      </div>
                      <p
                        className={[
                          "truncate text-[11px]",
                          hasUnreadWhileClosed ? "font-semibold text-[#2f1c12]" : "text-[#6f5647]",
                        ].join(" ")}
                      >
                        {c.lastMessage?.text || "No messages yet"}
                      </p>
                      <p className="mt-1 text-[10px] uppercase tracking-wide text-[#8a6f5e]">{STATUS_LABELS[c.status]}</p>
                    </div>
                  </div>
                </button>
                  );
                })()}
              </li>
            ))}
          </ul>
        </aside>

        <div className="hidden min-h-0 flex-col overflow-hidden bg-white lg:flex">
          {activeConversation ? (
            <>
              <div className="border-b border-[#eee1d5] px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#f3e4d7] text-xs font-semibold text-[#5b2d17]">
                      {(activeConversation.customerName || "C").charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#1c130e]">{activeConversation.customerName} · {activeConversation.subject}</p>
                      <p className="truncate text-xs text-[#7a6a5d]">{activeConversation.customerPhone || activeConversation.customerEmail}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      void loadConversations();
                      void loadMessages();
                    }}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#dccbbb] bg-[#fffaf4] text-[#5b2d17]"
                    aria-label="Refresh chat"
                  >
                    <RotateCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
                  </button>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <select
                    value={activeConversation.status}
                    onChange={(e) => void updateStatus(e.target.value as Conversation["status"])}
                    className="rounded-lg border border-[#dccbbb] px-2.5 py-1.5 text-xs font-semibold text-[#5b2d17]"
                  >
                    <option value="open">{STATUS_LABELS.open}</option>
                    <option value="in_progress">{STATUS_LABELS.in_progress}</option>
                    <option value="resolved">{STATUS_LABELS.resolved}</option>
                  </select>
                </div>
              </div>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {messages.map((m, idx) => {
                  const own = m.senderRole === "admin";
                  return (
                    <div key={`${m.createdAt}-${idx}`} className={`flex ${own ? "justify-end" : "justify-start"}`}>
                      <div className="flex items-end gap-2">
                        {!own ? (
                          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#f3e4d7] text-[10px] font-semibold text-[#5b2d17]">
                            {(activeConversation.customerName || "C").charAt(0).toUpperCase()}
                          </span>
                        ) : null}
                      <div className={`max-w-[76%] rounded-2xl px-3 py-2 text-sm ${own ? "bg-[#5b2d17] text-white" : "bg-[#f3e8dc] text-[#2f1c12]"}`}>
                        <p>{m.text}</p>
                        <p className={`mt-1 text-[10px] ${own ? "text-white/80" : "text-[#6f5647]"}`}>
                          {new Date(m.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                        </p>
                      </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="border-t border-[#eee1d5] px-4 py-3">
                <div className="flex items-center gap-2">
                  <input
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="Reply to customer..."
                    className="flex-1 rounded-xl border border-[#dccbbb] px-3 py-2 text-sm outline-none focus:border-[#b84a2b]"
                  />
                  <button
                    type="button"
                    onClick={() => void sendReply()}
                    disabled={!reply.trim()}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#5b2d17] text-white disabled:opacity-50"
                  >
                    <SendHorizontal className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="m-auto px-6 text-center text-sm text-[#6f5647]">Select a support conversation to start replying.</div>
          )}
        </div>
      </section>
    </main>
  );
}


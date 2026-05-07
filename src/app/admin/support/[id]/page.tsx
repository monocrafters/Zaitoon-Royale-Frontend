"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, SendHorizontal } from "lucide-react";
import { API_BASE_URL, getAdminToken } from "@/lib/admin-auth";

type Conversation = {
  _id: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  subject: string;
  status: "open" | "in_progress" | "resolved";
};

type ChatMessage = {
  senderRole: "customer" | "admin";
  text: string;
  createdAt: string;
};

const STATUS_OPTIONS: Array<{ value: Conversation["status"]; label: string }> = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "resolved", label: "Resolved" },
];

export default function AdminSupportChatPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const conversationId = String(params?.id || "");

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);

  const dayKey = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  };

  const formatDividerLabel = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfThat = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diffDays = Math.round((startOfThat.getTime() - startOfToday.getTime()) / (24 * 60 * 60 * 1000));

    if (diffDays === 0) return "Today";
    if (diffDays === -1) return "Yesterday";

    if (d.getFullYear() === now.getFullYear()) {
      return d.toLocaleDateString("en-US", { weekday: "long" });
    }

    return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  };

  const load = useCallback(async () => {
    if (!conversationId) return;
    const token = getAdminToken();
    const res = await fetch(`${API_BASE_URL}/support/admin/${conversationId}/messages`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Unable to load chat.");
    setConversation(data.conversation || null);
    setMessages(Array.isArray(data.messages) ? data.messages : []);
  }, [conversationId]);

  useEffect(() => {
    const run = async () => {
      try {
        setError("");
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unable to load chat.");
      }
    };
    void run();
  }, [load]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  useEffect(() => {
    if (!conversationId) return;
    const t = setInterval(() => void load(), 4000);
    return () => clearInterval(t);
  }, [conversationId, load]);

  const canSend = useMemo(() => reply.trim().length > 0, [reply]);
  const isResolved = conversation?.status === "resolved";

  const onSend = async () => {
    if (!conversationId || !canSend) return;
    const token = getAdminToken();
    const text = reply.trim();
    setReply("");
    const res = await fetch(`${API_BASE_URL}/support/admin/${conversationId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ text }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.message || "Unable to send message.");
      return;
    }
    await load();
  };

  const updateStatus = async (nextStatus: Conversation["status"]) => {
    if (!conversationId) return;
    const token = getAdminToken();
    const res = await fetch(`${API_BASE_URL}/support/admin/${conversationId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status: nextStatus }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.message || "Unable to update status.");
      return;
    }
    await load();
  };

  return (
    <main className="-m-4 flex h-[calc(100vh-64px)] flex-col bg-white text-[#2f1c12] sm:-m-6 sm:h-[calc(100vh-74px)]">
      {/* Desktop header (in flow) */}
      <div className="hidden border-b border-[#e4d5c7] bg-white px-4 py-3 lg:block">
        <div className="flex w-full items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-[#f3e4d7] text-sm font-semibold text-[#5b2d17]">
            A
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{conversation?.customerName || "Customer"}</p>
            <p className="truncate text-[11px] text-[#6f5647]">{conversation?.customerPhone || conversation?.customerEmail || ""}</p>
          </div>
        </div>
      </div>

      {/* Mobile header (fixed) */}
      <div className="fixed inset-x-0 top-0 z-30 border-b border-[#e4d5c7] bg-white px-4 py-3 lg:hidden">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => router.back()} className="-ml-2 inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-black/5" aria-label="Back">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-[#f3e4d7] text-sm font-semibold text-[#5b2d17]">
              A
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{conversation?.customerName || "Customer"}</p>
              <p className="truncate text-[11px] text-[#6f5647]">{conversation?.customerPhone || conversation?.customerEmail || ""}</p>
            </div>
          </div>
        </div>
      </div>

      <section className="flex w-full flex-1 flex-col pt-[56px] lg:pt-0">
        <div
          className={[
            "flex-1 min-h-0 overflow-y-auto bg-transparent px-4 py-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden flex flex-col gap-2 scroll-smooth",
            "pb-[96px] lg:pb-4",
          ].join(" ")}
        >
          {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
          {messages.map((m, idx) => {
            const own = m.senderRole === "admin";
            const prev = messages[idx - 1];
            const showDivider = !prev || dayKey(prev.createdAt) !== dayKey(m.createdAt);
            return (
              <div key={`${m.createdAt}-${idx}`}>
                {showDivider ? (
                  <div className="sticky top-[56px] z-20 flex w-full items-center justify-center py-1.5">
                    <span className="rounded-full bg-[#f3e8dc] px-3 py-1 text-[11px] font-semibold text-[#6f5647]">
                      {formatDividerLabel(m.createdAt)}
                    </span>
                  </div>
                ) : null}
                <div className={`flex ${own ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[82%] rounded-2xl px-3 py-2 text-sm ${
                      own ? "bg-[#5b2d17] text-white" : "bg-[#f3e8dc] text-[#2f1c12]"
                    }`}
                  >
                    <p>{m.text}</p>
                    <p className={`mt-1 text-[10px] ${own ? "text-white/75" : "text-[#6f5647]"}`}>
                      {new Date(m.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>
      </section>

      {/* Desktop composer (in flow) */}
      <div className="hidden border-t border-[#e4d5c7] bg-white px-3 py-2 lg:block">
        <div className="flex w-full items-center gap-2">
          <input
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder={isResolved ? "Chat resolved" : "Reply…"}
            disabled={isResolved}
            className="flex-1 rounded-full border border-[#dccbbb] bg-white px-4 py-2.5 text-sm outline-none focus:border-[#b84a2b] disabled:bg-[#f3e8dc] disabled:text-[#6f5647]"
          />
          <button
            type="button"
            onClick={() => void onSend()}
            disabled={!canSend || isResolved}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#5b2d17] text-white disabled:opacity-50"
          >
            <SendHorizontal className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Mobile composer (fixed) */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#e4d5c7] bg-white px-3 py-2 lg:hidden">
        <div className="mb-2">
          <select
            value={conversation?.status || "open"}
            onChange={(e) => void updateStatus(e.target.value as Conversation["status"])}
            className="w-full rounded-xl border border-[#dccbbb] bg-[#fffaf4] px-3 py-2 text-xs font-semibold text-[#5b2d17] outline-none focus:border-[#b84a2b]"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div className="mx-auto flex w-full max-w-4xl items-center gap-2">
          <input
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder={isResolved ? "Chat resolved" : "Reply…"}
            disabled={isResolved}
            className="flex-1 rounded-full border border-[#dccbbb] bg-white px-4 py-2.5 text-sm outline-none focus:border-[#b84a2b] disabled:bg-[#f3e8dc] disabled:text-[#6f5647]"
          />
          <button
            type="button"
            onClick={() => void onSend()}
            disabled={!canSend || isResolved}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#5b2d17] text-white disabled:opacity-50"
          >
            <SendHorizontal className="h-4 w-4" />
          </button>
        </div>
      </div>
    </main>
  );
}


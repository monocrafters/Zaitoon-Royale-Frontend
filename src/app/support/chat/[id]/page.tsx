"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CheckCheck, ChevronLeft, SendHorizontal } from "lucide-react";
import SiteHeader from "@/components/public/site-header";
import { fetchSupportMessages, sendSupportMessage, sendSupportTyping } from "@/lib/support-chat";
import { useCustomerSession } from "@/lib/customer-auth";
import { useRestaurantSettings } from "@/lib/restaurant-settings";

type ChatMessage = {
  senderRole: "customer" | "admin";
  text: string;
  createdAt: string;
};

export default function SupportChatPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  useCustomerSession();
  const settings = useRestaurantSettings();
  const conversationId = String(params?.id || "");
  const [isMounted, setIsMounted] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [meta, setMeta] = useState<{ adminLastReadAt?: string | null; adminTypingAt?: string | null } | null>(null);
  const [conversationStatus, setConversationStatus] = useState<"open" | "in_progress" | "resolved">("open");
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
    try {
      setError("");
      const data = (await fetchSupportMessages(conversationId)) as any;
      setMessages(Array.isArray(data?.messages) ? (data.messages as ChatMessage[]) : []);
      setMeta(data?.meta || null);
      const st = String(data?.conversation?.status || "open") as any;
      if (st === "open" || st === "in_progress" || st === "resolved") setConversationStatus(st);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load chat.");
    }
  }, [conversationId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!conversationId) return;
    const t = setInterval(() => void load(), 4000);
    return () => clearInterval(t);
  }, [conversationId, load]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  const canSend = useMemo(() => reply.trim().length > 0 && !sending, [reply, sending]);
  const isResolved = conversationStatus === "resolved";

  useEffect(() => {
    if (!reply.trim() || !conversationId) return;
    const t = setTimeout(() => {
      void sendSupportTyping(conversationId);
    }, 800);
    return () => clearTimeout(t);
  }, [reply, conversationId]);

  const onSend = async () => {
    if (!canSend) return;
    const text = reply.trim();
    setReply("");
    setSending(true);
    try {
      await sendSupportMessage(conversationId, text);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to send message.");
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="flex h-screen w-full flex-col bg-white text-[#2f1c12]">
      <div className="hidden lg:block">
        <SiteHeader />
      </div>

      <div className="fixed inset-x-0 top-0 z-30 border-b border-[#eadccf] bg-[#fffaf4] px-4 py-3 text-[#2f1c12] lg:top-[64px]">
        <div className="flex w-full items-center gap-3">
          <button type="button" onClick={() => router.back()} className="-ml-2 inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/10">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-[#f3e4d7] text-sm font-semibold text-[#5b2d17]">
              {settings.adminLogoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={settings.adminLogoUrl} alt={settings.brandName} className="h-10 w-10 rounded-full object-cover" />
              ) : (
                "A"
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{settings.brandName}</p>
              <p className="text-[11px] text-[#6f5647]">We usually reply within minutes</p>
            </div>
          </div>
        </div>
      </div>

      <section className="flex h-[calc(100vh-64px)] w-full flex-col pt-[64px] lg:h-[calc(100vh-128px)] lg:pt-[128px]">
        <div className="flex-1 overflow-y-auto px-4 py-4 pb-[96px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden flex flex-col gap-2">
            {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
            {messages.map((m, idx) => {
              const own = m.senderRole === "customer";
              const prev = messages[idx - 1];
              const showDivider = !prev || dayKey(prev.createdAt) !== dayKey(m.createdAt);
              return (
                <div key={`${m.createdAt}-${idx}`}>
                  {showDivider ? (
                    <div className="sticky top-[64px] z-20 flex w-full items-center justify-center py-1.5 lg:top-[128px]">
                      <span className="rounded-full bg-[#f3e8dc] px-3 py-1 text-[11px] font-semibold text-[#6f5647]">
                        {formatDividerLabel(m.createdAt)}
                      </span>
                    </div>
                  ) : null}
                  <div className={`flex ${own ? "justify-end" : "justify-start"}`}>
                    <div
                      className={[
                        "max-w-[82%] rounded-2xl px-3 py-2 text-sm shadow-[0_6px_16px_rgba(0,0,0,0.08)]",
                        own ? "bg-[#5b2d17] text-white" : "bg-white text-[#111] border border-[#eadccf]",
                      ].join(" ")}
                    >
                      <p>{m.text}</p>
                      <div className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${own ? "text-white/80" : "text-[#6f5647]"}`}>
                        <span>{new Date(m.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
                        {own ? (
                          <span className="ml-1 inline-flex items-center">
                            {/* Delivered: double tick (grey). Seen: double tick (blue). */}
                            {meta?.adminLastReadAt && new Date(meta.adminLastReadAt).getTime() > new Date(m.createdAt).getTime() ? (
                              <CheckCheck className="h-3.5 w-3.5 text-sky-300" />
                            ) : (
                              <CheckCheck className="h-3.5 w-3.5 text-white/70" />
                            )}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            {meta?.adminTypingAt && Date.now() - new Date(meta.adminTypingAt).getTime() < 4500 ? (
              <div className="flex justify-start">
                <div className="rounded-2xl border border-[#eadccf] bg-white px-3 py-2 text-xs text-[#6f5647]">
                  {settings.brandName} is typing…
                </div>
              </div>
            ) : null}
            <div ref={endRef} />
        </div>

        <div className="fixed inset-x-0 bottom-0 z-30 flex flex-col border-t border-[#eadccf] bg-[#fffaf4] px-3 py-2">
          {isResolved ? <p className="mb-2 text-center text-xs font-semibold text-[#7a6a5d]">Resolved</p> : null}
          <div className="mt-auto flex w-full items-center gap-2">
            <input
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Message"
              disabled={isResolved}
              className="flex-1 rounded-full border border-[#dccbbb] bg-white px-4 py-2.5 text-sm outline-none focus:border-[#b84a2b] disabled:bg-[#f3e8dc]"
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
      </section>
    </main>
  );
}


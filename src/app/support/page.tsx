"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCheck, MessageCircleMore, RotateCw, SendHorizontal } from "lucide-react";
import SiteHeader from "@/components/public/site-header";
import { API_BASE_URL } from "@/lib/admin-auth";
import { getCustomerToken, useCustomerSession } from "@/lib/customer-auth";
import {
  createGuestSupportChat,
  getSupportGuestConversationId,
  startCustomerSupportChat,
} from "@/lib/support-chat";
import { fetchSupportMessages, sendSupportMessage } from "@/lib/support-chat";
import { useRestaurantSettings } from "@/lib/restaurant-settings";

type Conversation = {
  _id: string;
  customerName: string;
  customerProfileImageUrl?: string;
  subject: string;
  status: "open" | "in_progress" | "resolved";
  updatedAt: string;
  lastMessage?: { text: string; senderRole: "customer" | "admin"; createdAt: string } | null;
  unreadForCustomer?: number;
  typing?: { admin?: boolean };
};

const STATUS_LABELS: Record<Conversation["status"], string> = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
};

export default function SupportPage() {
  const router = useRouter();
  const { hasSession, profile } = useCustomerSession();
  const settings = useRestaurantSettings();
  const [isMounted, setIsMounted] = useState(false);
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState("");
  const [messages, setMessages] = useState<Array<{ senderRole: "customer" | "admin"; text: string; createdAt: string }>>([]);
  const [meta, setMeta] = useState<{ adminLastReadAt?: string | null; adminTypingAt?: string | null } | null>(null);
  const [reply, setReply] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  const isRegistered = isMounted && hasSession;
  const isGuest = isMounted && !hasSession;

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    const syncViewport = () => setIsDesktop(window.innerWidth >= 1024);
    syncViewport();
    window.addEventListener("resize", syncViewport);
    return () => window.removeEventListener("resize", syncViewport);
  }, []);

  useEffect(() => {
    setName(String(profile?.name || ""));
    setPhone(String(profile?.phone || ""));
    setEmail(String(profile?.email || ""));
  }, [profile?.email, profile?.name, profile?.phone]);

  const canSubmit = useMemo(() => name.trim() && message.trim(), [name, message]);

  const loadConversations = useCallback(async () => {
    setRefreshing(true);
    if (!hasSession) {
      setConversations([]);
      setActiveConversationId("");
      setRefreshing(false);
      return;
    }
    const token = getCustomerToken();
    if (!token) {
      setRefreshing(false);
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/support/my`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) return;
      const list = Array.isArray(data.tickets) ? (data.tickets as Conversation[]) : [];
      setConversations(list);
      setActiveConversationId((prev) => (isDesktop ? prev || list[0]?._id || "" : prev));
    } finally {
      setRefreshing(false);
    }
  }, [hasSession, isDesktop]);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (!isRegistered) return;
    const timer = setInterval(() => void loadConversations(), 4000);
    return () => clearInterval(timer);
  }, [isRegistered, loadConversations]);

  const loadMessages = useCallback(async () => {
    if (!activeConversationId) {
      setMessages([]);
      return;
    }
    try {
      const data = (await fetchSupportMessages(activeConversationId)) as any;
      setMessages(Array.isArray(data?.messages) ? data.messages : []);
      setMeta(data?.meta || null);
    } catch {
      // ignore
    }
  }, [activeConversationId]);

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    if (!activeConversationId) return;
    const t = setInterval(() => void loadMessages(), 4000);
    return () => clearInterval(t);
  }, [activeConversationId, loadMessages]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  const canSend = useMemo(() => reply.trim().length > 0, [reply]);
  const activeConversation = useMemo(
    () => conversations.find((c) => c._id === activeConversationId) || null,
    [conversations, activeConversationId]
  );
  const isActiveResolved = activeConversation?.status === "resolved";

  const onSend = async () => {
    if (!activeConversationId || !canSend) return;
    const text = reply.trim();
    setReply("");
    try {
      await sendSupportMessage(activeConversationId, text);
      await loadMessages();
      await loadConversations();
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    const run = async () => {
      try {
        if (!isMounted) return;
        if (hasSession) {
          const id = await startCustomerSupportChat();
          setActiveConversationId((prev) => prev || id);
          return;
        }
        const guestId = getSupportGuestConversationId();
        if (guestId) setActiveConversationId((prev) => prev || guestId);
      } catch {
        // ignore
      }
    };
    void run();
  }, [hasSession, isMounted]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit || busy) return;
    setBusy(true);
    setFeedback("");
    try {
      if (hasSession) {
        const id = await startCustomerSupportChat();
        setActiveConversationId(id);
        // On mobile user can open the chat page; on desktop panel is shown.
        if (window.innerWidth < 1024) router.push(`/support/chat/${id}`);
        return;
      }

      const id = await createGuestSupportChat({ name, phone, email, message });
      setMessage("");
      setFeedback("");
      setActiveConversationId(id);
      router.push(`/support/chat/${id}`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Unable to send ticket.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="h-screen overflow-hidden bg-white text-[#2f1c12]">
      <SiteHeader />
      <section
        className="mx-auto h-[calc(100vh-72px)] w-full max-w-7xl bg-white px-0 pt-[72px] sm:h-[calc(100vh-96px)] sm:px-6 sm:pt-[96px] lg:pt-[96px]"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 56px)" }}
      >
        <div className="grid h-[calc(100vh-72px-56px)] gap-0 lg:h-[calc(100vh-96px)] lg:grid-cols-[320px_1fr]">
          <aside className="min-h-0 overflow-y-auto border-y border-[#e1d2c4] bg-white p-3 lg:rounded-2xl lg:border lg:p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-[#1c130e]">Support</p>
              <button
                type="button"
                onClick={() => {
                  void loadConversations();
                  void loadMessages();
                }}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#dccbbb] bg-[#fffaf4] text-[#5b2d17]"
                aria-label="Refresh support"
              >
                <RotateCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              </button>
            </div>

            {!isMounted ? (
              <div className="mt-3 rounded-xl border border-[#eadccf] bg-[#fffaf4] p-3 text-sm text-[#6f5647]">
                Loading…
              </div>
            ) : isGuest ? (
              <form onSubmit={onSubmit} className="mt-3 space-y-2 border-t border-[#eee1d5] pt-3">
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="w-full rounded-lg border border-[#dccbbb] px-3 py-2 text-sm outline-none focus:border-[#b84a2b]" />
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" className="w-full rounded-lg border border-[#dccbbb] px-3 py-2 text-sm outline-none focus:border-[#b84a2b]" />
                <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (optional)" className="w-full rounded-lg border border-[#dccbbb] px-3 py-2 text-sm outline-none focus:border-[#b84a2b]" />
                <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} placeholder="Write your first message..." className="w-full rounded-lg border border-[#dccbbb] px-3 py-2 text-sm outline-none focus:border-[#b84a2b]" />
                <button disabled={!canSubmit || busy} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#5b2d17] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
                  <MessageCircleMore className="h-4 w-4" />
                  {busy ? "Starting..." : "Start Chat"}
                </button>
                {feedback ? <p className="text-xs text-[#7a3f22]">{feedback}</p> : null}
              </form>
            ) : (
              <div className="mt-3 rounded-xl border border-[#eadccf] bg-[#fffaf4] p-3 text-sm text-[#6f5647]">
                Your chat is ready. Select <span className="font-semibold text-[#2f1c12]">{settings.brandName}</span> to start messaging.
              </div>
            )}

            <ul className="mt-4 space-y-1.5 border-t border-[#eee1d5] pt-3">
              {conversations.map((c) => (
                <li key={c._id}>
                  {(() => {
                    const unreadCount = Math.max(0, Number(c.unreadForCustomer || 0));
                    const hasUnreadWhileClosed = unreadCount > 0 && !(isDesktop && activeConversationId === c._id);
                    return (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveConversationId(c._id);
                      if (typeof window !== "undefined" && window.innerWidth < 1024) {
                        router.push(`/support/chat/${c._id}`);
                      }
                    }}
                    className={`w-full rounded-lg border px-3 py-2 text-left transition ${activeConversationId === c._id ? "border-[#b84a2b] bg-[#fff3e7]" : "border-[#eadccf] bg-[#fffaf4] hover:bg-[#fff7ef]"}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#f3e4d7] text-sm font-semibold text-[#5b2d17]">
                        {settings.adminLogoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={settings.adminLogoUrl} alt={settings.brandName} className="h-10 w-10 rounded-full object-cover" />
                        ) : (
                          "A"
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p
                            className={[
                              "truncate text-sm",
                              hasUnreadWhileClosed ? "font-bold text-[#1c130e]" : "font-semibold text-[#2f1c12]",
                            ].join(" ")}
                          >
                            {settings.brandName}
                          </p>
                          {hasUnreadWhileClosed ? (
                            <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-[#2f1c12] px-1.5 text-[10px] font-bold leading-5 text-white">
                              {unreadCount}
                            </span>
                          ) : null}
                        </div>
                        <p
                          className={[
                            "mt-0.5 line-clamp-1 text-xs",
                            hasUnreadWhileClosed ? "font-semibold text-[#2f1c12]" : "text-[#6f5647]",
                          ].join(" ")}
                        >
                          {c.typing?.admin ? `${settings.brandName} is typing…` : c.lastMessage?.text || "No messages yet"}
                        </p>
                      </div>
                    </div>
                  </button>
                    );
                  })()}
                </li>
              ))}
            </ul>
          </aside>

          <div className="hidden min-h-0 overflow-hidden rounded-2xl border border-[#e1d2c4] bg-white lg:flex lg:flex-col">
            <div className="border-b border-[#eee1d5] px-4 py-3">
              <p className="text-sm font-semibold text-[#1c130e]">
                {activeConversationId ? "Chat" : "Chat Panel"}
              </p>
              <p className="text-xs text-[#6f5647]">
                {activeConversationId ? "Message support from here." : "Select a conversation from the left to start chatting."}
              </p>
            </div>
            {!activeConversationId ? (
              <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-[#6f5647]">
                Select a conversation to open the chat panel.
              </div>
            ) : (
              <>
                <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:px-4 sm:py-4">
                  {messages.map((m, idx) => {
                    const own = m.senderRole === "customer";
                    return (
                      <div key={`${m.createdAt}-${idx}`} className={`flex ${own ? "justify-end" : "justify-start"}`}>
                        <div className="flex items-end gap-2">
                          {!own ? (
                            <span className="inline-flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-[#f3e4d7] text-[10px] font-semibold text-[#5b2d17]">
                              {settings.adminLogoUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={settings.adminLogoUrl} alt={settings.brandName} className="h-7 w-7 rounded-full object-cover" />
                              ) : (
                                "A"
                              )}
                            </span>
                          ) : null}
                          <div className={`${own ? "bg-[#5b2d17] text-white" : "bg-[#f3e8dc] text-[#2f1c12]"} max-w-[78%] rounded-2xl px-3 py-2 text-sm`}>
                            <p>{m.text}</p>
                            <div className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${own ? "text-white/75" : "text-[#6f5647]"}`}>
                              <span>{new Date(m.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
                              {own ? (
                                <span className="ml-1 inline-flex items-center">
                                  {meta?.adminLastReadAt && new Date(meta.adminLastReadAt).getTime() > new Date(m.createdAt).getTime() ? (
                                    <CheckCheck className="h-3.5 w-3.5 text-sky-300" />
                                  ) : (
                                    <CheckCheck className="h-3.5 w-3.5 text-white/70" />
                                  )}
                                </span>
                              ) : null}
                            </div>
                          </div>
                          {own ? (
                            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#5b2d17] text-[10px] font-semibold text-white">
                              {(profile?.name || "U").charAt(0).toUpperCase()}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={endRef} />
                </div>
                <div className="border-t border-[#eee1d5] px-4 py-3">
                  {isActiveResolved ? (
                    <p className="rounded-xl border border-[#eadccf] bg-[#fffaf4] px-3 py-2 text-sm font-medium text-[#6f5647]">
                      Chat resolved.
                    </p>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input
                        value={reply}
                        onChange={(e) => setReply(e.target.value)}
                        placeholder="Message..."
                        className="flex-1 rounded-xl border border-[#dccbbb] px-3 py-2 text-sm outline-none focus:border-[#b84a2b]"
                      />
                      <button
                        type="button"
                        onClick={() => void onSend()}
                        disabled={!canSend}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#5b2d17] text-white disabled:opacity-50"
                      >
                        <SendHorizontal className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}


"use client";

import { io, Socket } from "socket.io-client";
import { API_BASE_URL } from "@/lib/admin-auth";

type SupportSocketAuth = {
  role: "admin" | "customer" | "guest";
  token: string;
};

let socket: Socket | null = null;
const rejoinHandlers = new Map<string, () => void>();

const resolveSocketBaseUrl = () => {
  try {
    const apiUrl = new URL(API_BASE_URL);
    if (typeof window !== "undefined") {
      const isLocalHost = apiUrl.hostname === "localhost" || apiUrl.hostname === "127.0.0.1";
      const pageHost = window.location.hostname;
      if (isLocalHost && pageHost !== "localhost" && pageHost !== "127.0.0.1") {
        // If app is opened on LAN IP, use same host with API port for socket.
        return `${window.location.protocol}//${pageHost}:${apiUrl.port || "5000"}`;
      }
    }
    return apiUrl.origin;
  } catch {
    return API_BASE_URL;
  }
};

export const getSupportSocket = () => {
  if (!socket) {
    socket = io(resolveSocketBaseUrl(), {
      transports: ["websocket", "polling"],
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 3000,
    });
  }
  return socket;
};

export const joinSupportRoom = (conversationId: string, auth: SupportSocketAuth) => {
  const s = getSupportSocket();
  const key = `${auth.role}:${conversationId}`;
  const old = rejoinHandlers.get(key);
  if (old) s.off("connect", old);
  const emitJoin = () => {
    s.emit("support:join", { conversationId, auth });
  };
  rejoinHandlers.set(key, emitJoin);
  emitJoin();
  s.on("connect", emitJoin);
  return s;
};

export const leaveSupportRoom = (conversationId: string, role?: SupportSocketAuth["role"]) => {
  const s = getSupportSocket();
  s.emit("support:leave", { conversationId });
  if (role) {
    const key = `${role}:${conversationId}`;
    const handler = rejoinHandlers.get(key);
    if (handler) {
      s.off("connect", handler);
      rejoinHandlers.delete(key);
    }
  }
};

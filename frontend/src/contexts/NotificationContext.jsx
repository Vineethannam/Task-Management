import { createContext, useContext, useEffect, useState, useRef, useCallback } from "react";
import { useAuth } from "./AuthContext";
import api from "@/lib/api";
import { toast } from "sonner";

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const wsRef = useRef(null);

  const load = useCallback(async () => {
    if (!user || !user.id) return;
    try {
      const { data } = await api.get("/notifications?page=1&page_size=20");
      setNotifications(data.items || []);
    } catch {}
  }, [user]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!user || !user.id) return;
    // Get an ephemeral access token via cookie -> we need to re-login endpoint returns access token
    // We call a special endpoint that returns short-lived token for WS
    let cancelled = false;
    (async () => {
      try {
        // The backend exposes ws at /api/ws with token param. We already have cookie access_token,
        // but cannot read httpOnly cookie in JS. So we rely on server issuing token in login response.
        // Fallback: skip WS if no token available in memory.
        const token = window.__SEMS_WS_TOKEN__;
        if (!token) return;
        const backend = process.env.REACT_APP_BACKEND_URL || "";
        const wsUrl = backend.replace(/^http/, "ws") + `/api/ws?token=${encodeURIComponent(token)}`;
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;
        ws.onmessage = (ev) => {
          try {
            const msg = JSON.parse(ev.data);
            if (msg.notification) {
              setNotifications((prev) => [msg.notification, ...prev]);
              toast(msg.notification.title || msg.type, {
                description: msg.notification.event_type,
              });
            }
          } catch {}
        };
        ws.onclose = () => { wsRef.current = null; };
      } catch {}
    })();
    return () => {
      cancelled = true;
      if (wsRef.current) { try { wsRef.current.close(); } catch {} }
    };
  }, [user]);

  const markRead = async (id) => {
    try {
      await api.post(`/notifications/${id}/read`);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    } catch {}
  };

  const markAllRead = async () => {
    try {
      await api.post("/notifications/read-all");
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {}
  };

  return (
    <NotificationContext.Provider value={{ notifications, markRead, markAllRead, reload: load }}>
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotifications = () => useContext(NotificationContext);

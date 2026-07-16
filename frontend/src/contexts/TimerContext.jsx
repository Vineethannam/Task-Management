import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import api, { formatApiError } from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "./AuthContext";

const TimerContext = createContext(null);

function computeElapsedSeconds(timer) {
  if (!timer) return 0;
  const acc = timer.accumulated_seconds || 0;
  if (timer.status !== "RUNNING") return acc;
  const anchor = timer.last_resumed_at || timer.started_at;
  if (!anchor) return acc;
  const started = new Date(anchor).getTime();
  const now = Date.now();
  return acc + Math.max(0, Math.floor((now - started) / 1000));
}

export function formatDuration(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function TimerProvider({ children }) {
  const { user } = useAuth();
  const [timer, setTimer] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const pollRef = useRef(null);
  const tickRef = useRef(null);

  const load = useCallback(async () => {
    if (!user || !user.id) { setTimer(null); return; }
    try {
      const { data } = await api.get("/me/timer/active");
      setTimer(data);
    } catch { setTimer(null); }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  // Poll every 30s in case another tab acts
  useEffect(() => {
    if (!user || !user.id) return;
    pollRef.current = setInterval(load, 30000);
    return () => clearInterval(pollRef.current);
  }, [user, load]);

  // 1s tick to update elapsed display
  useEffect(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    setElapsed(computeElapsedSeconds(timer));
    if (timer && timer.status === "RUNNING") {
      tickRef.current = setInterval(() => setElapsed(computeElapsedSeconds(timer)), 1000);
    }
    return () => tickRef.current && clearInterval(tickRef.current);
  }, [timer]);

  const start = async (taskId) => {
    try {
      const { data } = await api.post(`/tasks/${taskId}/timer/start`, {});
      setTimer(data);
      await load();
      toast.success("Timer started");
      return data;
    } catch (e) { toast.error(formatApiError(e)); return null; }
  };

  const pause = async (taskId) => {
    try {
      const { data } = await api.post(`/tasks/${taskId}/timer/pause`, {});
      setTimer(data);
      toast.success("Timer paused");
      return data;
    } catch (e) { toast.error(formatApiError(e)); return null; }
  };

  const stop = async (taskId) => {
    try {
      const { data } = await api.post(`/tasks/${taskId}/timer/stop`, {});
      setTimer(null);
      toast.success(`Timer stopped — ${data.accumulated_seconds}s tracked`);
      return data;
    } catch (e) { toast.error(formatApiError(e)); return null; }
  };

  const getTaskTimer = async (taskId) => {
    try { const { data } = await api.get(`/tasks/${taskId}/timer`); return data; }
    catch { return null; }
  };

  return (
    <TimerContext.Provider value={{ timer, elapsed, start, pause, stop, refresh: load, getTaskTimer }}>
      {children}
    </TimerContext.Provider>
  );
}

export const useTimer = () => useContext(TimerContext);

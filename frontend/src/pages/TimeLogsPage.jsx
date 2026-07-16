import { useEffect, useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { hasPerm } from "@/lib/constants";
import Pagination from "@/components/Pagination";
import usePaginatedList from "@/hooks/usePaginatedList";

const EVENT_TYPES = ["STARTED", "PAUSED", "RESUMED", "PROGRESS", "COMPLETED"];

export default function TimeLogsPage() {
  const { user: me } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ task_id: "", event_type: "STARTED", minutes: "", progress: "", note: "" });

  const { items: logs, total, page, pageSize, setPage, setPageSize, refresh } = usePaginatedList("/timelogs", {});

  useEffect(() => {
    (async () => {
      try {
        const [u, t] = await Promise.all([api.get("/users/all"), api.get("/tasks?page=1&page_size=200")]);
        setUsers(u.data); setTasks(t.data.items || []);
      } catch {}
    })();
  }, []);

  const create = async () => {
    try {
      await api.post("/timelogs", {
        task_id: form.task_id, event_type: form.event_type,
        minutes: form.minutes ? Number(form.minutes) : null,
        progress: form.progress ? Number(form.progress) : null,
        note: form.note,
      });
      toast.success("Time log added");
      setOpen(false);
      setForm({ task_id: "", event_type: "STARTED", minutes: "", progress: "", note: "" });
      refresh();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const userName = (id) => users.find((u) => u.id === id)?.name || "—";
  const taskName = (id) => tasks.find((t) => t.id === id)?.title || "—";
  const canCreate = hasPerm(me, "timelog.create");

  return (
    <div className="space-y-6" data-testid="timelogs-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight">Time Logs</h1>
          <p className="text-sm text-muted-foreground mt-1">Every start, pause, and finish across your tasks.</p>
        </div>
        {canCreate && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button data-testid="new-timelog-btn"><Plus className="w-4 h-4 mr-1" /> Log Time</Button>
            </DialogTrigger>
            <DialogContent data-testid="timelog-dialog">
              <DialogHeader><DialogTitle>Log Time</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Task</Label>
                  <Select value={form.task_id} onValueChange={(v) => setForm({ ...form, task_id: v })}>
                    <SelectTrigger data-testid="timelog-form-task"><SelectValue placeholder="Select task" /></SelectTrigger>
                    <SelectContent>
                      {tasks.map((t) => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Event</Label>
                  <Select value={form.event_type} onValueChange={(v) => setForm({ ...form, event_type: v })}>
                    <SelectTrigger data-testid="timelog-form-event"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {EVENT_TYPES.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Minutes</Label><Input type="number" value={form.minutes} onChange={(e) => setForm({ ...form, minutes: e.target.value })} data-testid="timelog-form-minutes" /></div>
                  <div><Label>Progress %</Label><Input type="number" min="0" max="100" value={form.progress} onChange={(e) => setForm({ ...form, progress: e.target.value })} data-testid="timelog-form-progress" /></div>
                </div>
                <div><Label>Note</Label><Textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} data-testid="timelog-form-note" /></div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={create} disabled={!form.task_id} data-testid="timelog-form-save">Save</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left">
                <th className="px-4 py-3 font-semibold">S.No</th>
                <th className="px-4 py-3 font-semibold">When</th>
                <th className="px-4 py-3 font-semibold">User</th>
                <th className="px-4 py-3 font-semibold">Task</th>
                <th className="px-4 py-3 font-semibold">Event</th>
                <th className="px-4 py-3 font-semibold">Minutes</th>
                <th className="px-4 py-3 font-semibold">Progress</th>
                <th className="px-4 py-3 font-semibold">Note</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l, i) => (
                <tr key={l.id} className="border-t border-border" data-testid={`timelog-row-${l.id}`}>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{(page - 1) * pageSize + i + 1}</td>
                  <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{new Date(l.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3">{userName(l.user_id)}</td>
                  <td className="px-4 py-3">{taskName(l.task_id)}</td>
                  <td className="px-4 py-3"><Badge variant="outline">{l.event_type}</Badge></td>
                  <td className="px-4 py-3 font-mono">{l.minutes ?? "—"}</td>
                  <td className="px-4 py-3 font-mono">{l.progress != null ? `${l.progress}%` : "—"}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{l.note || "—"}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">No logs yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={setPageSize} testidPrefix="timelogs-pagination" />
      </Card>
    </div>
  );
}

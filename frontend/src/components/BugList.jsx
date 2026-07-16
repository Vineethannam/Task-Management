import { useEffect, useState, useCallback } from "react";
import api, { formatApiError } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { BUG_STATUSES, BUG_SEVERITIES, statusBadgeClass, priorityBadgeClass, hasPerm } from "@/lib/constants";
import { Plus, Bug as BugIcon, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

export default function BugList({ projectId, users }) {
  const { user: me } = useAuth();
  const [bugs, setBugs] = useState([]);
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [activity, setActivity] = useState([]);
  const [form, setForm] = useState({ title: "", description: "", severity: "MEDIUM", status: "OPEN", assignee_id: "", estimated_hours: "" });

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/bugs?page=1&page_size=200&project_id=${projectId}`);
      setBugs(data.items || []);
    } catch {}
  }, [projectId]);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    try {
      await api.post("/bugs", {
        ...form, project_id: projectId,
        assignee_id: form.assignee_id || null,
        estimated_hours: form.estimated_hours ? Number(form.estimated_hours) : null,
      });
      toast.success("Bug reported");
      setOpen(false);
      setForm({ title: "", description: "", severity: "MEDIUM", status: "OPEN", assignee_id: "", estimated_hours: "" });
      load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const openDetail = async (b) => {
    setDetail(b);
    try {
      const { data } = await api.get(`/bugs/${b.id}/activity`);
      setActivity(data);
    } catch {}
  };

  const update = async (patch) => {
    if (!detail) return;
    try {
      const { data } = await api.put(`/bugs/${detail.id}`, patch);
      setDetail(data);
      const a = await api.get(`/bugs/${detail.id}/activity`);
      setActivity(a.data);
      load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const del = async (b) => {
    if (!window.confirm("Delete bug?")) return;
    try { await api.delete(`/bugs/${b.id}`); toast.success("Deleted"); setDetail(null); load(); } catch (e) { toast.error(formatApiError(e)); }
  };

  const userName = (id) => users.find((u) => u.id === id)?.name || "Unassigned";
  const canCreate = hasPerm(me, "bug.create");

  return (
    <div className="space-y-4" data-testid="bug-list">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BugIcon className="w-4 h-4" />
          <span className="text-sm text-muted-foreground">{bugs.length} bugs</span>
        </div>
        {canCreate && projectId && (
          <Button size="sm" onClick={() => setOpen(true)} data-testid="new-bug-btn"><Plus className="w-4 h-4 mr-1" /> Report Bug</Button>
        )}
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left">
                <th className="px-4 py-3 font-semibold">Title</th>
                <th className="px-4 py-3 font-semibold">Severity</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Assignee</th>
                <th className="px-4 py-3 font-semibold">Est (h)</th>
                <th className="px-4 py-3 font-semibold">Reopens</th>
                <th className="px-4 py-3 font-semibold">Reported</th>
              </tr>
            </thead>
            <tbody>
              {bugs.map((b) => (
                <tr key={b.id} className="border-t border-border hover:bg-muted/30 cursor-pointer" onClick={() => openDetail(b)} data-testid={`bug-row-${b.id}`}>
                  <td className="px-4 py-3 font-medium">{b.title}</td>
                  <td className="px-4 py-3"><Badge variant="outline" className={priorityBadgeClass(b.severity)}>{b.severity}</Badge></td>
                  <td className="px-4 py-3"><Badge variant="outline" className={statusBadgeClass(b.status)}>{b.status}</Badge></td>
                  <td className="px-4 py-3 text-muted-foreground">{userName(b.assignee_id)}</td>
                  <td className="px-4 py-3 font-mono">{b.estimated_hours ?? "—"}</td>
                  <td className="px-4 py-3 font-mono">{b.reopen_count || 0}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{new Date(b.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
              {bugs.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No bugs reported</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent data-testid="bug-create-dialog">
          <DialogHeader><DialogTitle>Report Bug</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} data-testid="bug-form-title" /></div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} data-testid="bug-form-description" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Severity</Label>
                <Select value={form.severity} onValueChange={(v) => setForm({ ...form, severity: v })}>
                  <SelectTrigger data-testid="bug-form-severity"><SelectValue /></SelectTrigger>
                  <SelectContent>{BUG_SEVERITIES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger data-testid="bug-form-status"><SelectValue /></SelectTrigger>
                  <SelectContent>{BUG_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Assignee</Label>
              <Select value={form.assignee_id || "none"} onValueChange={(v) => setForm({ ...form, assignee_id: v === "none" ? "" : v })}>
                <SelectTrigger data-testid="bug-form-assignee"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Estimated hours</Label>
              <Input type="number" min="0" step="0.5" value={form.estimated_hours} onChange={(e) => setForm({ ...form, estimated_hours: e.target.value })} data-testid="bug-form-estimate" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={create} data-testid="bug-form-save">Report</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="max-w-2xl" data-testid="bug-detail-dialog">
          {detail && (
            <>
              <DialogHeader><DialogTitle>{detail.title}</DialogTitle></DialogHeader>
              <div className="space-y-4 max-h-[70vh] overflow-y-auto">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className={statusBadgeClass(detail.status)}>{detail.status}</Badge>
                  <Badge variant="outline" className={priorityBadgeClass(detail.severity)}>{detail.severity}</Badge>
                  {detail.estimated_hours != null && <Badge variant="outline" className="text-[10px]">EST {detail.estimated_hours}h</Badge>}
                  {(detail.reopen_count || 0) > 0 && <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-800 border-purple-200">Reopened {detail.reopen_count}×</Badge>}
                  {(detail.reassign_count || 0) > 0 && <Badge variant="outline" className="text-[10px] bg-sky-50 text-sky-800 border-sky-200">Reassigned {detail.reassign_count}×</Badge>}
                </div>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{detail.description || "No description"}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Status</Label>
                    <Select value={detail.status} onValueChange={(v) => update({ status: v })}>
                      <SelectTrigger data-testid="bug-detail-status"><SelectValue /></SelectTrigger>
                      <SelectContent>{BUG_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Severity</Label>
                    <Select value={detail.severity} onValueChange={(v) => update({ severity: v })}>
                      <SelectTrigger data-testid="bug-detail-severity"><SelectValue /></SelectTrigger>
                      <SelectContent>{BUG_SEVERITIES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Assignee</Label>
                    <Select value={detail.assignee_id || "none"} onValueChange={(v) => update({ assignee_id: v === "none" ? null : v })}>
                      <SelectTrigger data-testid="bug-detail-assignee"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Unassigned</SelectItem>
                        {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Estimated hours</Label>
                    <Input type="number" min="0" step="0.5" value={detail.estimated_hours ?? ""} onChange={(e) => update({ estimated_hours: e.target.value ? Number(e.target.value) : null })} data-testid="bug-detail-estimate" />
                  </div>
                </div>

                <div>
                  <div className="text-xs uppercase tracking-widest font-semibold text-muted-foreground mb-2">Activity Log</div>
                  <div className="space-y-1 text-xs" data-testid="bug-activity-log">
                    {activity.map((a) => (
                      <div key={a.id} className="flex justify-between text-muted-foreground font-mono border-b border-border/50 py-1">
                        <span className="font-semibold text-foreground">{a.event} {a.details?.from ? `${a.details.from} → ${a.details.to || ""}` : ""}</span>
                        <span>{new Date(a.created_at).toLocaleString()}</span>
                      </div>
                    ))}
                    {activity.length === 0 && <div className="text-muted-foreground">No activity</div>}
                  </div>
                </div>
              </div>
              <DialogFooter>
                {hasPerm(me, "bug.delete") && (
                  <Button variant="ghost" onClick={() => del(detail)} data-testid="bug-detail-delete">
                    <Trash2 className="w-4 h-4 mr-1" /> Delete
                  </Button>
                )}
                <Button variant="outline" onClick={() => setDetail(null)}>Close</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

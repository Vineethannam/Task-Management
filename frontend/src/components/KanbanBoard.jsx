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
import { TASK_STATUSES, TASK_STATUS_LABELS, TASK_PRIORITIES, statusBadgeClass, priorityBadgeClass, hasPerm } from "@/lib/constants";
import { Plus, MessageSquare, Clock, User as UserIcon, Trash2, Play, Pause, Square } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useTimer, formatDuration } from "@/contexts/TimerContext";

export default function KanbanBoard({ projectId, users, teams }) {
  const { user: me } = useAuth();
  const { timer: activeTimer, elapsed: activeElapsed, start: tStart, pause: tPause, stop: tStop } = useTimer();
  const [tasks, setTasks] = useState([]);
  const [open, setOpen] = useState(false);
  const [detailTask, setDetailTask] = useState(null);
  const [form, setForm] = useState({ title: "", description: "", assignee_id: "", team_id: "", priority: "MEDIUM", status: "BACKLOG", due_date: "", estimated_hours: "" });
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [activity, setActivity] = useState([]);
  const [subtasks, setSubtasks] = useState([]);
  const [subtaskForm, setSubtaskForm] = useState({ title: "", assignee_id: "" });

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/tasks/by-project/${projectId}`);
      setTasks(data);
    } catch {}
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const openNew = (status = "BACKLOG") => {
    setForm({ title: "", description: "", assignee_id: "", team_id: "", priority: "MEDIUM", status, due_date: "", estimated_hours: "" });
    setOpen(true);
  };

  const create = async () => {
    try {
      await api.post("/tasks", {
        ...form, project_id: projectId,
        assignee_id: form.assignee_id || null,
        team_id: form.team_id || null,
        due_date: form.due_date || null,
        estimated_hours: form.estimated_hours ? Number(form.estimated_hours) : null,
      });
      toast.success("Task created");
      setOpen(false);
      load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const openDetail = async (t) => {
    setDetailTask(t);
    setNewComment("");
    setSubtasks([]);
    setSubtaskForm({ title: "", assignee_id: "" });
    try {
      const [c, a, s] = await Promise.all([
        api.get(`/tasks/${t.id}/comments`),
        api.get(`/tasks/${t.id}/activity`),
        api.get(`/tasks/${t.id}/subtasks`),
      ]);
      setComments(c.data);
      setActivity(a.data);
      setSubtasks(s.data);
    } catch {}
  };

  const updateTask = async (patch) => {
    if (!detailTask) return;
    try {
      const { data } = await api.put(`/tasks/${detailTask.id}`, patch);
      setDetailTask(data);
      const a = await api.get(`/tasks/${detailTask.id}/activity`);
      setActivity(a.data);
      load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const moveStatus = async (task, status) => {
    try {
      await api.put(`/tasks/${task.id}`, { status });
      load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const addComment = async () => {
    if (!newComment.trim()) return;
    try {
      await api.post(`/tasks/${detailTask.id}/comments`, { content: newComment });
      setNewComment("");
      const [c, a] = await Promise.all([
        api.get(`/tasks/${detailTask.id}/comments`),
        api.get(`/tasks/${detailTask.id}/activity`),
      ]);
      setComments(c.data); setActivity(a.data);
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const handleAddSubtask = async () => {
    if (!subtaskForm.title.trim()) return;
    try {
      await api.post("/tasks", {
        title: subtaskForm.title,
        description: "",
        project_id: projectId,
        assignee_id: subtaskForm.assignee_id || null,
        priority: "MEDIUM",
        status: "BACKLOG",
        parent_id: detailTask.id,
      });
      setSubtaskForm({ title: "", assignee_id: "" });
      toast.success("Subtask added");
      const { data } = await api.get(`/tasks/${detailTask.id}/subtasks`);
      setSubtasks(data);
      load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const del = async (t) => {
    if (!window.confirm("Delete task?")) return;
    try { await api.delete(`/tasks/${t.id}`); toast.success("Deleted"); setDetailTask(null); load(); } catch (e) { toast.error(formatApiError(e)); }
  };

  const userName = (id) => users.find((u) => u.id === id)?.name || "Unassigned";
  const canCreate = hasPerm(me, "task.create");

  return (
    <div className="space-y-4" data-testid="kanban-board">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">Drag-drop is via status dropdown per card (keyboard-friendly).</div>
        {canCreate && <Button onClick={() => openNew()} size="sm" data-testid="new-task-btn"><Plus className="w-4 h-4 mr-1" /> New Task</Button>}
      </div>

      <div className="flex overflow-x-auto gap-4 pb-4">
        {TASK_STATUSES.map((status) => {
          const colTasks = tasks.filter((t) => t.status === status);
          return (
            <div key={status} className="min-w-[300px] w-[300px] flex-shrink-0 kanban-col rounded-md p-3" data-testid={`kanban-col-${status}`}>
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={statusBadgeClass(status)}>{TASK_STATUS_LABELS[status]}</Badge>
                  <span className="text-xs text-muted-foreground font-mono">{colTasks.length}</span>
                </div>
                {canCreate && (
                  <button onClick={() => openNew(status)} className="text-muted-foreground hover:text-foreground" data-testid={`kanban-add-${status}`}>
                    <Plus className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {colTasks.map((t) => (
                  <Card
                    key={t.id}
                    className="p-3 cursor-pointer hover-lift"
                    data-testid={`task-card-${t.id}`}
                    onClick={() => openDetail(t)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-sm font-medium leading-snug flex-1">{t.title}</div>
                      <Badge variant="outline" className={`${priorityBadgeClass(t.priority)} text-[9px] shrink-0`}>{t.priority}</Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                      <UserIcon className="w-3 h-3" />
                      <span className="truncate">{userName(t.assignee_id)}</span>
                    </div>
                    {t.due_date && (
                      <div className="flex items-center gap-1 mt-1.5 text-[10px] text-muted-foreground font-mono">
                        <Clock className="w-3 h-3" /> {t.due_date}
                      </div>
                    )}
                  </Card>
                ))}
                {colTasks.length === 0 && <div className="text-xs text-muted-foreground text-center py-6">No tasks</div>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Create task dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent data-testid="task-create-dialog">
          <DialogHeader><DialogTitle>New Task</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} data-testid="task-form-title" /></div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} data-testid="task-form-description" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                  <SelectTrigger data-testid="task-form-priority"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TASK_PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger data-testid="task-form-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TASK_STATUSES.map((s) => <SelectItem key={s} value={s}>{TASK_STATUS_LABELS[s]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Assignee</Label>
              <Select value={form.assignee_id || "none"} onValueChange={(v) => setForm({ ...form, assignee_id: v === "none" ? "" : v })}>
                <SelectTrigger data-testid="task-form-assignee"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Team</Label>
              <Select value={form.team_id || "none"} onValueChange={(v) => setForm({ ...form, team_id: v === "none" ? "" : v })}>
                <SelectTrigger data-testid="task-form-team"><SelectValue placeholder="No team" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No team</SelectItem>
                  {teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Due date</Label>
              <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} data-testid="task-form-due" />
            </div>
            <div>
              <Label>Estimated hours</Label>
              <Input type="number" min="0" step="0.5" value={form.estimated_hours} onChange={(e) => setForm({ ...form, estimated_hours: e.target.value })} data-testid="task-form-estimate" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={create} data-testid="task-form-save">Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Task detail */}
      <Dialog open={!!detailTask} onOpenChange={(v) => !v && setDetailTask(null)}>
        <DialogContent className="max-w-2xl" data-testid="task-detail-dialog">
          {detailTask && (
            <>
              {detailTask.parent_id && (
                <button
                  onClick={async () => {
                    try {
                      const r = await api.get(`/tasks/${detailTask.parent_id}`);
                      openDetail(r.data);
                    } catch {
                      toast.error("Failed to load parent task");
                    }
                  }}
                  className="text-xs text-primary hover:underline flex items-center gap-1 mb-2 self-start"
                  data-testid="back-to-parent-btn"
                >
                  ← Back to parent task
                </button>
              )}
              <DialogHeader>
                <DialogTitle className="pr-8">{detailTask.title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 max-h-[70vh] overflow-y-auto">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className={statusBadgeClass(detailTask.status)}>{TASK_STATUS_LABELS[detailTask.status]}</Badge>
                  <Badge variant="outline" className={priorityBadgeClass(detailTask.priority)}>{detailTask.priority}</Badge>
                  <span className="text-xs text-muted-foreground font-mono">#{detailTask.id.slice(-6)}</span>
                  {detailTask.estimated_hours != null && <Badge variant="outline" className="text-[10px]">EST {detailTask.estimated_hours}h</Badge>}
                  {detailTask.total_minutes_tracked > 0 && <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-800 border-emerald-200">Tracked {Math.round(detailTask.total_minutes_tracked)}m</Badge>}
                  {(detailTask.deadline_changes || 0) > 0 && <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-800 border-amber-200">Deadline changed {detailTask.deadline_changes}×</Badge>}
                  {(detailTask.reassign_count || 0) > 0 && <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-800 border-purple-200">Reassigned {detailTask.reassign_count}×</Badge>}
                </div>

                {/* Task Timer */}
                {(() => {
                  const isMine = activeTimer && activeTimer.task_id === detailTask.id;
                  const running = isMine && activeTimer.status === "RUNNING";
                  const paused = isMine && activeTimer.status === "PAUSED";
                  const display = isMine ? formatDuration(activeElapsed) : formatDuration(0);
                  return (
                    <div className="flex items-center gap-3 p-3 rounded-md border border-primary/20 bg-primary/5" data-testid="task-timer-controls">
                      <Clock className={`w-4 h-4 ${running ? "text-primary animate-pulse" : "text-muted-foreground"}`} />
                      <div className="flex-1">
                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Task Timer</div>
                        <div className="font-mono text-lg font-semibold text-primary" data-testid="task-timer-elapsed">{display}</div>
                      </div>
                      {!isMine && (
                        <Button size="sm" onClick={() => tStart(detailTask.id)} data-testid="task-timer-start">
                          <Play className="w-3.5 h-3.5 mr-1" /> Start
                        </Button>
                      )}
                      {running && (
                        <Button size="sm" variant="outline" onClick={() => tPause(detailTask.id)} data-testid="task-timer-pause">
                          <Pause className="w-3.5 h-3.5 mr-1" /> Pause
                        </Button>
                      )}
                      {paused && (
                        <Button size="sm" onClick={() => tStart(detailTask.id)} data-testid="task-timer-resume">
                          <Play className="w-3.5 h-3.5 mr-1" /> Resume
                        </Button>
                      )}
                      {isMine && (
                        <Button size="sm" variant="outline" onClick={async () => { await tStop(detailTask.id); openDetail(await api.get(`/tasks/${detailTask.id}`).then((r) => r.data)); }} data-testid="task-timer-stop">
                          <Square className="w-3.5 h-3.5 mr-1" /> Stop
                        </Button>
                      )}
                    </div>
                  );
                })()}
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{detailTask.description || "No description"}</p>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Assignee</Label>
                    <Select value={detailTask.assignee_id || "none"} onValueChange={(v) => updateTask({ assignee_id: v === "none" ? null : v })}>
                      <SelectTrigger data-testid="task-detail-assignee"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Unassigned</SelectItem>
                        {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Status</Label>
                    <Select value={detailTask.status} onValueChange={(v) => updateTask({ status: v })}>
                      <SelectTrigger data-testid="task-detail-status"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TASK_STATUSES.map((s) => <SelectItem key={s} value={s}>{TASK_STATUS_LABELS[s]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Priority</Label>
                    <Select value={detailTask.priority} onValueChange={(v) => updateTask({ priority: v })}>
                      <SelectTrigger data-testid="task-detail-priority"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TASK_PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Due date</Label>
                    <Input type="date" value={detailTask.due_date || ""} onChange={(e) => updateTask({ due_date: e.target.value || null })} data-testid="task-detail-due" />
                  </div>
                  <div>
                    <Label className="text-xs">Estimated hours</Label>
                    <Input type="number" min="0" step="0.5" value={detailTask.estimated_hours ?? ""} onChange={(e) => updateTask({ estimated_hours: e.target.value ? Number(e.target.value) : null })} data-testid="task-detail-estimate" />
                  </div>
                </div>

                {!detailTask.parent_id && (
                  <div>
                    <div className="text-xs uppercase tracking-widest font-semibold text-muted-foreground mb-2">Subtasks</div>
                    <div className="space-y-2 mb-3">
                      {subtasks.map((sub) => (
                        <div
                          key={sub.id}
                          className="flex items-center justify-between p-2 border border-border rounded-md hover:bg-muted/30 cursor-pointer text-sm"
                          onClick={async () => {
                            try {
                              const r = await api.get(`/tasks/${sub.id}`);
                              openDetail(r.data);
                            } catch {}
                          }}
                          data-testid={`subtask-item-${sub.id}`}
                        >
                          <div className="font-medium truncate mr-2">{sub.title}</div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs text-muted-foreground">{userName(sub.assignee_id)}</span>
                            <Badge variant="outline" className={statusBadgeClass(sub.status)}>{TASK_STATUS_LABELS[sub.status]}</Badge>
                          </div>
                        </div>
                      ))}
                      {subtasks.length === 0 && <div className="text-xs text-muted-foreground">No subtasks yet</div>}
                    </div>

                    <div className="border border-dashed border-border p-3 rounded-md space-y-2">
                      <div className="text-xs font-semibold text-muted-foreground">Add Subtask</div>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Subtask title…"
                          value={subtaskForm.title}
                          onChange={(e) => setSubtaskForm({ ...subtaskForm, title: e.target.value })}
                          data-testid="subtask-title-input"
                          className="h-8 text-sm flex-1"
                        />
                        <Select
                          value={subtaskForm.assignee_id || "none"}
                          onValueChange={(v) => setSubtaskForm({ ...subtaskForm, assignee_id: v === "none" ? "" : v })}
                        >
                          <SelectTrigger className="w-36 h-8 text-xs" data-testid="subtask-assignee-select">
                            <SelectValue placeholder="Assignee" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Unassigned</SelectItem>
                            {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Button
                          onClick={handleAddSubtask}
                          size="sm"
                          className="h-8 text-xs"
                          data-testid="subtask-submit-btn"
                        >
                          Add
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <div className="text-xs uppercase tracking-widest font-semibold text-muted-foreground mb-2">Comments</div>
                  <div className="space-y-2">
                    {comments.map((c) => (
                      <div key={c.id} className="border border-border rounded-md p-2 text-sm">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-medium text-xs">{c.user_name}</span>
                          <span className="text-[10px] text-muted-foreground font-mono">{new Date(c.created_at).toLocaleString()}</span>
                        </div>
                        <div>{c.content}</div>
                      </div>
                    ))}
                    {comments.length === 0 && <div className="text-xs text-muted-foreground">No comments yet</div>}
                  </div>
                  <div className="flex gap-2 mt-2">
                    <Input placeholder="Add a comment…" value={newComment} onChange={(e) => setNewComment(e.target.value)} data-testid="task-comment-input" />
                    <Button onClick={addComment} size="sm" data-testid="task-comment-submit"><MessageSquare className="w-4 h-4" /></Button>
                  </div>
                </div>

                <div>
                  <div className="text-xs uppercase tracking-widest font-semibold text-muted-foreground mb-2">Activity</div>
                  <div className="space-y-1 text-xs">
                    {activity.map((a) => (
                      <div key={a.id} className="flex justify-between text-muted-foreground font-mono">
                        <span>{a.event} {a.details?.from ? `${a.details.from} → ${a.details.to}` : ""}</span>
                        <span>{new Date(a.created_at).toLocaleString()}</span>
                      </div>
                    ))}
                    {activity.length === 0 && <div className="text-muted-foreground">No activity</div>}
                  </div>
                </div>
              </div>
              <DialogFooter>
                {hasPerm(me, "task.delete") && (
                  <Button variant="ghost" onClick={() => del(detailTask)} data-testid="task-detail-delete">
                    <Trash2 className="w-4 h-4 mr-1" /> Delete
                  </Button>
                )}
                <Button variant="outline" onClick={() => setDetailTask(null)}>Close</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

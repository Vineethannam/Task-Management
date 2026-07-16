import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TASK_STATUSES, TASK_STATUS_LABELS, TASK_PRIORITIES, statusBadgeClass, priorityBadgeClass } from "@/lib/constants";
import { Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Pagination from "@/components/Pagination";
import usePaginatedList from "@/hooks/usePaginatedList";

export default function TasksPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");

  const { items: tasks, total, page, pageSize, setPage, setPageSize } = usePaginatedList("/tasks", {
    q,
    status: statusFilter === "all" ? "" : statusFilter,
    priority: priorityFilter === "all" ? "" : priorityFilter,
    project_id: projectFilter === "all" ? "" : projectFilter,
  });

  useEffect(() => {
    (async () => {
      try {
        const [u, p] = await Promise.all([api.get("/users/all"), api.get("/projects/all")]);
        setUsers(u.data); setProjects(p.data);
      } catch {}
    })();
  }, []);

  const userName = (id) => users.find((u) => u.id === id)?.name || "Unassigned";
  const projectName = (id) => projects.find((p) => p.id === id)?.name || "—";

  return (
    <div className="space-y-6" data-testid="tasks-page">
      <div>
        <h1 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight">Tasks</h1>
        <p className="text-sm text-muted-foreground mt-1">Global task list across every project.</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tasks…" className="pl-9" data-testid="tasks-search" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40" data-testid="tasks-filter-status"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {TASK_STATUSES.map((s) => <SelectItem key={s} value={s}>{TASK_STATUS_LABELS[s]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-40" data-testid="tasks-filter-priority"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            {TASK_PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger className="w-52" data-testid="tasks-filter-project"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All projects</SelectItem>
            {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left">
                <th className="px-4 py-3 font-semibold">S.No</th>
                <th className="px-4 py-3 font-semibold">Title</th>
                <th className="px-4 py-3 font-semibold">Project</th>
                <th className="px-4 py-3 font-semibold">Assignee</th>
                <th className="px-4 py-3 font-semibold">Priority</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Est (h)</th>
                <th className="px-4 py-3 font-semibold">Deadline Δ</th>
                <th className="px-4 py-3 font-semibold">Due</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t, i) => (
                <tr key={t.id} className="border-t border-border hover:bg-muted/30 cursor-pointer" data-testid={`task-row-${t.id}`}
                  onClick={() => t.project_id && navigate(`/projects/${t.project_id}`)}
                >
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{(page - 1) * pageSize + i + 1}</td>
                  <td className="px-4 py-3 font-medium">{t.title}</td>
                  <td className="px-4 py-3 text-muted-foreground">{projectName(t.project_id)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{userName(t.assignee_id)}</td>
                  <td className="px-4 py-3"><Badge variant="outline" className={priorityBadgeClass(t.priority)}>{t.priority}</Badge></td>
                  <td className="px-4 py-3"><Badge variant="outline" className={statusBadgeClass(t.status)}>{TASK_STATUS_LABELS[t.status]}</Badge></td>
                  <td className="px-4 py-3 font-mono">{t.estimated_hours ?? "—"}</td>
                  <td className="px-4 py-3 font-mono">{t.deadline_changes || 0}</td>
                  <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{t.due_date || "—"}</td>
                </tr>
              ))}
              {tasks.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">No tasks</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={setPageSize} testidPrefix="tasks-pagination" />
      </Card>
    </div>
  );
}

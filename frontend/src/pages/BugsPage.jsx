import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BUG_STATUSES, BUG_SEVERITIES, statusBadgeClass, priorityBadgeClass } from "@/lib/constants";
import { Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Pagination from "@/components/Pagination";
import usePaginatedList from "@/hooks/usePaginatedList";

export default function BugsPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sevFilter, setSevFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");

  const { items: bugs, total, page, pageSize, setPage, setPageSize } = usePaginatedList("/bugs", {
    q,
    status: statusFilter === "all" ? "" : statusFilter,
    severity: sevFilter === "all" ? "" : sevFilter,
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
    <div className="space-y-6" data-testid="bugs-page">
      <div>
        <h1 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight">Bugs</h1>
        <p className="text-sm text-muted-foreground mt-1">Defects across the entire organization.</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search bugs…" className="pl-9" data-testid="bugs-search" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40" data-testid="bugs-filter-status"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {BUG_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={sevFilter} onValueChange={setSevFilter}>
          <SelectTrigger className="w-40" data-testid="bugs-filter-severity"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All severities</SelectItem>
            {BUG_SEVERITIES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger className="w-52" data-testid="bugs-filter-project"><SelectValue /></SelectTrigger>
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
                <th className="px-4 py-3 font-semibold">Severity</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Assignee</th>
                <th className="px-4 py-3 font-semibold">Est (h)</th>
                <th className="px-4 py-3 font-semibold">Reopens</th>
                <th className="px-4 py-3 font-semibold">Reported</th>
              </tr>
            </thead>
            <tbody>
              {bugs.map((b, i) => (
                <tr key={b.id} className="border-t border-border hover:bg-muted/30 cursor-pointer" data-testid={`bug-list-row-${b.id}`}
                  onClick={() => b.project_id && navigate(`/projects/${b.project_id}`)}
                >
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{(page - 1) * pageSize + i + 1}</td>
                  <td className="px-4 py-3 font-medium">{b.title}</td>
                  <td className="px-4 py-3 text-muted-foreground">{projectName(b.project_id)}</td>
                  <td className="px-4 py-3"><Badge variant="outline" className={priorityBadgeClass(b.severity)}>{b.severity}</Badge></td>
                  <td className="px-4 py-3"><Badge variant="outline" className={statusBadgeClass(b.status)}>{b.status}</Badge></td>
                  <td className="px-4 py-3 text-muted-foreground">{userName(b.assignee_id)}</td>
                  <td className="px-4 py-3 font-mono">{b.estimated_hours ?? "—"}</td>
                  <td className="px-4 py-3 font-mono">{b.reopen_count || 0}</td>
                  <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{new Date(b.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
              {bugs.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">No bugs</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={setPageSize} testidPrefix="bugs-pagination" />
      </Card>
    </div>
  );
}

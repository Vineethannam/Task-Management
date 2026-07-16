import { useEffect, useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { hasPerm } from "@/lib/constants";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, Trash2, Pencil, FolderKanban, ArrowRight, Search } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import Pagination from "@/components/Pagination";
import usePaginatedList from "@/hooks/usePaginatedList";

export default function ProjectsPage() {
  const { user: me } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    name: "", description: "", team_lead_id: "", team_ids: [], member_ids: [],
    start_date: "", end_date: "", status: "active",
  });

  const { items: projects, total, page, pageSize, setPage, setPageSize, refresh } =
    usePaginatedList("/projects", { q, status: statusFilter === "all" ? "" : statusFilter });

  useEffect(() => {
    (async () => {
      try {
        const [u, t] = await Promise.all([api.get("/users/all"), api.get("/teams/all")]);
        setUsers(u.data); setTeams(t.data);
      } catch {}
    })();
  }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", description: "", team_lead_id: "", team_ids: [], member_ids: [], start_date: "", end_date: "", status: "active" });
    setOpen(true);
  };
  const openEdit = (p) => {
    setEditing(p);
    setForm({
      name: p.name, description: p.description || "",
      team_lead_id: p.team_lead_id || "",
      team_ids: p.team_ids || [], member_ids: p.member_ids || [],
      start_date: p.start_date || "", end_date: p.end_date || "",
      status: p.status || "active",
    });
    setOpen(true);
  };
  const save = async () => {
    try {
      const payload = {
        ...form,
        team_lead_id: form.team_lead_id || null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
      };
      if (editing) { await api.put(`/projects/${editing.id}`, payload); toast.success("Project updated"); }
      else { await api.post("/projects", payload); toast.success("Project created"); }
      setOpen(false); refresh();
    } catch (e) { toast.error(formatApiError(e)); }
  };
  const del = async (p) => {
    if (!window.confirm(`Delete project ${p.name}?`)) return;
    try { await api.delete(`/projects/${p.id}`); toast.success("Deleted"); refresh(); } catch (e) { toast.error(formatApiError(e)); }
  };
  const toggleTeam = (id) => setForm((f) => ({ ...f, team_ids: f.team_ids.includes(id) ? f.team_ids.filter(x => x !== id) : [...f.team_ids, id] }));
  const toggleMember = (id) => setForm((f) => ({ ...f, member_ids: f.member_ids.includes(id) ? f.member_ids.filter(x => x !== id) : [...f.member_ids, id] }));
  const userName = (id) => users.find((u) => u.id === id)?.name || "—";
  const canCreate = hasPerm(me, "project.create");
  const canUpdate = hasPerm(me, "project.update");
  const canDelete = hasPerm(me, "project.delete");

  return (
    <div className="space-y-6" data-testid="projects-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground mt-1">Every initiative your engineering org is shipping.</p>
        </div>
        {canCreate && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNew} data-testid="new-project-btn"><Plus className="w-4 h-4 mr-1" /> New Project</Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl" data-testid="project-dialog">
              <DialogHeader><DialogTitle>{editing ? "Edit Project" : "Create Project"}</DialogTitle></DialogHeader>
              <div className="space-y-4 max-h-[70vh] overflow-y-auto">
                <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="project-form-name" /></div>
                <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} data-testid="project-form-description" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Start Date</Label><Input type="date" value={form.start_date || ""} onChange={(e) => setForm({ ...form, start_date: e.target.value })} data-testid="project-form-start" /></div>
                  <div><Label>End Date</Label><Input type="date" value={form.end_date || ""} onChange={(e) => setForm({ ...form, end_date: e.target.value })} data-testid="project-form-end" /></div>
                </div>
                <div>
                  <Label>Team Lead</Label>
                  <Select value={form.team_lead_id || "none"} onValueChange={(v) => setForm({ ...form, team_lead_id: v === "none" ? "" : v })}>
                    <SelectTrigger data-testid="project-form-lead"><SelectValue placeholder="Select lead" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No lead</SelectItem>
                      {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger data-testid="project-form-status"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="paused">Paused</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Teams</Label>
                  <div className="border border-border rounded-md p-3 max-h-40 overflow-y-auto space-y-1">
                    {teams.map((t) => (
                      <label key={t.id} className="flex items-center gap-2 py-1 cursor-pointer text-sm">
                        <input type="checkbox" checked={form.team_ids.includes(t.id)} onChange={() => toggleTeam(t.id)} />
                        <span>{t.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <Label>Members</Label>
                  <div className="border border-border rounded-md p-3 max-h-40 overflow-y-auto space-y-1">
                    {users.map((u) => (
                      <label key={u.id} className="flex items-center gap-2 py-1 cursor-pointer text-sm">
                        <input type="checkbox" checked={form.member_ids.includes(u.id)} onChange={() => toggleMember(u.id)} />
                        <span>{u.name}</span>
                        <span className="text-xs text-muted-foreground">({u.role})</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={save} data-testid="project-form-save">{editing ? "Save" : "Create"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search projects…" className="pl-9" data-testid="projects-search" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40" data-testid="projects-filter-status"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map((p) => (
          <Card key={p.id} className="p-5 hover-lift flex flex-col" data-testid={`project-card-${p.id}`}>
            <div className="flex items-start justify-between mb-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <FolderKanban className="w-4 h-4 text-primary" />
                  <h3 className="font-heading font-semibold text-lg truncate">{p.name}</h3>
                </div>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.description || "No description"}</p>
              </div>
              <div className="flex gap-1">
                {canUpdate && <Button variant="ghost" size="icon" onClick={() => openEdit(p)} data-testid={`project-edit-${p.id}`}><Pencil className="w-4 h-4" /></Button>}
                {canDelete && <Button variant="ghost" size="icon" onClick={() => del(p)} data-testid={`project-delete-${p.id}`}><Trash2 className="w-4 h-4" /></Button>}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span>Lead: {userName(p.team_lead_id)}</span>
              <span>·</span>
              <span>{(p.team_ids || []).length} teams</span>
              <span>·</span>
              <span>{(p.member_ids || []).length} members</span>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <Badge variant="outline" className="text-[10px] uppercase">{p.status}</Badge>
              <Button variant="ghost" size="sm" onClick={() => navigate(`/projects/${p.id}`)} data-testid={`project-open-${p.id}`}>
                Open <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          </Card>
        ))}
        {projects.length === 0 && (
          <div className="col-span-full text-center py-12 text-muted-foreground text-sm">No projects</div>
        )}
      </div>

      <Card className="overflow-hidden">
        <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={setPageSize} testidPrefix="projects-pagination" />
      </Card>
    </div>
  );
}

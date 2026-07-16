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
import { Plus, Users, Trash2, Pencil, Search } from "lucide-react";
import { toast } from "sonner";
import Pagination from "@/components/Pagination";
import usePaginatedList from "@/hooks/usePaginatedList";

export default function TeamsPage() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", description: "", lead_id: "", member_ids: [], skills: "" });

  const { items: teams, total, page, pageSize, setPage, setPageSize, refresh } = usePaginatedList("/teams", { q });

  useEffect(() => {
    (async () => {
      try { const { data } = await api.get("/users/all"); setUsers(data); } catch {}
    })();
  }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", description: "", lead_id: "", member_ids: [], skills: "" });
    setOpen(true);
  };
  const openEdit = (t) => {
    setEditing(t);
    setForm({
      name: t.name, description: t.description || "",
      lead_id: t.lead_id || "",
      member_ids: t.member_ids || [],
      skills: (t.skills || []).join(", "),
    });
    setOpen(true);
  };
  const save = async () => {
    try {
      const payload = {
        name: form.name, description: form.description,
        lead_id: form.lead_id || null, member_ids: form.member_ids,
        skills: form.skills.split(",").map((s) => s.trim()).filter(Boolean),
      };
      if (editing) { await api.put(`/teams/${editing.id}`, payload); toast.success("Team updated"); }
      else { await api.post("/teams", payload); toast.success("Team created"); }
      setOpen(false); refresh();
    } catch (e) { toast.error(formatApiError(e)); }
  };
  const del = async (t) => {
    if (!window.confirm(`Delete team ${t.name}?`)) return;
    try { await api.delete(`/teams/${t.id}`); toast.success("Deleted"); refresh(); } catch (e) { toast.error(formatApiError(e)); }
  };
  const toggleMember = (id) => setForm((f) => ({ ...f, member_ids: f.member_ids.includes(id) ? f.member_ids.filter((x) => x !== id) : [...f.member_ids, id] }));

  const userName = (id) => users.find((u) => u.id === id)?.name || "—";
  const canCreate = hasPerm(me, "team.create");
  const canUpdate = hasPerm(me, "team.update");
  const canDelete = hasPerm(me, "team.delete");

  return (
    <div className="space-y-6" data-testid="teams-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight">Teams</h1>
          <p className="text-sm text-muted-foreground mt-1">Squads collaborating across projects.</p>
        </div>
        {canCreate && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNew} data-testid="new-team-btn"><Plus className="w-4 h-4 mr-1" /> New Team</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl" data-testid="team-dialog">
              <DialogHeader><DialogTitle>{editing ? "Edit Team" : "Create Team"}</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="team-form-name" /></div>
                <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} data-testid="team-form-description" /></div>
                <div>
                  <Label>Team Lead</Label>
                  <Select value={form.lead_id || "none"} onValueChange={(v) => setForm({ ...form, lead_id: v === "none" ? "" : v })}>
                    <SelectTrigger data-testid="team-form-lead"><SelectValue placeholder="Select lead" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No lead</SelectItem>
                      {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Members</Label>
                  <div className="border border-border rounded-md p-3 max-h-52 overflow-y-auto space-y-1">
                    {users.map((u) => (
                      <label key={u.id} className="flex items-center gap-2 py-1 cursor-pointer text-sm">
                        <input type="checkbox" checked={form.member_ids.includes(u.id)} onChange={() => toggleMember(u.id)} data-testid={`team-form-member-${u.id}`} />
                        <span>{u.name}</span>
                        <span className="text-xs text-muted-foreground">({u.role})</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div><Label>Skills (comma-separated)</Label><Input value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} data-testid="team-form-skills" /></div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={save} data-testid="team-form-save">{editing ? "Save" : "Create"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="relative max-w-sm">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search teams…" className="pl-9" data-testid="teams-search" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {teams.map((t) => (
          <Card key={t.id} className="p-5 hover-lift" data-testid={`team-card-${t.id}`}>
            <div className="flex items-start justify-between mb-3">
              <div className="min-w-0">
                <h3 className="font-heading font-semibold text-lg truncate">{t.name}</h3>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.description || "No description"}</p>
              </div>
              <div className="flex gap-1">
                {canUpdate && <Button variant="ghost" size="icon" onClick={() => openEdit(t)} data-testid={`team-edit-${t.id}`}><Pencil className="w-4 h-4" /></Button>}
                {canDelete && <Button variant="ghost" size="icon" onClick={() => del(t)} data-testid={`team-delete-${t.id}`}><Trash2 className="w-4 h-4" /></Button>}
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
              <Users className="w-3.5 h-3.5" />
              <span>{(t.member_ids || []).length} members</span>
              <span>·</span>
              <span>Lead: {userName(t.lead_id)}</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {(t.skills || []).map((s) => (
                <Badge key={s} variant="outline" className="text-[10px]">{s}</Badge>
              ))}
            </div>
          </Card>
        ))}
        {teams.length === 0 && (
          <div className="col-span-full text-center py-12 text-muted-foreground text-sm">No teams</div>
        )}
      </div>

      <Card className="overflow-hidden">
        <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={setPageSize} testidPrefix="teams-pagination" />
      </Card>
    </div>
  );
}

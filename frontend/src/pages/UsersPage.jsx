import { useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ROLES, ROLE_LABELS, roleBadgeClass, hasPerm } from "@/lib/constants";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, Trash2, Pencil, Search } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import Pagination from "@/components/Pagination";
import usePaginatedList from "@/hooks/usePaginatedList";

export default function UsersPage() {
  const { user: me } = useAuth();
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "DEVELOPER", skills: "" });

  const { items: users, total, page, pageSize, setPage, setPageSize, refresh } =
    usePaginatedList("/users", { q, role: roleFilter === "all" ? "" : roleFilter });

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", email: "", password: "", role: "DEVELOPER", skills: "" });
    setOpen(true);
  };
  const openEdit = (u) => {
    setEditing(u);
    setForm({ name: u.name, email: u.email, password: "", role: u.role, skills: (u.skills || []).join(", ") });
    setOpen(true);
  };
  const save = async () => {
    try {
      const payload = {
        name: form.name, role: form.role,
        skills: form.skills.split(",").map((s) => s.trim()).filter(Boolean),
      };
      if (editing) {
        if (form.password) payload.password = form.password;
        await api.put(`/users/${editing.id}`, payload);
        toast.success("User updated");
      } else {
        payload.email = form.email;
        payload.password = form.password;
        await api.post("/users", payload);
        toast.success("User created");
      }
      setOpen(false);
      refresh();
    } catch (e) { toast.error(formatApiError(e)); }
  };
  const toggleActive = async (u) => {
    try { await api.put(`/users/${u.id}`, { active: !u.active }); refresh(); } catch (e) { toast.error(formatApiError(e)); }
  };
  const del = async (u) => {
    if (!window.confirm(`Delete user ${u.name}?`)) return;
    try { await api.delete(`/users/${u.id}`); toast.success("Deleted"); refresh(); } catch (e) { toast.error(formatApiError(e)); }
  };

  const canCreate = hasPerm(me, "user.create");
  const canUpdate = hasPerm(me, "user.update");
  const canDelete = hasPerm(me, "user.delete");

  return (
    <div className="space-y-6" data-testid="users-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight">User Details</h1>
          <p className="text-sm text-muted-foreground mt-1">Everyone in your engineering org.</p>
        </div>
        {canCreate && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNew} data-testid="new-user-btn"><Plus className="w-4 h-4 mr-1" /> Add User</Button>
            </DialogTrigger>
            <DialogContent data-testid="user-dialog">
              <DialogHeader><DialogTitle>{editing ? "Edit User" : "Create User"}</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="user-form-name" /></div>
                <div><Label>Email</Label><Input value={form.email} disabled={!!editing} onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="user-form-email" /></div>
                <div><Label>{editing ? "New Password (blank = keep)" : "Password"}</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} data-testid="user-form-password" /></div>
                <div>
                  <Label>Role</Label>
                  <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                    <SelectTrigger data-testid="user-form-role"><SelectValue /></SelectTrigger>
                    <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Skills (comma-separated)</Label><Input value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} data-testid="user-form-skills" /></div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={save} data-testid="user-form-save">{editing ? "Save" : "Create"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search for..." className="pl-9" data-testid="users-search" />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-52" data-testid="users-filter-role"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            {ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-hidden" data-testid="users-table">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left">
                <th className="px-4 py-3 font-semibold">S.No</th>
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Role</th>
                <th className="px-4 py-3 font-semibold">Skills</th>
                <th className="px-4 py-3 font-semibold">Active</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u, idx) => (
                <tr key={u.id} className="border-t border-border hover:bg-muted/30" data-testid={`user-row-${u.id}`}>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{(page - 1) * pageSize + idx + 1}</td>
                  <td className="px-4 py-3 font-medium">{u.name}</td>
                  <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{u.email}</td>
                  <td className="px-4 py-3"><Badge variant="outline" className={roleBadgeClass(u.role)}>{ROLE_LABELS[u.role] || u.role}</Badge></td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{(u.skills || []).join(", ") || "—"}</td>
                  <td className="px-4 py-3">
                    <Switch checked={u.active !== false} disabled={!canUpdate} onCheckedChange={() => toggleActive(u)} data-testid={`user-toggle-${u.id}`} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      {canUpdate && <Button variant="ghost" size="icon" onClick={() => openEdit(u)} data-testid={`user-edit-${u.id}`}><Pencil className="w-4 h-4" /></Button>}
                      {canDelete && <Button variant="ghost" size="icon" onClick={() => del(u)} data-testid={`user-delete-${u.id}`}><Trash2 className="w-4 h-4" /></Button>}
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No users</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={setPageSize} testidPrefix="users-pagination" />
      </Card>
    </div>
  );
}

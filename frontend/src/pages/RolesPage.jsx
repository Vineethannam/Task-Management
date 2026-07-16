import { useEffect, useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ROLES, ROLE_LABELS, roleBadgeClass, hasPerm } from "@/lib/constants";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, Save, Shield } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

export default function RolesPage() {
  const { user: me, refresh: refreshMe } = useAuth();
  const [modules, setModules] = useState([]);
  const [roles, setRoles] = useState([]);
  const [selectedRole, setSelectedRole] = useState("ADMIN");
  const [permSet, setPermSet] = useState(new Set());
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [openSections, setOpenSections] = useState({});

  const load = async () => {
    try {
      const [m, r] = await Promise.all([api.get("/meta/modules"), api.get("/roles")]);
      setModules(m.data.modules || []);
      setRoles(r.data || []);
    } catch {}
  };
  useEffect(() => { load(); }, []);

  useEffect(() => {
    const role = roles.find((r) => r.name === selectedRole);
    if (role) {
      setPermSet(new Set(role.permissions || []));
      setDescription(role.description || "");
      const open = {};
      (modules || []).forEach((m) => (open[m.key] = true));
      setOpenSections(open);
    }
  }, [selectedRole, roles, modules]);

  const isWildcard = permSet.has("*");
  const hasP = (mod, act) => isWildcard || permSet.has(`${mod}.${act}`);
  const modulePerms = (mod) => (mod.actions || []).map((a) => `${mod.key}.${a}`);
  const moduleAll = (mod) => {
    const all = modulePerms(mod);
    return all.every((p) => permSet.has(p)) || isWildcard;
  };

  const togglePerm = (mod, act) => {
    if (isWildcard) return;
    const key = `${mod}.${act}`;
    setPermSet((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleModuleAll = (mod, on) => {
    if (isWildcard) return;
    const all = modulePerms(mod);
    setPermSet((s) => {
      const next = new Set(s);
      if (on) all.forEach((k) => next.add(k));
      else all.forEach((k) => next.delete(k));
      return next;
    });
  };

  const toggleWildcard = (on) => {
    setPermSet(on ? new Set(["*"]) : new Set());
  };

  const save = async () => {
    if (!hasPerm(me, "role.update")) { toast.error("You don't have permission to edit roles."); return; }
    setSaving(true);
    try {
      await api.put(`/roles/${selectedRole}`, {
        permissions: Array.from(permSet),
        description,
      });
      toast.success(`${selectedRole} role saved`);
      await load();
      await refreshMe();
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setSaving(false); }
  };

  const canEdit = hasPerm(me, "role.update");
  const roleObj = roles.find((r) => r.name === selectedRole);

  return (
    <div className="space-y-6" data-testid="roles-page">
      <div>
        <h1 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight">Create Role</h1>
        <p className="text-sm text-muted-foreground mt-1">Configure module-level permissions for each role.</p>
      </div>

      <Card className="p-5" data-testid="role-editor">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="role-name" className="text-xs uppercase tracking-widest font-semibold">Role Name*</Label>
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger className="mt-2" data-testid="role-select"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="mt-2 flex items-center gap-2">
              <Badge variant="outline" className={roleBadgeClass(selectedRole)}>{selectedRole}</Badge>
              {roleObj?.system && <Badge variant="outline" className="text-[10px]">System</Badge>}
              {isWildcard && <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-800 border-purple-200">Full access</Badge>}
            </div>
          </div>
          <div>
            <Label htmlFor="role-description" className="text-xs uppercase tracking-widest font-semibold">Role Description*</Label>
            <Input id="role-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Enter Role Description" className="mt-2" data-testid="role-description" disabled={!canEdit} />
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden" data-testid="permissions-matrix">
        <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30">
          <div className="flex items-center gap-3">
            <Shield className="w-4 h-4" />
            <span className="font-semibold">Permissions</span>
          </div>
          {selectedRole === "SUPER_ADMIN" && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Grant full access</span>
              <Switch checked={isWildcard} onCheckedChange={toggleWildcard} disabled={!canEdit || me?.role !== "SUPER_ADMIN"} data-testid="perm-wildcard" />
            </div>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left">
                <th className="px-4 py-3 font-semibold w-1/3">Name</th>
                <th className="px-3 py-3 font-semibold text-center">All</th>
                <th className="px-3 py-3 font-semibold text-center">Create</th>
                <th className="px-3 py-3 font-semibold text-center">Read</th>
                <th className="px-3 py-3 font-semibold text-center">Update</th>
                <th className="px-3 py-3 font-semibold text-center">Delete</th>
              </tr>
            </thead>
            <tbody>
              {modules.map((mod) => (
                <>
                  <tr key={mod.key} className="border-t border-border bg-muted/10">
                    <td className="px-4 py-3">
                      <Collapsible open={openSections[mod.key]} onOpenChange={(v) => setOpenSections((s) => ({ ...s, [mod.key]: v }))}>
                        <CollapsibleTrigger className="flex items-center gap-2 font-semibold" data-testid={`module-${mod.key}-toggle`}>
                          <ChevronDown className={`w-4 h-4 transition-transform ${openSections[mod.key] ? "" : "-rotate-90"}`} />
                          {mod.label}
                        </CollapsibleTrigger>
                      </Collapsible>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <Switch checked={moduleAll(mod)} onCheckedChange={(v) => toggleModuleAll(mod, v)} disabled={!canEdit || isWildcard} data-testid={`perm-${mod.key}-all`} />
                    </td>
                    {["create", "read", "update", "delete"].map((act) => (
                      <td key={act} className="px-3 py-3 text-center">
                        {mod.actions.includes(act) ? (
                          <Switch checked={hasP(mod.key, act)} onCheckedChange={() => togglePerm(mod.key, act)} disabled={!canEdit || isWildcard} data-testid={`perm-${mod.key}-${act}`} />
                        ) : (
                          <span className="text-muted-foreground text-xs">NA</span>
                        )}
                      </td>
                    ))}
                  </tr>
                  {openSections[mod.key] && mod.actions.length > 4 && (
                    <tr className="border-t border-border">
                      <td className="px-4 py-2 pl-10 text-muted-foreground text-xs">Extra actions</td>
                      <td colSpan={5}>
                        <div className="flex flex-wrap gap-3 py-1">
                          {mod.actions.filter((a) => !["create", "read", "update", "delete"].includes(a)).map((a) => (
                            <label key={a} className="flex items-center gap-2 text-xs">
                              <Switch checked={hasP(mod.key, a)} onCheckedChange={() => togglePerm(mod.key, a)} disabled={!canEdit || isWildcard} data-testid={`perm-${mod.key}-${a}`} />
                              <span className="capitalize">{a}</span>
                            </label>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={load} disabled={saving}>Reset</Button>
        <Button onClick={save} disabled={saving || !canEdit} data-testid="role-save-btn">
          <Save className="w-4 h-4 mr-1" /> {saving ? "Saving…" : "Save Permissions"}
        </Button>
      </div>
    </div>
  );
}

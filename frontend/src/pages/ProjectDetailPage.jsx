import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, FolderKanban, Users, ListChecks, Bug, BarChart3 } from "lucide-react";
import KanbanBoard from "@/components/KanbanBoard";
import BugList from "@/components/BugList";
import ProjectReport from "@/components/ProjectReport";
import { TASK_STATUS_LABELS, statusBadgeClass, roleBadgeClass, ROLE_LABELS } from "@/lib/constants";

export default function ProjectDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);

  const load = async () => {
    try {
      const [p, u, t] = await Promise.all([
        api.get(`/projects/${id}`),
        api.get("/users/all"),
        api.get("/teams/all"),
      ]);
      setProject(p.data); setUsers(u.data); setTeams(t.data);
    } catch {}
  };

  useEffect(() => { load(); }, [id]);

  if (!project) return <div className="text-sm text-muted-foreground" data-testid="project-loading">Loading…</div>;

  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));
  const teamMap = Object.fromEntries(teams.map((t) => [t.id, t]));
  const members = (project.member_ids || []).map((mid) => userMap[mid]).filter(Boolean);
  const projectTeams = (project.team_ids || []).map((tid) => teamMap[tid]).filter(Boolean);

  return (
    <div className="space-y-6" data-testid="project-detail-page">
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate("/projects")} className="mb-3" data-testid="back-to-projects">
          <ArrowLeft className="w-4 h-4 mr-1" /> All Projects
        </Button>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <FolderKanban className="w-5 h-5 text-primary" />
              <h1 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight">{project.name}</h1>
            </div>
            <p className="text-sm text-muted-foreground max-w-2xl">{project.description}</p>
          </div>
          <Badge variant="outline" className="uppercase text-xs">{project.status}</Badge>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList data-testid="project-tabs">
          <TabsTrigger value="overview" data-testid="project-tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="tasks" data-testid="project-tab-tasks"><ListChecks className="w-3.5 h-3.5 mr-1" /> Tasks</TabsTrigger>
          <TabsTrigger value="bugs" data-testid="project-tab-bugs"><Bug className="w-3.5 h-3.5 mr-1" /> Bugs</TabsTrigger>
          <TabsTrigger value="members" data-testid="project-tab-members"><Users className="w-3.5 h-3.5 mr-1" /> Members</TabsTrigger>
          <TabsTrigger value="reports" data-testid="project-tab-reports"><BarChart3 className="w-3.5 h-3.5 mr-1" /> Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-5">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Team Lead</div>
              <div className="font-heading font-semibold mt-2">{userMap[project.team_lead_id]?.name || "—"}</div>
            </Card>
            <Card className="p-5">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Timeline</div>
              <div className="text-sm mt-2 font-mono">
                {project.start_date || "—"} → {project.end_date || "—"}
              </div>
            </Card>
            <Card className="p-5">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Teams</div>
              <div className="flex flex-wrap gap-1 mt-2">
                {projectTeams.map((t) => <Badge key={t.id} variant="outline">{t.name}</Badge>)}
                {projectTeams.length === 0 && <span className="text-sm text-muted-foreground">No teams</span>}
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="tasks">
          <KanbanBoard projectId={project.id} users={users} teams={teams} />
        </TabsContent>

        <TabsContent value="bugs">
          <BugList projectId={project.id} users={users} />
        </TabsContent>

        <TabsContent value="members">
          <Card className="p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {members.map((m) => (
                <div key={m.id} className="flex items-center gap-3 p-3 border border-border rounded-md" data-testid={`project-member-${m.id}`}>
                  <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-xs">
                    {m.name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{m.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{m.email}</div>
                  </div>
                  <Badge variant="outline" className={roleBadgeClass(m.role)}>{ROLE_LABELS[m.role]}</Badge>
                </div>
              ))}
              {members.length === 0 && <div className="col-span-full text-sm text-muted-foreground">No members yet</div>}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="reports">
          <ProjectReport projectId={project.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

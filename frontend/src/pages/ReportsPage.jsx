import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend,
} from "recharts";
import { TASK_STATUS_LABELS } from "@/lib/constants";

const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

export default function ReportsPage() {
  const [global, setGlobal] = useState(null);
  const [dash, setDash] = useState(null);
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedTeam, setSelectedTeam] = useState("");
  const [selectedProject, setSelectedProject] = useState("");
  const [userReport, setUserReport] = useState(null);
  const [teamReport, setTeamReport] = useState(null);
  const [projectReport, setProjectReport] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [g, d, u, t, p] = await Promise.all([
          api.get("/reports/tasks-global"),
          api.get("/reports/dashboard"),
          api.get("/users/all"),
          api.get("/teams/all"),
          api.get("/projects/all"),
        ]);
        setGlobal(g.data); setDash(d.data);
        setUsers(u.data); setTeams(t.data); setProjects(p.data);
        if (u.data[0]) setSelectedUser(u.data[0].id);
        if (t.data[0]) setSelectedTeam(t.data[0].id);
        if (p.data[0]) setSelectedProject(p.data[0].id);
      } catch {}
    })();
  }, []);

  useEffect(() => { if (selectedUser) api.get(`/reports/user/${selectedUser}`).then(r => setUserReport(r.data)).catch(() => {}); }, [selectedUser]);
  useEffect(() => { if (selectedTeam) api.get(`/reports/team/${selectedTeam}`).then(r => setTeamReport(r.data)).catch(() => {}); }, [selectedTeam]);
  useEffect(() => { if (selectedProject) api.get(`/reports/project/${selectedProject}`).then(r => setProjectReport(r.data)).catch(() => {}); }, [selectedProject]);

  const globalData = global ? Object.entries(global).map(([k, v]) => ({ name: TASK_STATUS_LABELS[k] || k, value: v })) : [];
  const pieData = dash ? Object.entries(dash.tasks_by_priority).map(([k, v]) => ({ name: k, value: v })) : [];

  return (
    <div className="space-y-6" data-testid="reports-page">
      <div>
        <h1 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight">Reports</h1>
        <p className="text-sm text-muted-foreground mt-1">Slice performance by user, team, project, or globally.</p>
      </div>

      <Tabs defaultValue="global" className="space-y-4">
        <TabsList>
          <TabsTrigger value="global" data-testid="reports-tab-global">Global</TabsTrigger>
          <TabsTrigger value="user" data-testid="reports-tab-user">User</TabsTrigger>
          <TabsTrigger value="team" data-testid="reports-tab-team">Team</TabsTrigger>
          <TabsTrigger value="project" data-testid="reports-tab-project">Project</TabsTrigger>
        </TabsList>

        <TabsContent value="global" className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="p-5">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">Global Task State</div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={globalData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6 }} />
                <Bar dataKey="value" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
          <Card className="p-5">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">Tasks by Priority</div>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" outerRadius={90} innerRadius={45} paddingAngle={2} dataKey="value">
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </TabsContent>

        <TabsContent value="user" className="space-y-4">
          <Select value={selectedUser} onValueChange={setSelectedUser}>
            <SelectTrigger className="w-72" data-testid="report-user-select"><SelectValue placeholder="Select user" /></SelectTrigger>
            <SelectContent>{users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
          </Select>
          {userReport && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="p-5">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">Tasks by Status</div>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={Object.entries(userReport.tasks_by_status).map(([k, v]) => ({ name: TASK_STATUS_LABELS[k] || k, value: v }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6 }} />
                    <Bar dataKey="value" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
              <Card className="p-5">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">Summary</div>
                <div className="space-y-2">
                  <div className="flex justify-between"><span className="text-sm">Total tasks</span><span className="font-heading font-semibold">{userReport.total_tasks}</span></div>
                  <div className="flex justify-between"><span className="text-sm">Total minutes</span><span className="font-heading font-semibold">{Math.round(userReport.total_minutes || 0)}</span></div>
                </div>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="team" className="space-y-4">
          <Select value={selectedTeam} onValueChange={setSelectedTeam}>
            <SelectTrigger className="w-72" data-testid="report-team-select"><SelectValue /></SelectTrigger>
            <SelectContent>{teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
          </Select>
          {teamReport && (
            <Card className="p-5">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">Tasks by Status · {teamReport.total_tasks} total</div>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={Object.entries(teamReport.tasks_by_status).map(([k, v]) => ({ name: TASK_STATUS_LABELS[k] || k, value: v }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6 }} />
                  <Bar dataKey="value" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="project" className="space-y-4">
          <Select value={selectedProject} onValueChange={setSelectedProject}>
            <SelectTrigger className="w-72" data-testid="report-project-select"><SelectValue /></SelectTrigger>
            <SelectContent>{projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
          </Select>
          {projectReport && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="p-5">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">Tasks by Status</div>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={Object.entries(projectReport.tasks_by_status).map(([k, v]) => ({ name: TASK_STATUS_LABELS[k] || k, value: v }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6 }} />
                    <Bar dataKey="value" fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
              <Card className="p-5">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">Bugs by Status · {projectReport.total_bugs} total</div>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={Object.entries(projectReport.bugs_by_status).map(([k, v]) => ({ name: k, value: v }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6 }} />
                    <Bar dataKey="value" fill="hsl(var(--chart-5))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

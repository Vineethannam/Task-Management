import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FolderKanban, Users, UsersRound, ListChecks, Bug, TrendingUp } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, CartesianGrid, Legend,
} from "recharts";
import { TASK_STATUS_LABELS, statusBadgeClass } from "@/lib/constants";
import { useNavigate } from "react-router-dom";

const CHART_COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

function StatCard({ label, value, icon: Icon, hint, testid }) {
  return (
    <Card className="p-5 hover-lift" data-testid={testid}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">{label}</div>
          <div className="font-heading text-3xl font-bold mt-2">{value}</div>
          {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
        </div>
        <div className="w-10 h-10 rounded-md bg-primary/10 text-primary flex items-center justify-center">
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </Card>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [recentTasks, setRecentTasks] = useState([]);
  const [recentBugs, setRecentBugs] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        const [s, t, b] = await Promise.all([
          api.get("/reports/dashboard"),
          api.get("/tasks?page=1&page_size=6"),
          api.get("/bugs?page=1&page_size=5"),
        ]);
        setStats(s.data);
        setRecentTasks(t.data.items || []);
        setRecentBugs(b.data.items || []);
      } catch {}
    })();
  }, []);

  if (!stats) return <div className="text-sm text-muted-foreground" data-testid="dashboard-loading">Loading…</div>;

  const taskChartData = Object.entries(stats.tasks_by_status).map(([status, count]) => ({
    name: TASK_STATUS_LABELS[status] || status, value: count, status,
  }));
  const bugPieData = Object.entries(stats.bugs_by_severity).map(([sev, count]) => ({ name: sev, value: count }));

  return (
    <div className="space-y-6" data-testid="dashboard-page">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">A pulse-check of your engineering org.</p>
        </div>
        <div className="text-xs font-mono text-muted-foreground hidden sm:block">
          {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard label="Projects" value={stats.totals.projects} icon={FolderKanban} testid="stat-projects" />
        <StatCard label="Tasks" value={stats.totals.tasks} icon={ListChecks} testid="stat-tasks" />
        <StatCard label="Bugs" value={stats.totals.bugs} icon={Bug} testid="stat-bugs" />
        <StatCard label="Teams" value={stats.totals.teams} icon={UsersRound} testid="stat-teams" />
        <StatCard label="Users" value={stats.totals.users} icon={Users} testid="stat-users" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5 lg:col-span-2" data-testid="task-status-chart">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Tasks by Status</div>
              <h3 className="font-heading font-semibold text-lg mt-1">Delivery Pipeline</h3>
            </div>
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={taskChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6 }} />
              <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5" data-testid="bug-severity-chart">
          <div className="mb-4">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Bugs by Severity</div>
            <h3 className="font-heading font-semibold text-lg mt-1">Quality Risk</h3>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={bugPieData} cx="50%" cy="50%" innerRadius={40} outerRadius={80} paddingAngle={2} dataKey="value">
                {bugPieData.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5" data-testid="recent-tasks-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading font-semibold text-lg">Recent Tasks</h3>
            <button onClick={() => navigate("/tasks")} className="text-xs text-primary hover:underline" data-testid="view-all-tasks">
              View all →
            </button>
          </div>
          <div className="space-y-2">
            {recentTasks.map((t) => (
              <div key={t.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{t.title}</div>
                  <div className="text-xs text-muted-foreground font-mono">#{t.id.slice(-6)}</div>
                </div>
                <Badge variant="outline" className={statusBadgeClass(t.status)}>
                  {TASK_STATUS_LABELS[t.status]}
                </Badge>
              </div>
            ))}
            {recentTasks.length === 0 && <div className="text-sm text-muted-foreground">No tasks yet</div>}
          </div>
        </Card>

        <Card className="p-5" data-testid="recent-bugs-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading font-semibold text-lg">Recent Bugs</h3>
            <button onClick={() => navigate("/bugs")} className="text-xs text-primary hover:underline" data-testid="view-all-bugs">
              View all →
            </button>
          </div>
          <div className="space-y-2">
            {recentBugs.map((b) => (
              <div key={b.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{b.title}</div>
                  <div className="text-xs text-muted-foreground font-mono">#{b.id.slice(-6)}</div>
                </div>
                <div className="flex gap-1">
                  <Badge variant="outline" className={statusBadgeClass(b.status)}>{b.status}</Badge>
                </div>
              </div>
            ))}
            {recentBugs.length === 0 && <div className="text-sm text-muted-foreground">No bugs yet</div>}
          </div>
        </Card>
      </div>
    </div>
  );
}

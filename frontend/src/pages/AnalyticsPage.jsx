import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend, BarChart, Bar,
} from "recharts";
import { Bug, AlertCircle, RotateCcw, AlertTriangle } from "lucide-react";

function KPI({ label, value, icon: Icon, tone = "primary", testid }) {
  const toneClass = {
    primary: "bg-primary/10 text-primary",
    amber: "bg-amber-100 text-amber-800",
    rose: "bg-rose-100 text-rose-800",
    emerald: "bg-emerald-100 text-emerald-800",
  }[tone];
  return (
    <Card className="p-5 hover-lift" data-testid={testid}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">{label}</div>
          <div className="font-heading text-3xl font-bold mt-2">{value}</div>
        </div>
        <div className={`w-10 h-10 rounded-md flex items-center justify-center ${toneClass}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </Card>
  );
}

export default function AnalyticsPage() {
  const [summary, setSummary] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [days, setDays] = useState("30");
  const [dimension, setDimension] = useState("user");
  const [topBugs, setTopBugs] = useState([]);
  const [delays, setDelays] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [s, d] = await Promise.all([api.get("/analytics/bugs/summary"), api.get("/analytics/delays")]);
        setSummary(s.data); setDelays(d.data);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try { const { data } = await api.get(`/analytics/bugs/timeline?days=${days}`); setTimeline(data.series || []); } catch {}
    })();
  }, [days]);

  useEffect(() => {
    (async () => {
      try { const { data } = await api.get(`/analytics/bugs/top?dimension=${dimension}&limit=10`); setTopBugs(data); } catch {}
    })();
  }, [dimension]);

  return (
    <div className="space-y-6" data-testid="analytics-page">
      <div>
        <h1 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground mt-1">Where bugs are born, and who is slowing things down.</p>
      </div>

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <KPI label="Total Bugs" value={summary.total} icon={Bug} testid="kpi-total-bugs" />
          <KPI label="Open" value={summary.open} icon={AlertCircle} tone="amber" testid="kpi-open-bugs" />
          <KPI label="Resolved" value={summary.resolved} icon={AlertCircle} tone="emerald" testid="kpi-resolved-bugs" />
          <KPI label="Reopened Now" value={summary.reopened_now} icon={RotateCcw} tone="rose" testid="kpi-reopened-bugs" />
          <KPI label="Total Reopens" value={summary.total_reopens} icon={RotateCcw} tone="rose" testid="kpi-total-reopens" />
        </div>
      )}

      <Card className="p-5" data-testid="bug-timeline-card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Bug Trends</div>
            <h3 className="font-heading font-semibold text-lg mt-1">Bugs Created vs Resolved</h3>
          </div>
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="w-36" data-testid="analytics-days-select"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="14">Last 14 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="60">Last 60 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={timeline}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} stroke="hsl(var(--muted-foreground))" />
            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="created" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} name="Created" />
            <Line type="monotone" dataKey="resolved" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} name="Resolved" />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      <Card className="p-5" data-testid="bug-top-card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Bug Concentration</div>
            <h3 className="font-heading font-semibold text-lg mt-1">Where bugs pile up</h3>
          </div>
          <Tabs value={dimension} onValueChange={setDimension}>
            <TabsList>
              <TabsTrigger value="user" data-testid="analytics-dim-user">User</TabsTrigger>
              <TabsTrigger value="team" data-testid="analytics-dim-team">Team</TabsTrigger>
              <TabsTrigger value="project" data-testid="analytics-dim-project">Project</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <ResponsiveContainer width="100%" height={Math.max(200, topBugs.length * 34)}>
          <BarChart data={topBugs} layout="vertical" margin={{ left: 12, right: 24 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis type="number" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={130} stroke="hsl(var(--muted-foreground))" />
            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="open" fill="hsl(var(--chart-4))" name="Open" stackId="a" />
            <Bar dataKey="critical" fill="hsl(var(--chart-2))" name="Critical" stackId="b" />
            <Bar dataKey="count" fill="hsl(var(--chart-1))" name="Total" stackId="c" />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {delays && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="p-5" data-testid="delay-users">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-primary" />
              <h3 className="font-heading font-semibold text-lg">Users Causing Deadline Slips</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="text-left">
                    <th className="px-3 py-2 font-semibold">User</th>
                    <th className="px-3 py-2 font-semibold text-right">Deadline Δ</th>
                    <th className="px-3 py-2 font-semibold text-right">Reassigns</th>
                    <th className="px-3 py-2 font-semibold text-right">Tasks</th>
                  </tr>
                </thead>
                <tbody>
                  {delays.users.map((u) => (
                    <tr key={u.id} className="border-t border-border">
                      <td className="px-3 py-2">{u.name}</td>
                      <td className="px-3 py-2 text-right font-mono">{u.deadline_changes}</td>
                      <td className="px-3 py-2 text-right font-mono">{u.reassigns}</td>
                      <td className="px-3 py-2 text-right font-mono">{u.tasks}</td>
                    </tr>
                  ))}
                  {delays.users.length === 0 && <tr><td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">No delays recorded</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>
          <Card className="p-5" data-testid="delay-teams">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-primary" />
              <h3 className="font-heading font-semibold text-lg">Teams Causing Deadline Slips</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="text-left">
                    <th className="px-3 py-2 font-semibold">Team</th>
                    <th className="px-3 py-2 font-semibold text-right">Deadline Δ</th>
                    <th className="px-3 py-2 font-semibold text-right">Reassigns</th>
                    <th className="px-3 py-2 font-semibold text-right">Tasks</th>
                  </tr>
                </thead>
                <tbody>
                  {delays.teams.map((t) => (
                    <tr key={t.id} className="border-t border-border">
                      <td className="px-3 py-2">{t.name}</td>
                      <td className="px-3 py-2 text-right font-mono">{t.deadline_changes}</td>
                      <td className="px-3 py-2 text-right font-mono">{t.reassigns}</td>
                      <td className="px-3 py-2 text-right font-mono">{t.tasks}</td>
                    </tr>
                  ))}
                  {delays.teams.length === 0 && <tr><td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">No delays recorded</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

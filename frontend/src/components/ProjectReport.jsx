import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { TASK_STATUS_LABELS } from "@/lib/constants";

export default function ProjectReport({ projectId }) {
  const [report, setReport] = useState(null);
  useEffect(() => {
    (async () => {
      try { const { data } = await api.get(`/reports/project/${projectId}`); setReport(data); } catch {}
    })();
  }, [projectId]);
  if (!report) return <div className="text-sm text-muted-foreground">Loading report…</div>;

  const taskData = Object.entries(report.tasks_by_status).map(([k, v]) => ({ name: TASK_STATUS_LABELS[k] || k, value: v }));
  const bugData = Object.entries(report.bugs_by_status).map(([k, v]) => ({ name: k, value: v }));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="project-report">
      <Card className="p-5">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Tasks · {report.total_tasks} total</div>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={taskData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6 }} />
            <Bar dataKey="value" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
      <Card className="p-5">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Bugs · {report.total_bugs} total</div>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={bugData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6 }} />
            <Bar dataKey="value" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}

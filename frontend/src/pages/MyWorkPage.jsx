import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TASK_STATUS_LABELS, statusBadgeClass, priorityBadgeClass } from "@/lib/constants";
import { useNavigate } from "react-router-dom";
import Pagination from "@/components/Pagination";
import usePaginatedList from "@/hooks/usePaginatedList";
import { ListChecks, FolderKanban, Bug } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function MyWorkPage() {
  const { user: me } = useAuth();
  const navigate = useNavigate();

  const tasks = usePaginatedList("/me/tasks", {});
  const projects = usePaginatedList("/me/projects", {});
  const bugs = usePaginatedList("/me/bugs", {});

  return (
    <div className="space-y-6" data-testid="my-work-page">
      <div>
        <h1 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight">My Work</h1>
        <p className="text-sm text-muted-foreground mt-1">Everything assigned to <span className="font-semibold text-foreground">{me?.name}</span>.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5" data-testid="my-tasks-count">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">My Tasks</div>
              <div className="font-heading text-3xl font-bold mt-2">{tasks.total}</div>
            </div>
            <ListChecks className="w-6 h-6 text-primary" />
          </div>
        </Card>
        <Card className="p-5" data-testid="my-projects-count">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">My Projects</div>
              <div className="font-heading text-3xl font-bold mt-2">{projects.total}</div>
            </div>
            <FolderKanban className="w-6 h-6 text-primary" />
          </div>
        </Card>
        <Card className="p-5" data-testid="my-bugs-count">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">My Bugs</div>
              <div className="font-heading text-3xl font-bold mt-2">{bugs.total}</div>
            </div>
            <Bug className="w-6 h-6 text-primary" />
          </div>
        </Card>
      </div>

      <Tabs defaultValue="tasks" className="space-y-4">
        <TabsList>
          <TabsTrigger value="tasks" data-testid="mywork-tab-tasks">Tasks</TabsTrigger>
          <TabsTrigger value="projects" data-testid="mywork-tab-projects">Projects</TabsTrigger>
          <TabsTrigger value="bugs" data-testid="mywork-tab-bugs">Bugs</TabsTrigger>
        </TabsList>

        <TabsContent value="tasks">
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="text-left">
                    <th className="px-4 py-3 font-semibold">S.No</th>
                    <th className="px-4 py-3 font-semibold">Title</th>
                    <th className="px-4 py-3 font-semibold">Priority</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Est (h)</th>
                    <th className="px-4 py-3 font-semibold">Deadline Δ</th>
                    <th className="px-4 py-3 font-semibold">Due</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.items.map((t, i) => (
                    <tr key={t.id} className="border-t border-border cursor-pointer hover:bg-muted/30" onClick={() => navigate(`/projects/${t.project_id}`)} data-testid={`my-task-row-${t.id}`}>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{(tasks.page - 1) * tasks.pageSize + i + 1}</td>
                      <td className="px-4 py-3 font-medium">{t.title}</td>
                      <td className="px-4 py-3"><Badge variant="outline" className={priorityBadgeClass(t.priority)}>{t.priority}</Badge></td>
                      <td className="px-4 py-3"><Badge variant="outline" className={statusBadgeClass(t.status)}>{TASK_STATUS_LABELS[t.status]}</Badge></td>
                      <td className="px-4 py-3 font-mono">{t.estimated_hours ?? "—"}</td>
                      <td className="px-4 py-3 font-mono">{t.deadline_changes || 0}</td>
                      <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{t.due_date || "—"}</td>
                    </tr>
                  ))}
                  {tasks.items.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Nothing assigned yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pagination page={tasks.page} pageSize={tasks.pageSize} total={tasks.total} onPageChange={tasks.setPage} onPageSizeChange={tasks.setPageSize} testidPrefix="my-tasks-pagination" />
          </Card>
        </TabsContent>

        <TabsContent value="projects">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.items.map((p) => (
              <Card key={p.id} className="p-5 hover-lift cursor-pointer" onClick={() => navigate(`/projects/${p.id}`)} data-testid={`my-project-${p.id}`}>
                <div className="flex items-start justify-between">
                  <FolderKanban className="w-5 h-5 text-primary" />
                  <Badge variant="outline" className="text-[10px] uppercase">{p.status}</Badge>
                </div>
                <h3 className="font-heading font-semibold text-lg mt-3">{p.name}</h3>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.description}</p>
              </Card>
            ))}
            {projects.items.length === 0 && (
              <div className="col-span-full text-center py-12 text-muted-foreground text-sm">No projects yet</div>
            )}
          </div>
          {projects.total > 0 && (
            <Card className="overflow-hidden mt-4">
              <Pagination page={projects.page} pageSize={projects.pageSize} total={projects.total} onPageChange={projects.setPage} onPageSizeChange={projects.setPageSize} testidPrefix="my-projects-pagination" />
            </Card>
          )}
        </TabsContent>

        <TabsContent value="bugs">
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="text-left">
                    <th className="px-4 py-3 font-semibold">S.No</th>
                    <th className="px-4 py-3 font-semibold">Title</th>
                    <th className="px-4 py-3 font-semibold">Severity</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Reopens</th>
                    <th className="px-4 py-3 font-semibold">Est (h)</th>
                  </tr>
                </thead>
                <tbody>
                  {bugs.items.map((b, i) => (
                    <tr key={b.id} className="border-t border-border cursor-pointer hover:bg-muted/30" onClick={() => navigate(`/projects/${b.project_id}`)} data-testid={`my-bug-row-${b.id}`}>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{(bugs.page - 1) * bugs.pageSize + i + 1}</td>
                      <td className="px-4 py-3 font-medium">{b.title}</td>
                      <td className="px-4 py-3"><Badge variant="outline" className={priorityBadgeClass(b.severity)}>{b.severity}</Badge></td>
                      <td className="px-4 py-3"><Badge variant="outline" className={statusBadgeClass(b.status)}>{b.status}</Badge></td>
                      <td className="px-4 py-3 font-mono">{b.reopen_count || 0}</td>
                      <td className="px-4 py-3 font-mono">{b.estimated_hours ?? "—"}</td>
                    </tr>
                  ))}
                  {bugs.items.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No bugs assigned</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pagination page={bugs.page} pageSize={bugs.pageSize} total={bugs.total} onPageChange={bugs.setPage} onPageSizeChange={bugs.setPageSize} testidPrefix="my-bugs-pagination" />
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

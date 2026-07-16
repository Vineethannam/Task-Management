import { NavLink } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { hasPerm } from "@/lib/constants";
import {
  LayoutDashboard,
  Users,
  UsersRound,
  FolderKanban,
  ListChecks,
  Bug,
  BarChart3,
  Clock,
  Shield,
  Briefcase,
  LineChart,
} from "lucide-react";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, testid: "sidebar-nav-dashboard" },
  { to: "/my-work", label: "My Work", icon: Briefcase, testid: "sidebar-nav-my-work" },
  { to: "/tasks", label: "Tasks", icon: ListChecks, perm: "task.read", testid: "sidebar-nav-tasks" },
  { to: "/projects", label: "Projects", icon: FolderKanban, perm: "project.read", testid: "sidebar-nav-projects" },
  { to: "/teams", label: "Teams", icon: UsersRound, perm: "team.read", testid: "sidebar-nav-teams" },
  { to: "/bugs", label: "Bugs", icon: Bug, perm: "bug.read", testid: "sidebar-nav-bugs" },
  { to: "/timelogs", label: "Time Logs", icon: Clock, perm: "timelog.read", testid: "sidebar-nav-timelogs" },
  { to: "/reports", label: "Reports", icon: BarChart3, perm: "report.read", testid: "sidebar-nav-reports" },
  { to: "/analytics", label: "Analytics", icon: LineChart, perm: "analytics.read", testid: "sidebar-nav-analytics" },
  { to: "/users", label: "Users", icon: Users, perm: "user.read", testid: "sidebar-nav-users" },
  { to: "/roles", label: "Roles", icon: Shield, perm: "role.read", testid: "sidebar-nav-roles" },
];

export default function Sidebar() {
  const { user } = useAuth();
  return (
    <aside
      className="hidden md:flex flex-col w-64 bg-card border-r border-border h-screen sticky top-0"
      data-testid="sidebar"
    >
      <div className="h-16 flex items-center gap-3 px-5 border-b border-border">
        <div className="w-8 h-8 rounded-md bg-primary text-primary-foreground flex items-center justify-center font-heading font-bold text-sm">
          S
        </div>
        <div className="flex flex-col leading-tight">
          <span className="font-heading font-bold text-base">SEMS</span>
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Engineering Ops</span>
        </div>
      </div>
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {NAV.filter((n) => !n.perm || hasPerm(user, n.perm)).map((n) => {
          const Icon = n.icon;
          return (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === "/"}
              data-testid={n.testid}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`
              }
            >
              <Icon className="w-4 h-4" />
              {n.label}
            </NavLink>
          );
        })}
      </nav>
      <div className="p-4 border-t border-border">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Signed in</div>
        <div className="text-sm font-medium truncate">{user?.name}</div>
        <div className="text-xs text-muted-foreground truncate">{user?.email}</div>
      </div>
    </aside>
  );
}

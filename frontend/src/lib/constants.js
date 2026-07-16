export const ROLES = ["SUPER_ADMIN", "ADMIN", "PROJECT_MANAGER", "TEAM_LEAD", "DEVELOPER", "TESTER", "VIEWER"];

export const ROLE_LABELS = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  PROJECT_MANAGER: "Project Manager",
  TEAM_LEAD: "Team Lead",
  DEVELOPER: "Developer",
  TESTER: "Tester",
  VIEWER: "Viewer",
};

export const TASK_STATUSES = ["BACKLOG", "IN_PROGRESS", "IN_REVIEW", "COMPLETED", "REASSIGNED"];
export const TASK_STATUS_LABELS = {
  BACKLOG: "Backlog",
  IN_PROGRESS: "In Progress",
  IN_REVIEW: "In Review",
  COMPLETED: "Completed",
  REASSIGNED: "Reassigned",
};

export const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];

export const BUG_STATUSES = ["OPEN", "IN_PROGRESS", "IN_REVIEW", "RESOLVED", "REOPENED", "CLOSED"];
export const BUG_SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

export const THEMES = [
  { id: "light-ocean", name: "Ocean", swatch: "#2563eb" },
  { id: "light-earth", name: "Earth", swatch: "#166534" },
  { id: "light-peach", name: "Peach", swatch: "#e04a2b" },
  { id: "light-brutal", name: "Brutal", swatch: "#000000" },
];

export function statusBadgeClass(status) {
  switch (status) {
    case "COMPLETED":
    case "RESOLVED":
    case "CLOSED":
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "IN_PROGRESS":
      return "bg-amber-100 text-amber-800 border-amber-200";
    case "IN_REVIEW":
      return "bg-sky-100 text-sky-800 border-sky-200";
    case "BACKLOG":
    case "OPEN":
      return "bg-slate-100 text-slate-800 border-slate-200";
    case "REASSIGNED":
    case "REOPENED":
      return "bg-purple-100 text-purple-800 border-purple-200";
    default:
      return "bg-slate-100 text-slate-800 border-slate-200";
  }
}

export function priorityBadgeClass(priority) {
  switch (priority) {
    case "URGENT":
    case "CRITICAL":
      return "bg-rose-100 text-rose-800 border-rose-200";
    case "HIGH":
      return "bg-orange-100 text-orange-800 border-orange-200";
    case "MEDIUM":
      return "bg-sky-100 text-sky-800 border-sky-200";
    case "LOW":
      return "bg-slate-100 text-slate-800 border-slate-200";
    default:
      return "bg-slate-100 text-slate-800 border-slate-200";
  }
}

export function roleBadgeClass(role) {
  switch (role) {
    case "SUPER_ADMIN":
      return "bg-purple-100 text-purple-800 border-purple-200";
    case "ADMIN":
      return "bg-indigo-100 text-indigo-800 border-indigo-200";
    case "PROJECT_MANAGER":
      return "bg-sky-100 text-sky-800 border-sky-200";
    case "TEAM_LEAD":
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "DEVELOPER":
      return "bg-amber-100 text-amber-800 border-amber-200";
    case "TESTER":
      return "bg-rose-100 text-rose-800 border-rose-200";
    case "VIEWER":
    default:
      return "bg-slate-100 text-slate-800 border-slate-200";
  }
}

export function hasPerm(user, perm) {
  if (!user || !user.permissions) return false;
  if (user.permissions.includes("*")) return true;
  return user.permissions.includes(perm);
}

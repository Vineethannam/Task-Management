# SEMS — Software Engineering Management System

## Original Problem
Build SEMS: a centralized enterprise platform managing the full software development lifecycle (users, roles, teams, projects, tasks with lifecycle, bugs, time logs, reports, real-time notifications). Replaces Jira/Trello/Clockify/Excel. Roles: Super Admin → Admin → PM → Team Lead → Developer → Tester → Viewer.

## User Choices
- Auth: **JWT-based custom auth** (email + password, admin creates users)
- Scope: Full stack incl. Bugs, Time Logs, WebSocket real-time, Reports
- Seed data: Yes — Super Admin + demo users per role, sample projects/teams/tasks
- Theme: **Light-only with palette switcher** (Ocean, Earth, Peach, Brutal)

## Tech Stack
- Backend: FastAPI (Python) + MongoDB (Motor async)
- Frontend: React 19 + React Router 7 + Tailwind + shadcn/ui + Recharts
- Real-time: FastAPI WebSockets (`/api/ws?token=`)
- Auth: bcrypt + PyJWT (httpOnly cookies + Bearer fallback)

## Architecture
- Backend: single `server.py` — RBAC via `perm_dep()` dependencies, per-role permission map
- Frontend: AuthContext + ThemeContext + NotificationContext
- Layout: sticky glass header + sidebar (role-filtered nav) + main content

## Implemented (Feb 2026)
- JWT auth: login, logout, `/me`, refresh, admin seeding
- Users CRUD with role assignment + active toggle
- **Roles & Permissions**: Editable matrix UI (per-module Create/Read/Update/Delete/Extra actions), backed by MongoDB — SUPER_ADMIN can edit any role, ADMIN can edit non-Super-Admin roles
- Teams CRUD with members + lead
- Projects CRUD with teams + members + team lead
- Project detail page with Tabs (Overview / Tasks / Bugs / Members / Reports)
- Task management: full CRUD, kanban board, priority/status/assignee, **estimated_hours, deadline_changes counter, reassign_count**, activity log (CREATED, STATUS_CHANGED, REASSIGNED, DEADLINE_CHANGED, PRIORITY_CHANGED, ESTIMATE_CHANGED, COMMENTED), comments
- Bug tracking: CRUD + severity/status transitions + assignee, **estimated_hours, reopen_count, reassign_count**, activity log (CREATED, ASSIGNED, STATUS_CHANGED, REOPENED, RESOLVED, SEVERITY_CHANGED), global bugs page with filters
- Time Logs: create + list with filters + pagination
- Reports: global, per-user, per-team, per-project (charts via Recharts)
- **Analytics page**: Bug summary KPIs (total/open/resolved/reopened/critical/total_reopens), Bugs Created vs Resolved line chart (7/14/30/60/90 days), Bug Concentration by User/Team/Project (stacked bar), Delay Analytics (users & teams causing deadline slips)
- **My Work page**: user's tasks/projects/bugs with tabs and pagination — `/api/me/tasks`, `/api/me/projects`, `/api/me/bugs`
- **Pagination**: default 10 per page, sizes 10/20/50/100 on Users, Teams, Projects, Tasks, Bugs, Time Logs, My Work, Notifications; format matches reference image ("Showing X to Y of Z Results")
- Notifications: MongoDB-stored + WebSocket delivery + Sonner toast + Bell dropdown + paginated
- Theme switcher with 4 light palettes (Ocean/Earth/Peach/Brutal)
- Seed: 1 super admin + 10 demo users + 3 projects + 3 teams + 12 tasks + 6 bugs (incl reopens/reassigns) + 8 time logs

## Test Accounts
See `/app/memory/test_credentials.md`.

## P1 Backlog
- Password reset flow (forgot-password + reset-password endpoints exist as stubs)
- Email verification (documented plug-and-play — currently disabled)
- Drag-drop kanban (currently status-select)
- Audit log page (data is captured server-side in `task_activity`)
- Sprint/agile board (mentioned in future roadmap)
- Export reports as PDF/CSV
- Real drag & drop with framer-motion for task cards

## P2 Backlog
- GitHub/GitLab integration
- Calendar sync
- CI/CD hooks
- AI analytics

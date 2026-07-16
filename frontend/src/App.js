import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Layout from "@/components/Layout";
import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import UsersPage from "@/pages/UsersPage";
import RolesPage from "@/pages/RolesPage";
import TeamsPage from "@/pages/TeamsPage";
import ProjectsPage from "@/pages/ProjectsPage";
import ProjectDetailPage from "@/pages/ProjectDetailPage";
import TasksPage from "@/pages/TasksPage";
import BugsPage from "@/pages/BugsPage";
import TimeLogsPage from "@/pages/TimeLogsPage";
import ReportsPage from "@/pages/ReportsPage";
import MyWorkPage from "@/pages/MyWorkPage";
import AnalyticsPage from "@/pages/AnalyticsPage";

function App() {
  return (
    <div className="App">
      <ThemeProvider>
        <BrowserRouter>
          <AuthProvider>
            <NotificationProvider>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <Layout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<DashboardPage />} />
                  <Route path="my-work" element={<MyWorkPage />} />
                  <Route path="analytics" element={<AnalyticsPage />} />
                  <Route path="tasks" element={<TasksPage />} />
                  <Route path="projects" element={<ProjectsPage />} />
                  <Route path="projects/:id" element={<ProjectDetailPage />} />
                  <Route path="teams" element={<TeamsPage />} />
                  <Route path="bugs" element={<BugsPage />} />
                  <Route path="timelogs" element={<TimeLogsPage />} />
                  <Route path="reports" element={<ReportsPage />} />
                  <Route path="users" element={<UsersPage />} />
                  <Route path="roles" element={<RolesPage />} />
                </Route>
              </Routes>
              <Toaster position="top-right" richColors closeButton />
            </NotificationProvider>
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </div>
  );
}

export default App;

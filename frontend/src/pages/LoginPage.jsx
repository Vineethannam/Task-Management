import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const DEMO_ACCOUNTS = [
  { label: "Super Admin", email: "admin@sems.io", password: "Admin@123" },
  { label: "Team Lead", email: "rohan@sems.io", password: "Password@123" },
  { label: "Developer", email: "kabir@sems.io", password: "Password@123" },
  { label: "Tester", email: "isha@sems.io", password: "Password@123" },
];

export default function LoginPage() {
  const { user, login } = useAuth();
  const [email, setEmail] = useState("admin@sems.io");
  const [password, setPassword] = useState("Admin@123");
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const res = await login(email, password);
    setLoading(false);
    if (!res.ok) {
      toast.error(res.error || "Login failed");
    }
  };

  const applyDemo = (a) => {
    setEmail(a.email);
    setPassword(a.password);
  };

  return (
    <div className="min-h-screen bg-background flex" data-testid="login-page">
      {/* Left brand panel */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 bg-primary text-primary-foreground p-12 relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-primary-foreground text-primary flex items-center justify-center font-heading font-bold text-lg">
              S
            </div>
            <div className="font-heading font-bold text-xl">SEMS</div>
          </div>
        </div>
        <div className="relative z-10 space-y-6">
          <h1 className="font-heading text-5xl font-bold leading-tight tracking-tight">
            Ship software the way engineers deserve.
          </h1>
          <p className="text-primary-foreground/80 text-base leading-relaxed max-w-md">
            One place for projects, tasks, bugs, time logs and reports — with role-based access,
            real-time updates, and a workflow that keeps up with your team.
          </p>
          <div className="grid grid-cols-3 gap-4 pt-4 max-w-md">
            {["Projects", "Kanban", "WebSocket"].map((f) => (
              <div key={f} className="border border-primary-foreground/20 rounded-md p-3">
                <div className="text-[10px] uppercase tracking-widest opacity-70">Module</div>
                <div className="font-heading font-semibold mt-1">{f}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="relative z-10 text-xs opacity-60 font-mono">
          © {new Date().getFullYear()} SEMS · Engineering Ops
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md space-y-8">
          <div>
            <h2 className="font-heading text-3xl font-bold tracking-tight">Sign in</h2>
            <p className="text-sm text-muted-foreground mt-2">
              Use your work email to access your SEMS workspace.
            </p>
          </div>

          <form onSubmit={submit} className="space-y-5" data-testid="login-form">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs uppercase tracking-widest font-semibold">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                data-testid="login-email-input"
                autoComplete="username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs uppercase tracking-widest font-semibold">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                data-testid="login-password-input"
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" className="w-full h-11" disabled={loading} data-testid="login-submit-btn">
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Sign in
            </Button>
          </form>

          <Card className="p-4 space-y-3">
            <div className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">
              Demo Accounts
            </div>
            <div className="grid grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map((a) => (
                <button
                  key={a.email}
                  type="button"
                  onClick={() => applyDemo(a)}
                  data-testid={`demo-account-${a.label.toLowerCase().replace(/\s+/g, "-")}`}
                  className="text-left border border-border rounded-md p-2 hover:bg-muted transition-colors"
                >
                  <div className="text-xs font-semibold">{a.label}</div>
                  <div className="text-[10px] text-muted-foreground font-mono truncate">{a.email}</div>
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

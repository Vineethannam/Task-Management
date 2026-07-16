import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import ThemeSwitcher from "./ThemeSwitcher";
import NotificationBell from "./NotificationBell";
import TimerWidget from "./TimerWidget";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS, roleBadgeClass } from "@/lib/constants";

export default function Header() {
  const { user, logout } = useAuth();
  const initials = (user?.name || "U")
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header
      className="h-16 sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border flex items-center justify-between px-4 sm:px-6"
      data-testid="app-header"
    >
      <div className="flex items-center gap-3">
        <div className="md:hidden w-8 h-8 rounded-md bg-primary text-primary-foreground flex items-center justify-center font-heading font-bold text-sm">
          S
        </div>
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        <TimerWidget />
        <ThemeSwitcher />
        <NotificationBell />
        <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-border">
          <Avatar className="w-8 h-8">
            <AvatarFallback className="text-xs font-semibold">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-medium">{user?.name}</span>
            <Badge variant="outline" className={`text-[10px] w-fit ${roleBadgeClass(user?.role)}`}>
              {ROLE_LABELS[user?.role] || user?.role}
            </Badge>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={logout}
          data-testid="logout-btn"
          title="Logout"
          className="h-9 w-9"
        >
          <LogOut className="w-4 h-4" />
        </Button>
      </div>
    </header>
  );
}

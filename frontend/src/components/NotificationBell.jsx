import { useNotifications } from "@/contexts/NotificationContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Bell, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";

function timeAgo(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function NotificationBell() {
  const { notifications, markRead, markAllRead } = useNotifications();
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="relative h-9 w-9"
          data-testid="notification-bell-btn"
        >
          <Bell className="w-4 h-4" />
          {unread > 0 && (
            <span
              className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold flex items-center justify-center"
              data-testid="notification-unread-count"
            >
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="font-heading font-semibold text-sm">Notifications</span>
          <button
            onClick={markAllRead}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            data-testid="notification-mark-all-read"
          >
            <Check className="w-3 h-3" /> Mark all read
          </button>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {notifications.length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No notifications yet
            </div>
          )}
          {notifications.map((n) => (
            <div
              key={n.id}
              data-testid={`notification-item-${n.id}`}
              onClick={() => !n.read && markRead(n.id)}
              className={`px-4 py-3 border-b border-border cursor-pointer hover:bg-muted/50 ${!n.read ? "bg-primary/5" : ""}`}
            >
              <div className="flex items-start gap-2">
                {!n.read && <span className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{n.title}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0">
                      {n.event_type}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{timeAgo(n.created_at)}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

import { useTimer, formatDuration } from "@/contexts/TimerContext";
import { Button } from "@/components/ui/button";
import { Play, Pause, Square, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function TimerWidget() {
  const { timer, elapsed, pause, stop, start } = useTimer();
  const navigate = useNavigate();
  if (!timer) return null;

  const running = timer.status === "RUNNING";
  const taskId = timer.task_id;
  const taskTitle = timer.task?.title || "Task";

  return (
    <div
      className="hidden md:flex items-center gap-2 px-3 h-9 rounded-md border border-primary/20 bg-primary/5"
      data-testid="timer-widget"
    >
      <Clock className={`w-4 h-4 ${running ? "text-primary animate-pulse" : "text-muted-foreground"}`} />
      <button
        onClick={() => timer.task?.project_id && navigate(`/projects/${timer.task.project_id}`)}
        className="text-xs font-medium truncate max-w-[180px] hover:underline"
        title={taskTitle}
        data-testid="timer-widget-task"
      >
        {taskTitle}
      </button>
      <span className="font-mono text-sm font-semibold text-primary" data-testid="timer-widget-elapsed">
        {formatDuration(elapsed)}
      </span>
      {running ? (
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => pause(taskId)} data-testid="timer-widget-pause">
          <Pause className="w-3.5 h-3.5" />
        </Button>
      ) : (
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => start(taskId)} data-testid="timer-widget-resume">
          <Play className="w-3.5 h-3.5" />
        </Button>
      )}
      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => stop(taskId)} data-testid="timer-widget-stop">
        <Square className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}

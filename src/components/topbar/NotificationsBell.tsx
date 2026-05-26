import { Bell } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface Props {
  hasUnread?: boolean;
}

export function NotificationsBell({ hasUnread = false }: Props) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Notifications"
          className="relative inline-flex items-center justify-center w-9 h-9 rounded-full text-foreground hover:bg-muted transition-colors"
        >
          <Bell className="w-4 h-4" />
          {hasUnread && (
            <span
              className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
              style={{ background: "var(--accent)" }}
            />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-4">
        <div className="text-sm font-semibold text-foreground mb-1">Notifications</div>
        <div className="text-xs text-muted-foreground">No new notifications.</div>
      </PopoverContent>
    </Popover>
  );
}
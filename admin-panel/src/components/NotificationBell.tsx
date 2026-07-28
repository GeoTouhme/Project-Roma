import React, { useEffect, useRef, useState } from "react";
import { Bell, Trash2, Check, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import api, { dashboardAPI } from "@/lib/api";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface Notification {
  _id: string;
  title: string;
  orderId: string;
  opened: boolean;
  city?: string;
  paymentMethod?: string;
  createdAt: string;
}

export const NotificationBell: React.FC = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const prevUnreadRef = useRef(0);

  // Play a short alarm beep using the Web Audio API so we don't depend on an MP3 file.
  const playAlarm = () => {
    if (!soundEnabled || !audioUnlocked) return;
    try {
      const AudioContext =
        (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch (err) {
      console.warn("Notification alarm play failed", err);
    }
  };

  useEffect(() => {
    // Unlock audio context on first user interaction so autoplay policies allow it later.
    const unlockAudio = () => {
      try {
        const AudioContext =
          (window as any).AudioContext || (window as any).webkitAudioContext;
        if (AudioContext) {
          const ctx = new AudioContext();
          ctx.resume().then(() => setAudioUnlocked(true));
        } else {
          setAudioUnlocked(true);
        }
      } catch {
        setAudioUnlocked(true);
      }
      window.removeEventListener("click", unlockAudio);
    };
    window.addEventListener("click", unlockAudio);

    return () => {
      window.removeEventListener("click", unlockAudio);
    };
  }, []);

  const [isRateLimited, setIsRateLimited] = useState(false);

  const fetchNotifications = async () => {
    if (isRateLimited) return;

    try {
      const response = await dashboardAPI.getNotifications();
      setIsRateLimited(false);

      if (response.data.success) {
        const newNotifications = response.data.data || [];
        const newUnread = response.data.totalUnread || 0;

        // Play alarm when a new unread notification arrives.
        if (
          soundEnabled &&
          audioUnlocked &&
          newUnread > 0 &&
          newUnread > prevUnreadRef.current &&
          newNotifications.some(
            (n: Notification) =>
              !notifications.find((existing) => existing._id === n._id && existing.opened)
          )
        ) {
          playAlarm();
        }

        prevUnreadRef.current = newUnread;
        setNotifications(newNotifications);
        setUnreadCount(newUnread);
      }
    } catch (error: any) {
      // Avoid console spam: only log the first 429, then back off polling.
      if (error.response?.status === 429) {
        if (!isRateLimited) {
          console.warn("Notification polling rate-limited; backing off.");
          setIsRateLimited(true);
        }
      } else {
        console.error("Failed to fetch notifications:", error);
      }
    }
  };

  useEffect(() => {
    fetchNotifications();
    // Poll every 30 seconds. Active admin work can exhaust the shared API rate bucket,
    // so notifications use their own dedicated polling limit.
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [soundEnabled, audioUnlocked, notifications, isRateLimited]);

  const handleMarkOpened = async (e: React.MouseEvent, notification: Notification) => {
    e.stopPropagation();
    try {
      await api.put(`/api/admin/notifications/${notification._id}/open`);
      setNotifications((prev) =>
        prev.map((n) => (n._id === notification._id ? { ...n, opened: true } : n))
      );
      setUnreadCount((count) => Math.max(0, count - 1));
    } catch (error) {
      toast.error("Failed to mark notification as read");
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await api.delete(`/api/admin/notifications/${id}`);
      setNotifications((prev) => prev.filter((n) => n._id !== id));
      const remainingUnread = notifications.filter(
        (n) => n._id !== id && !n.opened
      ).length;
      setUnreadCount(remainingUnread);
      toast.success("Notification cleared");
    } catch (error) {
      toast.error("Failed to clear notification");
    }
  };

  const handleClearAll = async () => {
    try {
      await api.delete("/api/admin/notifications");
      setNotifications([]);
      setUnreadCount(0);
      toast.success("All notifications cleared");
    } catch (error) {
      toast.error("Failed to clear notifications");
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    setOpen(false);
    if (!notification.opened) {
      api.put(`/api/admin/notifications/${notification._id}/open`).catch(() => {});
      setNotifications((prev) =>
        prev.map((n) => (n._id === notification._id ? { ...n, opened: true } : n))
      );
      setUnreadCount((count) => Math.max(0, count - 1));
    }
    if (notification.orderId) {
      navigate(`/orders/${notification.orderId}`);
    } else {
      toast.error("No order linked to this notification");
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-3 border-b font-medium flex items-center justify-between">
          <span>Notifications</span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? "Mute alarm" : "Enable alarm"}
            >
              {soundEnabled ? (
                <Volume2 className="h-4 w-4" />
              ) : (
                <VolumeX className="h-4 w-4" />
              )}
            </Button>
            {notifications.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive"
                onClick={handleClearAll}
                title="Clear all notifications"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        <ScrollArea className="h-80">
          {notifications.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No notifications yet.
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <button
                  key={notification._id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`w-full text-left p-3 hover:bg-muted transition-colors ${
                    !notification.opened ? "bg-primary/5" : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {notification.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {notification.city} • {notification.paymentMethod}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(notification.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      {!notification.opened && (
                        <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-1" />
                      )}
                      <div className="flex items-center gap-1 mt-1">
                        {!notification.opened && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={(e) => handleMarkOpened(e, notification)}
                            title="Mark as read"
                          >
                            <Check className="h-3 w-3" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive"
                          onClick={(e) => handleDelete(e, notification._id)}
                          title="Clear notification"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;

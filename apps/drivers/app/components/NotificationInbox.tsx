"use client";

import { useState } from "react";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Popover, PopoverTrigger, PopoverContent } from "@repo/ui/components/popover";
import { BellIcon } from "@phosphor-icons/react";

interface Notification {
    id: number;
    user: string;
    action: string;
    target: string;
    timestamp: string;
    unread: boolean;
    // icon: LucideIcon;
}

const initialNotifications: Notification[] = [
    {
        id: 1,
        user: "Alicia Keys",
        action: "merged",
        target: "PR #105: Dark mode support",
        timestamp: "10 minutes ago",
        unread: true,

    },
    {
        id: 2,
        user: "Daniel Green",
        action: "shared file",
        target: "Quarterly Report.pdf",
        timestamp: "30 minutes ago",
        unread: true,
    },
    {
        id: 3,
        user: "Sophia Turner",
        action: "assigned you a task",
        target: "Marketing campaign brief",
        timestamp: "2 hours ago",
        unread: false,
    },
    {
        id: 4,
        user: "Michael Ross",
        action: "sent you a message",
        target: "Project feedback discussion",
        timestamp: "5 hours ago",
        unread: false,
    },
    {
        id: 5,
        user: "Priya Sharma",
        action: "added a comment",
        target: "UX Review Notes",
        timestamp: "1 day ago",
        unread: false,
    },
    {
        id: 6,
        user: "System",
        action: "alert",
        target: "Server downtime scheduled",
        timestamp: "3 days ago",
        unread: false,
    },
];

const NotificationInbox = () => {
    const [notifications, setNotifications] = useState(initialNotifications);
    const unreadCount = notifications.filter((n) => n.unread).length;
    const [tab, setTab] = useState("all");

    const filtered = tab === "unread" ? notifications.filter((n) => n.unread) : notifications;

    const markAsRead = (id: number) => {
        setNotifications(
            notifications.map((n) => (n.id === id ? { ...n, unread: false } : n)),
        );
    };

    return (
        <Popover>
            <PopoverTrigger asChild>
                <button className="relative inline-flex items-center justify-center rounded-full p-2 hover:bg-muted" aria-label="Open notifications">
                    <BellIcon className="h-6 w-6" aria-hidden="true" />
                    {unreadCount > 0 && (
                        <Badge
                            variant="default"
                            className="bg-red-600 h-4 w-4 absolute -top-[-4px] -right-[-4px] text-xs px-1.5 py-0"

                        >
                            {unreadCount > 99 ? "99+" : unreadCount}
                        </Badge>
                    )}
                </button>
                {/* <button className="relative inline-flex items-center justify-center rounded-full p-2 hover:bg-muted">
                    <Bell className="h-5 w-5" />
                    {items.length > 0 && (
                        <Badge
                            variant="default"
                            className="absolute -top-1 -right-1 text-xs px-1.5 py-0"
                        >
                            {items.length}
                        </Badge>
                    )}
                </button> */}

            </PopoverTrigger>
            <PopoverContent className="w-[380px] p-0" align="end">
                {/* Header with Tabs + Mark All */}
                <div className="flex items-center justify-between border-b px-3 py-2">
                    <div className="bg-transparent">
                        <div>Notifications</div>
                    </div>
                </div>

                {/* Notifications List */}
                <div className="max-h-80 overflow-y-auto">
                    {filtered.length === 0 ? (
                        <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                            No notifications
                        </div>
                    ) : (
                        filtered.map((n) => {
                            return (
                                <button
                                    key={n.id}
                                    onClick={() => markAsRead(n.id)}
                                    className="flex w-full items-start gap-3 border-b px-3 py-3 text-left hover:bg-accent"
                                >
                                    <div className="flex-1 space-y-1">
                                        <p
                                            className={`text-sm ${n.unread ? "font-semibold text-foreground" : "text-foreground/80"
                                                }`}
                                        >
                                            {n.user} {n.action}{" "}
                                            <span className="font-medium">{n.target}</span>
                                        </p>
                                        <p className="text-xs text-muted-foreground">{n.timestamp}</p>
                                    </div>
                                    {n.unread && (
                                        <span className="mt-1 inline-block size-1.5 rounded-full bg-red-500" />
                                    )}
                                </button>
                            );
                        })
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}

export default NotificationInbox;
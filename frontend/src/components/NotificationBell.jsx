import React, { useState, useRef, useEffect } from 'react';
import { Bell, Check, Trash2, X } from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';
import { formatDistanceToNow } from 'date-fns';

export default function NotificationBell() {
    const { unreadCount, notifications, markRead, markAllRead, deleteNotification } = useNotifications();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleMarkRead = (id, e) => {
        e.stopPropagation();
        markRead(id);
    };

    const handleDelete = (id, e) => {
        e.stopPropagation();
        deleteNotification(id);
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 text-text-muted dark:text-text-muted-dark hover:text-primary dark:hover:text-primary-light transition-colors rounded-lg hover:bg-surface dark:hover:bg-card-dark"
            >
                <Bell size={20} />
                {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-card dark:ring-card-dark animate-pulse" />
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-card dark:bg-card-dark rounded-xl shadow-xl border border-border dark:border-border-dark overflow-hidden z-50 origin-top-right transform transition-all">
                    <div className="p-4 border-b border-border dark:border-border-dark flex items-center justify-between bg-surface/50 dark:bg-surface-dark/50">
                        <h3 className="font-semibold text-text-primary dark:text-text-primary-dark">Notifications</h3>
                        {unreadCount > 0 && (
                            <button
                                onClick={() => markAllRead()}
                                className="text-xs text-primary dark:text-primary-light hover:text-primary-hover font-medium flex items-center gap-1"
                            >
                                <Check size={12} />
                                Mark all read
                            </button>
                        )}
                    </div>

                    <div className="max-h-[400px] overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="p-8 text-center text-text-muted dark:text-text-muted-dark">
                                <Bell size={24} className="mx-auto mb-2 opacity-20" />
                                <p className="text-sm">No notifications yet</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-border dark:divide-border-dark">
                                {notifications.map(notification => (
                                    <div
                                        key={notification.id}
                                        className={`p-4 hover:bg-surface dark:hover:bg-card-dark/50 transition-colors group relative ${!notification.is_read ? 'bg-primary/5 dark:bg-primary/10' : ''}`}
                                    >
                                        <div className="flex gap-3">
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-sm ${!notification.is_read ? 'text-text-primary dark:text-text-primary-dark font-medium' : 'text-text-muted dark:text-text-muted-dark'}`}>
                                                    {notification.message}
                                                </p>
                                                <p className="text-xs text-text-muted dark:text-text-muted-dark mt-1">
                                                    {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                                                </p>
                                            </div>
                                            <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {!notification.is_read && (
                                                    <button
                                                        onClick={(e) => handleMarkRead(notification.id, e)}
                                                        className="p-1 text-primary hover:bg-primary/10 dark:hover:bg-primary/20 rounded"
                                                        title="Mark as read"
                                                    >
                                                        <div className="w-2 h-2 bg-primary rounded-full" />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={(e) => handleDelete(notification.id, e)}
                                                    className="p-1 text-text-muted dark:text-text-muted-dark hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                                                    title="Delete"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

"use client";

import { useState } from 'react';
import { Bell, CheckCheck, Trash2, ArrowLeft } from 'lucide-react';
import { useNotifications, useMarkAsRead, useMarkAllAsRead, useDeleteNotification } from '@/hooks/useNotifications';
import { Header } from '@/components/layout/Header';
import { BottomNav } from '@/components/layout/BottomNav';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';

// Notification type styles
const notificationStyles: Record<string, { icon: string; bgColor: string }> = {
  drill_assigned: { icon: '📚', bgColor: 'bg-blue-100' },
  drill_reminder: { icon: '⏰', bgColor: 'bg-amber-100' },
  drill_reviewed: { icon: '✅', bgColor: 'bg-green-100' },
  drill_completed: { icon: '📝', bgColor: 'bg-purple-100' },
  daily_focus: { icon: '🎯', bgColor: 'bg-indigo-100' },
  achievement: { icon: '🏆', bgColor: 'bg-yellow-100' },
  message: { icon: '💬', bgColor: 'bg-cyan-100' },
  tutor_update: { icon: '👨‍🏫', bgColor: 'bg-pink-100' },
  system: { icon: '📢', bgColor: 'bg-gray-100' },
};

export default function NotificationsPage() {
  const router = useRouter();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  
  const { data, isLoading, isFetching } = useNotifications({ 
    limit: 50, 
    unreadOnly: filter === 'unread' 
  });
  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();
  const deleteNotification = useDeleteNotification();

  const notifications = data?.notifications ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  const handleNotificationClick = async (notification: any) => {
    if (!notification.isRead) {
      await markAsRead.mutateAsync(notification._id);
    }
    
    if (notification.data?.url) {
      router.push(notification.data.url);
    }
  };

  const handleMarkAllRead = async () => {
    await markAllAsRead.mutateAsync();
  };

  const handleDelete = async (e: React.MouseEvent, notificationId: string) => {
    e.preventDefault();
    e.stopPropagation();
    await deleteNotification.mutateAsync(notificationId);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
      <div className="h-6" />
      <Header title="Notifications" />

      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Filter Tabs & Actions */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === 'all'
                  ? 'bg-green-500 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === 'unread'
                  ? 'bg-green-500 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              Unread {unreadCount > 0 && `(${unreadCount})`}
            </button>
          </div>

          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllRead}
              disabled={markAllAsRead.isPending}
            >
              <CheckCheck className="w-4 h-4 mr-1" />
              Mark all read
            </Button>
          )}
        </div>

        {/* Notifications List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-gray-300 border-t-green-500 rounded-full" />
          </div>
        ) : notifications.length === 0 ? (
          <Card className="p-12 text-center">
            <Bell className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
            </h3>
            <p className="text-gray-500 text-sm">
              {filter === 'unread' 
                ? "You're all caught up!"
                : "We'll notify you when something important happens"
              }
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {notifications.map((notification: any) => {
              const style = notificationStyles[notification.type] || notificationStyles.system;

              return (
                <Card
                  key={notification._id}
                  className={`p-4 cursor-pointer hover:shadow-md transition-all ${
                    !notification.isRead ? 'border-l-4 border-l-blue-500 bg-blue-50/30' : ''
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex gap-4">
                    {/* Icon */}
                    <div className={`w-12 h-12 rounded-full ${style.bgColor} flex items-center justify-center flex-shrink-0`}>
                      <span className="text-2xl">{style.icon}</span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className={`font-medium ${!notification.isRead ? 'text-gray-900' : 'text-gray-700'}`}>
                            {notification.title}
                          </p>
                          <p className="text-sm text-gray-500 mt-1">
                            {notification.body}
                          </p>
                        </div>
                        
                        {/* Delete Button */}
                        <button
                          onClick={(e) => handleDelete(e, notification._id)}
                          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          aria-label="Delete notification"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Footer */}
                      <div className="flex items-center gap-3 mt-3">
                        <span className="text-xs text-gray-400">
                          {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                        </span>
                        {!notification.isRead && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                            New
                          </span>
                        )}
                        {notification.data?.url && (
                          <span className="text-xs text-blue-600">
                            Click to view →
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}

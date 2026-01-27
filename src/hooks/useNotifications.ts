"use client";

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface Notification {
  _id: string;
  title: string;
  body: string;
  type: string;
  data?: {
    screen?: string;
    resourceId?: string;
    resourceType?: string;
    url?: string;
  };
  isRead: boolean;
  readAt?: string;
  createdAt: string;
}

interface NotificationsResponse {
  notifications: Notification[];
  unreadCount: number;
  pagination: {
    limit: number;
    skip: number;
    hasMore: boolean;
  };
}

/**
 * Hook to fetch notifications
 */
export function useNotifications(options?: { limit?: number; unreadOnly?: boolean }) {
  const { limit = 20, unreadOnly = false } = options || {};

  return useQuery<NotificationsResponse>({
    queryKey: ['notifications', { limit, unreadOnly }],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: limit.toString(),
        unreadOnly: unreadOnly.toString(),
      });

      const response = await fetch(`/api/v1/notifications?${params}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch notifications');
      }

      return response.json();
    },
    staleTime: 30 * 1000, // Consider data fresh for 30 seconds
    refetchInterval: 60 * 1000, // Refetch every minute
  });
}

/**
 * Hook to get unread notification count
 */
export function useUnreadCount() {
  const { data } = useNotifications({ limit: 1 });
  return data?.unreadCount ?? 0;
}

/**
 * Hook to mark a notification as read
 */
export function useMarkAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const response = await fetch(`/api/v1/notifications/${notificationId}`, {
        method: 'PATCH',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to mark notification as read');
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate notifications query to refetch
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

/**
 * Hook to mark all notifications as read
 */
export function useMarkAllAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/v1/notifications/read-all', {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to mark all as read');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

/**
 * Hook to delete a notification
 */
export function useDeleteNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const response = await fetch(`/api/v1/notifications/${notificationId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to delete notification');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

/**
 * Hook to register push token
 */
export function useRegisterPushToken() {
  return useMutation({
    mutationFn: async (data: {
      platform: 'expo' | 'web' | 'fcm';
      token: string;
      deviceInfo?: {
        deviceName?: string;
        osVersion?: string;
        appVersion?: string;
        browser?: string;
      };
    }) => {
      const response = await fetch('/api/v1/notifications/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to register push token');
      }

      return response.json();
    },
  });
}

/**
 * Hook to unregister push token
 */
export function useUnregisterPushToken() {
  return useMutation({
    mutationFn: async (token: string) => {
      const response = await fetch(`/api/v1/notifications/register?token=${encodeURIComponent(token)}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to unregister push token');
      }

      return response.json();
    },
  });
}


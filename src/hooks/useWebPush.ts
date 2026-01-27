"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRegisterPushToken, useUnregisterPushToken } from './useNotifications';

interface WebPushState {
  isSupported: boolean;
  isSubscribed: boolean;
  permission: NotificationPermission | 'unknown';
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook to manage Web Push notifications
 */
export function useWebPush() {
  const [state, setState] = useState<WebPushState>({
    isSupported: false,
    isSubscribed: false,
    permission: 'unknown',
    isLoading: true,
    error: null,
  });

  const registerToken = useRegisterPushToken();
  const unregisterToken = useUnregisterPushToken();

  // Check if push is supported
  useEffect(() => {
    const checkSupport = async () => {
      if (typeof window === 'undefined') return;

      // Basic API checks
      const hasServiceWorker = 'serviceWorker' in navigator;
      const hasPushManager = 'PushManager' in window;
      const hasNotification = 'Notification' in window;

      console.log('[WebPush] Support check:', { hasServiceWorker, hasPushManager, hasNotification });

      if (!hasServiceWorker || !hasPushManager || !hasNotification) {
        setState(prev => ({ 
          ...prev, 
          isSupported: false, 
          isLoading: false,
          error: `Push notifications not supported: ${!hasServiceWorker ? 'No ServiceWorker' : !hasPushManager ? 'No PushManager' : 'No Notification API'}`
        }));
        return;
      }

      // Check current permission
      const permission = Notification.permission;
      console.log('[WebPush] Current permission:', permission);

      // Check if already subscribed (only if we have a registered service worker)
      let isSubscribed = false;
      try {
        // Get all service worker registrations
        const registrations = await navigator.serviceWorker.getRegistrations();
        console.log('[WebPush] Service worker registrations:', registrations.length);
        
        // Check if our sw.js is registered
        const ourSW = registrations.find(r => r.active?.scriptURL?.includes('sw.js'));
        
        if (ourSW) {
          const subscription = await ourSW.pushManager.getSubscription();
          isSubscribed = !!subscription;
          console.log('[WebPush] Existing subscription:', !!subscription);
        }
      } catch (error) {
        console.error('[WebPush] Error checking subscription:', error);
        // Don't fail - just means we're not subscribed yet
      }

      setState({
        isSupported: true,
        isSubscribed,
        permission,
        isLoading: false,
        error: null,
      });
    };

    checkSupport();
  }, []);

  // Subscribe to push notifications
  const subscribe = useCallback(async () => {
    if (!state.isSupported) {
      return { success: false, error: 'Push not supported' };
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      console.log('[WebPush] Starting subscription process...');

      // Request permission first (before registering service worker)
      console.log('[WebPush] Requesting notification permission...');
      const permission = await Notification.requestPermission();
      console.log('[WebPush] Permission result:', permission);
      
      if (permission !== 'granted') {
        setState(prev => ({ 
          ...prev, 
          permission, 
          isLoading: false,
          error: permission === 'denied' 
            ? 'Notifications blocked. Please enable in browser settings.' 
            : 'Notification permission not granted'
        }));
        return { success: false, error: 'Permission denied' };
      }

      // Register service worker
      console.log('[WebPush] Registering service worker...');
      let registration;
      try {
        registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/'
        });
        console.log('[WebPush] Service worker registered:', registration.scope);
      } catch (swError: any) {
        console.error('[WebPush] Service worker registration failed:', swError);
        throw new Error(`Service worker failed: ${swError.message}`);
      }

      // Wait for service worker to be ready
      console.log('[WebPush] Waiting for service worker to be ready...');
      await navigator.serviceWorker.ready;
      console.log('[WebPush] Service worker ready');

      // Get VAPID public key
      console.log('[WebPush] Fetching VAPID key...');
      const vapidResponse = await fetch('/api/v1/notifications/vapid-key');
      if (!vapidResponse.ok) {
        const errorText = await vapidResponse.text();
        console.error('[WebPush] VAPID key fetch failed:', errorText);
        throw new Error('Failed to get VAPID key - check server configuration');
      }
      const { publicKey } = await vapidResponse.json();
      console.log('[WebPush] Got VAPID key');

      // Subscribe to push
      console.log('[WebPush] Subscribing to push manager...');
      let subscription;
      try {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
        console.log('[WebPush] Push subscription created');
      } catch (pushError: any) {
        console.error('[WebPush] Push subscription failed:', pushError);
        // Brave specific: check if shields are blocking
        if (pushError.message?.includes('denied') || pushError.name === 'NotAllowedError') {
          throw new Error('Push blocked by browser privacy settings. Check Brave Shields.');
        }
        throw new Error(`Push subscription failed: ${pushError.message}`);
      }

      // Register with our API
      console.log('[WebPush] Registering token with server...');
      await registerToken.mutateAsync({
        platform: 'web',
        token: JSON.stringify(subscription.toJSON()),
        deviceInfo: {
          browser: navigator.userAgent,
        },
      });
      console.log('[WebPush] Token registered successfully');

      setState(prev => ({ 
        ...prev, 
        isSubscribed: true, 
        permission: 'granted',
        isLoading: false,
        error: null,
      }));

      return { success: true };
    } catch (error: any) {
      console.error('[WebPush] Subscribe failed:', error);
      setState(prev => ({ 
        ...prev, 
        isLoading: false,
        error: error.message || 'Failed to subscribe'
      }));
      return { success: false, error: error.message };
    }
  }, [state.isSupported, registerToken]);

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // Unregister from our API
        await unregisterToken.mutateAsync(JSON.stringify(subscription.toJSON()));
        
        // Unsubscribe from browser
        await subscription.unsubscribe();
      }

      setState(prev => ({ 
        ...prev, 
        isSubscribed: false, 
        isLoading: false,
        error: null,
      }));

      return { success: true };
    } catch (error: any) {
      console.error('Failed to unsubscribe:', error);
      setState(prev => ({ 
        ...prev, 
        isLoading: false,
        error: error.message || 'Failed to unsubscribe'
      }));
      return { success: false, error: error.message };
    }
  }, [unregisterToken]);

  return {
    ...state,
    subscribe,
    unsubscribe,
  };
}

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray.buffer as ArrayBuffer;
}


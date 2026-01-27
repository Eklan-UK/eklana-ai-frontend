"use client";

import { useState, useEffect } from 'react';
import { Bell, X, Check } from 'lucide-react';
import { useWebPush } from '@/hooks/useWebPush';
import { Button } from '@/components/ui/Button';

/**
 * Component to prompt users to enable push notifications
 * Shows a dismissible banner if notifications aren't enabled
 */
export function PushNotificationPrompt() {
  const { isSupported, isSubscribed, permission, isLoading, subscribe } = useWebPush();
  const [isDismissed, setIsDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Check if user dismissed the prompt before
    const dismissed = localStorage.getItem('push-prompt-dismissed');
    if (dismissed) {
      setIsDismissed(true);
    }
  }, []);

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem('push-prompt-dismissed', 'true');
  };

  const handleEnable = async () => {
    const result = await subscribe();
    if (result.success) {
      setIsDismissed(true);
    }
  };

  // Don't render anything until mounted (avoid hydration mismatch)
  if (!mounted) return null;

  // Don't show if:
  // - Not supported
  // - Already subscribed
  // - User dismissed
  // - Permission denied (can't ask again)
  // - Still loading
  if (
    !isSupported || 
    isSubscribed || 
    isDismissed || 
    permission === 'denied' ||
    isLoading
  ) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-4 py-3 rounded-xl mb-4 shadow-lg">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <p className="font-medium text-sm">Enable Push Notifications</p>
            <p className="text-xs text-white/80">
              Get notified about new drills and updates
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleEnable}
            disabled={isLoading}
            className="bg-white text-green-600 hover:bg-green-50 border-0 text-xs px-3"
          >
            <Check className="w-4 h-4 mr-1" />
            Enable
          </Button>
          <button
            onClick={handleDismiss}
            className="p-1.5 hover:bg-white/20 rounded-full transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}


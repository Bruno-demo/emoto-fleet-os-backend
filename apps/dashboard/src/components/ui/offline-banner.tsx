'use client';

import { useEffect, useState } from 'react';
import { WifiOff, X } from 'lucide-react';

// Floating banner that appears ONLY when the browser fires an actual 'offline'
// event and auto-hides when 'online' fires. We intentionally do NOT read
// navigator.onLine on mount because it is unreliable in many environments
// (returns false on working connections behind proxies, VPNs, or Railway).
export function OfflineBanner() {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handleOffline = () => {
      setDismissed(false);
      setVisible(true);
    };
    const handleOnline = () => {
      setVisible(false);
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  if (!visible || dismissed) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-[9999] -translate-x-1/2">
      <div className="flex items-center gap-3 rounded-2xl border border-yellow-500/30 bg-yellow-950/90 px-5 py-3 shadow-2xl backdrop-blur-lg">
        <WifiOff size={18} className="shrink-0 text-yellow-400 animate-pulse" />
        <div className="text-sm">
          <span className="font-semibold text-yellow-200">You are offline</span>
          <span className="ml-1.5 text-yellow-400/80">
            — Data may be stale. The dashboard will sync when your connection returns.
          </span>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="ml-2 shrink-0 rounded-lg p-1 text-yellow-400/60 transition hover:bg-yellow-500/20 hover:text-yellow-300"
          aria-label="Dismiss"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

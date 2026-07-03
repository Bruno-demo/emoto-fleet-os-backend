'use client';

import { useEffect, useState } from 'react';
import { WifiOff, X } from 'lucide-react';

// Floating banner that appears when the browser goes offline and hides
// automatically when connectivity is restored. Uses the browser's native
// navigator.onLine + online/offline events.
export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(
    () => typeof navigator !== 'undefined' && !navigator.onLine,
  );
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handleOffline = () => {
      setIsOffline(true);
      setDismissed(false); // Re-show banner on each offline event
    };
    const handleOnline = () => {
      setIsOffline(false);
      setDismissed(false);
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  if (!isOffline || dismissed) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-[9999] -translate-x-1/2 animate-in slide-in-from-bottom-4 fade-in duration-300">
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

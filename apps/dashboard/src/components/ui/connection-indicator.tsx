'use client';

import { Wifi, WifiOff } from 'lucide-react';
import { useRealtime } from '@/components/realtime/realtime-provider';
import { Badge } from '@/components/ui/badge';

// Shows the operator whether websocket updates are live, reconnecting, or offline.
export function ConnectionIndicator() {
  const { connectionState } = useRealtime();

  if (connectionState === 'connected') {
    return <Badge label={<span className="hidden sm:inline">Connected</span>} tone="success" icon={<Wifi size={13} />} />;
  }
  if (connectionState === 'reconnecting' || connectionState === 'connecting') {
    return <Badge label={<span className="hidden sm:inline">Reconnecting</span>} tone="warning" icon={<Wifi size={13} />} />;
  }
  return <Badge label={<span className="hidden sm:inline">Offline</span>} tone="danger" icon={<WifiOff size={13} />} />;
}


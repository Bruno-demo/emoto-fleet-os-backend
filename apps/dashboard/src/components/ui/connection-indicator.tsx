'use client';

import { Wifi, WifiOff } from 'lucide-react';
import { useRealtime } from '@/components/realtime/realtime-provider';
import { Badge } from '@/components/ui/badge';

// Shows the operator whether websocket updates are live, reconnecting, or offline.
export function ConnectionIndicator() {
  const { connectionState } = useRealtime();

  if (connectionState === 'connected') {
    return <Badge label="Connected" tone="success" icon={<Wifi size={13} />} />;
  }
  if (connectionState === 'reconnecting' || connectionState === 'connecting') {
    return <Badge label="Reconnecting" tone="warning" icon={<Wifi size={13} />} />;
  }
  return <Badge label="Offline" tone="danger" icon={<WifiOff size={13} />} />;
}

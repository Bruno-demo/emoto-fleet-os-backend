import NetInfo from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';

let isConfigured = false;

// Bridges React Query online/offline state with native connectivity events.
export function configureOnlineManager(): void {
  if (isConfigured) {
    return;
  }

  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => {
      setOnline(Boolean(state.isConnected && state.isInternetReachable !== false));
    }),
  );

  isConfigured = true;
}

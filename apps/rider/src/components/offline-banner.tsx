import { useNetInfo } from '@react-native-community/netinfo';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme/tokens';

// Shows a lightweight offline banner when device connectivity is lost.
export function OfflineBanner() {
  const netInfo = useNetInfo();
  const isOffline =
    netInfo.isConnected === false || netInfo.isInternetReachable === false;

  if (!isOffline) {
    return null;
  }

  return (
    <View style={styles.banner}>
      <Text style={styles.title}>Offline mode</Text>
      <Text style={styles.text}>
        Showing cached data where available. Live actions resume when the
        connection returns.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: theme.colors.warningSoft,
    borderBottomWidth: 1,
    borderBottomColor: '#F3D9AA',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    gap: 2,
  },
  title: {
    color: theme.colors.warning,
    fontSize: theme.typography.caption,
    fontWeight: '700',
    textAlign: 'center',
  },
  text: {
    color: theme.colors.text,
    fontSize: theme.typography.caption,
    fontWeight: '600',
    textAlign: 'center',
  },
});

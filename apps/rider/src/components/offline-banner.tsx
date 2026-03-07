import { useNetInfo } from '@react-native-community/netinfo';
import { StyleSheet, Text, View } from 'react-native';

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
      <Text style={styles.text}>
        You are offline. Showing cached data where available.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  text: {
    color: '#1f2937',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
});

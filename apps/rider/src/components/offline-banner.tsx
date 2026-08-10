import { useNetInfo } from '@react-native-community/netinfo';
import { StyleSheet, Text, View } from 'react-native';
import { useLanguage } from '../lib/i18n/language-context';
import { theme } from '../theme/tokens';

// Shows a lightweight offline banner when device connectivity is lost.
export function OfflineBanner() {
  const netInfo = useNetInfo();
  const { t } = useLanguage();
  const isOffline =
    netInfo.isConnected === false || netInfo.isInternetReachable === false;

  if (!isOffline) {
    return null;
  }

  return (
    <View style={styles.banner}>
      <Text style={styles.title}>{t.statusBanners.offlineTitle}</Text>
      <Text style={styles.text}>{t.statusBanners.offlineSub}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#FEF3C7', // Solid, high-contrast light amber-100 background
    borderBottomWidth: 1,
    borderBottomColor: '#F59E0B', // Solid warm warning border
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    gap: 2,
  },
  title: {
    color: '#B45309', // Rich dark warning amber-700
    fontSize: theme.typography.caption,
    fontWeight: '700',
    textAlign: 'center',
  },
  text: {
    color: '#78350F', // Deep, highly legible warning brown-900 for perfect contrast (WCAG AAA)
    fontSize: theme.typography.caption,
    fontWeight: '600',
    textAlign: 'center',
  },
});

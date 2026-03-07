import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '../components/screen-container';
import type { RiderTripsStackParamList } from '../navigation/navigation.types';

type TripDetailScreenProps = NativeStackScreenProps<
  RiderTripsStackParamList,
  'TripDetail'
>;

// Formats duration seconds into readable minutes/seconds for trip details.
function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

// Renders a lightweight trip detail view from the selected list item payload.
export function TripDetailScreen({ route }: TripDetailScreenProps) {
  const { trip } = route.params;

  return (
    <ScreenContainer>
      <Text style={styles.title}>Trip Detail</Text>
      <Text style={styles.subtitle}>Trip {trip.id.slice(0, 8)}</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Bike</Text>
        <Text style={styles.value}>{trip.bikeId}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Start</Text>
        <Text style={styles.value}>{new Date(trip.startTs).toLocaleString()}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>End</Text>
        <Text style={styles.value}>
          {trip.endTs ? new Date(trip.endTs).toLocaleString() : 'In progress'}
        </Text>
      </View>

      <View style={styles.grid}>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Distance</Text>
          <Text style={styles.metricValue}>{trip.distanceKm.toFixed(2)} km</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Duration</Text>
          <Text style={styles.metricValue}>{formatDuration(trip.durationSec)}</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Score</Text>
          <Text style={styles.metricValue}>{trip.score.toFixed(1)}</Text>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    fontSize: 14,
    color: '#4b5563',
  },
  card: {
    borderWidth: 1,
    borderColor: '#d0d7de',
    borderRadius: 12,
    backgroundColor: '#ffffff',
    padding: 14,
    gap: 4,
  },
  label: {
    fontSize: 12,
    color: '#6b7280',
    textTransform: 'uppercase',
  },
  value: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '600',
  },
  grid: {
    gap: 10,
  },
  metricCard: {
    borderWidth: 1,
    borderColor: '#d0d7de',
    borderRadius: 12,
    backgroundColor: '#ffffff',
    padding: 14,
    gap: 4,
  },
  metricLabel: {
    fontSize: 13,
    color: '#4b5563',
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
});

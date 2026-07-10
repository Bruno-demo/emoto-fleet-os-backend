import { useQuery } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, FlatList } from 'react-native';
import { ScreenContainer } from '../components/screen-container';
import { EmptyState } from '../components/ui/empty-state';
import { ErrorState } from '../components/ui/error-state';
import { Badge } from '../components/ui/badge';
import { SectionHeader } from '../components/ui/section-header';
import { ListSkeleton } from '../components/ui/skeleton';
import { ApiError, apiFetch } from '../lib/api/client';
import { riderDeliverySchema } from '../lib/api/schemas';
import type { RiderDelivery } from '../lib/types/api';
import type { RiderDeliveriesStackParamList } from '../navigation/navigation.types';
import { theme } from '../theme/tokens';
import { z } from 'zod';

type DeliveriesScreenProps = NativeStackScreenProps<
  RiderDeliveriesStackParamList,
  'DeliveriesList'
>;

export function DeliveriesScreen({ navigation }: DeliveriesScreenProps) {
  const deliveriesQuery = useQuery({
    queryKey: ['rider-deliveries'],
    queryFn: () =>
      apiFetch<RiderDelivery[]>(
        '/deliveries',
        undefined,
        { schema: z.array(riderDeliverySchema) },
      ),
  });

  const payload = deliveriesQuery.data || [];

  if (deliveriesQuery.isLoading) {
    return (
      <ScreenContainer>
        <SectionHeader title="Deliveries" subtitle="Loading assigned orders..." />
        <ListSkeleton rows={4} />
      </ScreenContainer>
    );
  }

  if (deliveriesQuery.isError) {
    return (
      <ScreenContainer>
        <ErrorState
          title="Unable to load deliveries"
          description="Pull to refresh or try again."
          onRetry={() => {
            void deliveriesQuery.refetch();
          }}
        />
      </ScreenContainer>
    );
  }

  const getStatusTone = (status: RiderDelivery['status']) => {
    switch (status) {
      case 'PENDING': return 'neutral';
      case 'ASSIGNED': return 'warning';
      case 'PICKED_UP': return 'primary';
      case 'IN_TRANSIT': return 'success';
      case 'DELIVERED': return 'success';
      case 'FAILED': return 'danger';
      default: return 'neutral';
    }
  };

  return (
    <ScreenContainer
      refreshing={deliveriesQuery.isRefetching}
      onRefresh={() => {
        void deliveriesQuery.refetch();
      }}
    >
      <SectionHeader
        title="Deliveries"
        subtitle="Your assigned delivery packages"
        rightSlot={
          <Badge label={`${payload.length} active`} tone="primary" />
        }
      />

      {payload.length === 0 ? (
        <EmptyState
          title="No deliveries assigned"
          description="New orders will appear here when dispatcher assigns you."
        />
      ) : (
        <FlatList
          data={payload}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => navigation.navigate('DeliveryDetail', { deliveryId: item.id })}
              style={({ pressed }) => [
                styles.card,
                pressed ? styles.cardPressed : null,
              ]}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.orderNumber}>{item.orderNumber}</Text>
                <Badge label={item.status} tone={getStatusTone(item.status)} />
              </View>

              <View style={styles.addressContainer}>
                <Text style={styles.label}>PICKUP</Text>
                <Text style={styles.addressText} numberOfLines={1}>{item.pickupAddress}</Text>

                <View style={styles.connector} />

                <Text style={styles.label}>DROPOFF</Text>
                <Text style={styles.addressText} numberOfLines={1}>{item.dropoffAddress}</Text>
              </View>

              <View style={styles.cardFooter}>
                <Text style={styles.customerName}>To: {item.customerName}</Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.card,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cardPressed: {
    opacity: 0.8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  orderNumber: {
    fontSize: theme.typography.body,
    fontWeight: '700',
    color: theme.colors.text,
  },
  addressContainer: {
    marginVertical: theme.spacing.xs,
  },
  label: {
    fontSize: 9,
    fontWeight: '700',
    color: theme.colors.textMuted,
    letterSpacing: 1,
    marginBottom: 2,
  },
  addressText: {
    fontSize: theme.typography.caption,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  connector: {
    height: 12,
    width: 1,
    backgroundColor: theme.colors.border,
    marginLeft: 8,
    marginVertical: 2,
  },
  cardFooter: {
    marginTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing.sm,
  },
  customerName: {
    fontSize: theme.typography.caption,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
});

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, TextInput, ScrollView } from 'react-native';
import { ScreenContainer } from '../components/screen-container';
import { ErrorState } from '../components/ui/error-state';
import { Badge } from '../components/ui/badge';
import { PrimaryButton, SecondaryButton } from '../components/ui/button';
import { SectionHeader } from '../components/ui/section-header';
import { ListSkeleton } from '../components/ui/skeleton';
import { ApiError, apiFetch } from '../lib/api/client';
import { riderDeliverySchema } from '../lib/api/schemas';
import type { RiderDelivery } from '../lib/types/api';
import type { RiderDeliveriesStackParamList } from '../navigation/navigation.types';
import { theme } from '../theme/tokens';

type DeliveryDetailScreenProps = NativeStackScreenProps<
  RiderDeliveriesStackParamList,
  'DeliveryDetail'
>;

export function DeliveryDetailScreen({ route, navigation }: DeliveryDetailScreenProps) {
  const { deliveryId } = route.params;
  const queryClient = useQueryClient();

  const [simulatedPhoto, setSimulatedPhoto] = useState<string | null>(null);
  const [simulatedSignature, setSimulatedSignature] = useState<string | null>(null);
  const [failureReason, setFailureReason] = useState('');
  const [showFailureInput, setShowFailureInput] = useState(false);

  const deliveryQuery = useQuery({
    queryKey: ['delivery-detail', deliveryId],
    queryFn: () =>
      apiFetch<{ delivery: RiderDelivery }>(
        `/deliveries/${deliveryId}`,
        undefined,
      ),
  });

  const updateStatusMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiFetch<RiderDelivery>(
        `/deliveries/${deliveryId}/status`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['delivery-detail', deliveryId] });
      void queryClient.invalidateQueries({ queryKey: ['rider-deliveries'] });
      setShowFailureInput(false);
    },
  });

  const payload = deliveryQuery.data?.delivery;

  if (deliveryQuery.isLoading) {
    return (
      <ScreenContainer>
        <SectionHeader title="Delivery Detail" subtitle="Loading details..." />
        <ListSkeleton rows={3} />
      </ScreenContainer>
    );
  }

  if (deliveryQuery.isError || !payload) {
    return (
      <ScreenContainer>
        <ErrorState
          title="Delivery not found"
          description="Could not load the specified delivery."
          onRetry={() => {
            void deliveryQuery.refetch();
          }}
        />
      </ScreenContainer>
    );
  }

  const handleUpdateStatus = (status: RiderDelivery['status']) => {
    const body: Record<string, unknown> = { status };
    if (status === 'DELIVERED') {
      body.proofPhotoUrl = simulatedPhoto || 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d';
      body.proofSignature = simulatedSignature || 'Marie Claire (Customer Signature)';
    } else if (status === 'FAILED') {
      body.failureReason = failureReason || 'Customer unreachable';
    }
    updateStatusMutation.mutate(body);
  };

  const getStatusActionLabel = () => {
    switch (payload.status) {
      case 'ASSIGNED': return 'Pick Up Package';
      case 'PICKED_UP': return 'Start Transit';
      case 'IN_TRANSIT': return 'Mark as Delivered';
      default: return null;
    }
  };

  const getNextStatus = (): RiderDelivery['status'] | null => {
    switch (payload.status) {
      case 'ASSIGNED': return 'PICKED_UP';
      case 'PICKED_UP': return 'IN_TRANSIT';
      case 'IN_TRANSIT': return 'DELIVERED';
      default: return null;
    }
  };

  const actionLabel = getStatusActionLabel();
  const nextStatus = getNextStatus();

  return (
    <ScrollView style={styles.container}>
      <SectionHeader
        title={payload.orderNumber}
        subtitle="Delivery detail & actions"
        rightSlot={<Badge label={payload.status} tone="primary" />}
      />

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recipient Information</Text>
        <View style={styles.infoCard}>
          <Text style={styles.infoName}>{payload.customerName}</Text>
          <Text style={styles.infoPhone}>{payload.customerPhone}</Text>
          {payload.notes && (
            <Text style={styles.infoNotes}>Notes: {payload.notes}</Text>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Route Details</Text>
        <View style={styles.infoCard}>
          <Text style={styles.label}>PICKUP ADDRESS</Text>
          <Text style={styles.addressText}>{payload.pickupAddress}</Text>

          <View style={styles.divider} />

          <Text style={styles.label}>DROPOFF ADDRESS</Text>
          <Text style={styles.addressText}>{payload.dropoffAddress}</Text>
        </View>
      </View>

      {/* Proof of Delivery Setup (Interactive) */}
      {payload.status === 'IN_TRANSIT' && !showFailureInput && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Collect Delivery Proof</Text>
          <View style={styles.infoCard}>
            <Pressable
              onPress={() => setSimulatedPhoto('https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d')}
              style={[styles.proofButton, simulatedPhoto ? styles.proofButtonActive : null]}
            >
              <Text style={styles.proofButtonText}>
                {simulatedPhoto ? '✓ Cargo Photo Captured' : '📸 Capture Cargo Photo'}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setSimulatedSignature('Marie Claire (Customer Signature)')}
              style={[styles.proofButton, simulatedSignature ? styles.proofButtonActive : null]}
            >
              <Text style={styles.proofButtonText}>
                {simulatedSignature ? '✓ Signature Pad Signed' : '✍ Collect Customer Signature'}
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Failure Input */}
      {showFailureInput && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Failure Reason</Text>
          <View style={styles.infoCard}>
            <TextInput
              value={failureReason}
              onChangeText={setFailureReason}
              placeholder="e.g. Recipient was unreachable, wrong address..."
              placeholderTextColor={theme.colors.textMuted}
              style={styles.textInput}
            />
            <View style={styles.buttonRow}>
              <SecondaryButton
                label="Cancel"
                onPress={() => setShowFailureInput(false)}
              />
              <PrimaryButton
                label="Submit Failure"
                onPress={() => handleUpdateStatus('FAILED')}
                loading={updateStatusMutation.isPending}
              />
            </View>
          </View>
        </View>
      )}

      {/* Action Buttons */}
      {!showFailureInput && (
        <View style={styles.actionSection}>
          {actionLabel && nextStatus && (
            <View style={styles.buttonSpacing}>
              <PrimaryButton
                label={actionLabel}
                onPress={() => handleUpdateStatus(nextStatus)}
                loading={updateStatusMutation.isPending}
              />
            </View>
          )}

          {payload.status === 'IN_TRANSIT' && (
            <View style={styles.buttonSpacing}>
              <SecondaryButton
                label="Mark Delivery Failed"
                onPress={() => setShowFailureInput(true)}
              />
            </View>
          )}

          <View style={styles.buttonSpacing}>
            <SecondaryButton
              label="Back to Deliveries"
              onPress={() => navigation.goBack()}
            />
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.background,
  },
  section: {
    marginBottom: theme.spacing.xl,
  },
  sectionTitle: {
    fontSize: theme.typography.caption,
    fontWeight: '700',
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: theme.spacing.sm,
  },
  infoCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.card,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  infoName: {
    fontSize: theme.typography.body,
    fontWeight: '700',
    color: theme.colors.text,
  },
  infoPhone: {
    fontSize: theme.typography.caption,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  infoNotes: {
    fontSize: theme.typography.caption,
    color: theme.colors.primary,
    marginTop: theme.spacing.md,
    fontStyle: 'italic',
  },
  label: {
    fontSize: 9,
    fontWeight: '700',
    color: theme.colors.textMuted,
    letterSpacing: 1,
    marginBottom: 4,
  },
  addressText: {
    fontSize: theme.typography.caption,
    color: theme.colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.md,
  },
  proofButton: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.button,
    padding: theme.spacing.md,
    alignItems: 'center',
    marginVertical: theme.spacing.xs,
  },
  proofButtonActive: {
    borderColor: theme.colors.success,
    backgroundColor: theme.colors.success + '10',
  },
  proofButtonText: {
    fontSize: theme.typography.caption,
    fontWeight: '600',
    color: theme.colors.text,
  },
  textInput: {
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.button,
    padding: theme.spacing.md,
    color: theme.colors.text,
    fontSize: theme.typography.caption,
    marginBottom: theme.spacing.md,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: theme.spacing.sm,
  },
  actionSection: {
    marginTop: theme.spacing.xl,
    paddingBottom: theme.spacing.xxl,
  },
  mainActionButton: {
    marginBottom: theme.spacing.md,
  },
  failButton: {
    marginBottom: theme.spacing.md,
    borderColor: theme.colors.danger,
  },
  backButton: {
    borderColor: theme.colors.border,
  },
  buttonSpacing: {
    marginBottom: theme.spacing.md,
  },
});

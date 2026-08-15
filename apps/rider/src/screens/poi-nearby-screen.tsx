import { useQuery } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { z } from 'zod';
import { ScreenContainer } from '../components/screen-container';
import { AppCard } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { EmptyState } from '../components/ui/empty-state';
import { ErrorState } from '../components/ui/error-state';
import { ListItem } from '../components/ui/list-item';
import { PrimaryButton, SecondaryButton } from '../components/ui/button';
import { SectionHeader } from '../components/ui/section-header';
import { ListSkeleton } from '../components/ui/skeleton';
import { ApiError, apiFetch } from '../lib/api/client';
import { buildQueryString } from '../lib/api/query-string';
import { nearbyPoiSchema } from '../lib/api/schemas';
import { logAppError } from '../lib/monitoring/error-log';
import type { NearbyPoi, PoiType } from '../lib/types/api';
import { theme } from '../theme/tokens';
import { useAuth } from '../lib/auth/auth-context';
import { useLanguage } from '../lib/i18n/language-context';
import { PendingSetupGate } from '../components/pending-setup-gate';

const POI_TYPES: PoiType[] = ['SWAP', 'GARAGE', 'CLINIC', 'OTHER'];
const POI_ICONS: Record<PoiType, string> = { SWAP: '🔋', GARAGE: '🔧', CLINIC: '🏥', OTHER: '📍' };
const DEFAULT_RADIUS_KM = 25;
const DEFAULT_LIMIT = 50;

// Requests foreground location permission and reads current rider coordinates.
async function fetchCurrentLocation(): Promise<{
  lat: number;
  lng: number;
} | null> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== 'granted') {
    return null;
  }

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });

  return {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
  };
}

// Opens phone dialer for POI contact actions when a phone number is available.
async function openPhoneDialer(phone: string): Promise<void> {
  const dialLink = `tel:${phone}`;
  const canOpen = await Linking.canOpenURL(dialLink);
  if (canOpen) {
    await Linking.openURL(dialLink);
  }
}

// Opens the default maps app using a simple destination-only directions URL.
async function openDirections(poi: NearbyPoi): Promise<void> {
  const directionsLink = `https://www.google.com/maps/dir/?api=1&destination=${poi.lat},${poi.lng}`;
  const canOpen = await Linking.canOpenURL(directionsLink);
  if (canOpen) {
    await Linking.openURL(directionsLink);
  }
}

// Retrieves and filters nearby POIs around current rider coordinates.
export function PoiNearbyScreen() {
  const auth = useAuth();
  const { t } = useLanguage();
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [selectedType, setSelectedType] = useState<PoiType>('SWAP');
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isResolvingLocation, setIsResolvingLocation] = useState(false);

  // Loads current device GPS coordinates before querying nearby POIs.
  const resolveLocation = async (): Promise<void> => {
    setLocationError(null);
    setIsResolvingLocation(true);
    try {
      const nextCoordinates = await fetchCurrentLocation();
      if (!nextCoordinates) {
        setLocationError('Location permission is required to show the closest garages, swap stations, and clinics.');
        return;
      }

      setCoordinates(nextCoordinates);
    } catch (error: unknown) {
      logAppError('rider.poi_location_failed', error, {
        feature: 'poi',
        operation: 'resolveLocation',
      });
      setLocationError('Unable to read your current location right now.');
    } finally {
      setIsResolvingLocation(false);
    }
  };

  const poiQuery = useQuery({
    queryKey: ['rider-poi-nearby', coordinates?.lat, coordinates?.lng, selectedType],
    enabled: Boolean(coordinates),
    queryFn: () => {
      if (!coordinates) {
        return Promise.resolve([] as NearbyPoi[]);
      }

      return apiFetch<NearbyPoi[]>(
        `/rider/poi/near${buildQueryString({
          lat: coordinates.lat,
          lng: coordinates.lng,
          type: selectedType,
          radiusKm: DEFAULT_RADIUS_KM,
          limit: DEFAULT_LIMIT,
        })}`,
        undefined,
        {
          schema: z.array(nearbyPoiSchema),
        },
      );
    },
  });

  if (poiQuery.isError) {
    logAppError('rider.poi_nearby_failed', poiQuery.error, {
      feature: 'poi',
      operation: 'listNearby',
      status: poiQuery.error instanceof ApiError ? poiQuery.error.status : undefined,
    });
  }

  const rows = poiQuery.data ?? [];

  if (auth.riderMe?.status === 'PENDING_SETUP') {
    return (
      <ScreenContainer
        refreshing={poiQuery.isRefetching || isResolvingLocation}
        onRefresh={() => {
          void auth.refreshRiderMe();
        }}
      >
        <PendingSetupGate
          isRefetching={poiQuery.isRefetching || isResolvingLocation}
          onRefresh={() => {
            void auth.refreshRiderMe();
          }}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer
      refreshing={poiQuery.isRefetching || isResolvingLocation}
      onRefresh={() => {
        if (coordinates) {
          void poiQuery.refetch();
          return;
        }
        void resolveLocation();
      }}
    >
      <SectionHeader
        title={t.nearby.title}
        subtitle={t.nearby.searchPlaceholder}
      />

      <AppCard title={`📍 ${t.nearby.locationSection}`} tone="accent">
        <PrimaryButton
          label={isResolvingLocation ? t.nearby.gettingLocation : coordinates ? t.nearby.refreshLocation : t.nearby.getLocation}
          loading={isResolvingLocation}
          onPress={() => {
            void resolveLocation();
          }}
        />
        {coordinates ? (
          <Badge
            label={`${DEFAULT_RADIUS_KM} km`}
            tone="success"
          />
        ) : null}
        {locationError ? (
          <ErrorState
            title={t.common.error}
            description={locationError}
            retryLabel={t.common.retry}
            onRetry={() => {
              void resolveLocation();
            }}
          />
        ) : null}
      </AppCard>

      <AppCard title="Filter" subtitle="Switch between garages, swap points, and clinics.">
        <View style={styles.typeRow}>
          {POI_TYPES.map((poiType) => (
            <Pressable
              key={poiType}
              accessibilityRole="button"
              onPress={() => setSelectedType(poiType)}
              style={({ pressed }) => [
                styles.typeChip,
                selectedType === poiType ? styles.typeChipActive : null,
                pressed ? styles.typeChipPressed : null,
              ]}
            >
              <Text style={styles.typeIcon}>{POI_ICONS[poiType]}</Text>
              <Text
                style={[
                  styles.typeChipText,
                  selectedType === poiType ? styles.typeChipTextActive : null,
                ]}
              >
                {poiType}
              </Text>
            </Pressable>
          ))}
        </View>
      </AppCard>

      {!coordinates && !isResolvingLocation && !locationError ? (
        <EmptyState
          title="Turn on location to start"
          description="We only request foreground location so the closest help points appear first."
          action={
            <PrimaryButton
              label="Allow location"
              onPress={() => {
                void resolveLocation();
              }}
            />
          }
        />
      ) : null}

      {coordinates && poiQuery.isLoading ? <ListSkeleton rows={4} /> : null}

      {coordinates && !poiQuery.isLoading && rows.length === 0 ? (
        <EmptyState
          title="No nearby places found"
          description="Try another filter or refresh your location to search again."
          action={
            <SecondaryButton
              label="Refresh search"
              onPress={() => {
                void poiQuery.refetch();
              }}
            />
          }
        />
      ) : null}

      {rows.length > 0 ? (
        <AppCard
          title="Closest results"
          subtitle="Sorted by distance from your current position."
        >
          <View style={styles.resultStack}>
            {rows.map((poi) => {
              const contactPhone = poi.phone;

              return (
                <View key={poi.id} style={styles.poiCard}>
                  <ListItem
                    title={poi.name}
                    subtitle={poi.address ?? `${poi.lat.toFixed(4)}, ${poi.lng.toFixed(4)}`}
                    meta={`${poi.type} | ${poi.distanceKm.toFixed(2)} km away`}
                    rightSlot={<Badge label={poi.type} tone="primary" />}
                  />
                  <View style={styles.poiActions}>
                    <View style={styles.poiActionButton}>
                      <PrimaryButton
                        label="Directions"
                        onPress={() => {
                          void openDirections(poi).catch((error: unknown) => {
                            logAppError('rider.poi_directions_failed', error, {
                              feature: 'poi',
                              operation: 'directions',
                            });
                          });
                        }}
                      />
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </AppCard>
      ) : null}

      {poiQuery.isError ? (
        <ErrorState
          title="Nearby places are unavailable"
          description="The search did not complete. Try again after refreshing your location."
          retryLabel="Retry nearby search"
          onRetry={() => {
            if (coordinates) {
              void poiQuery.refetch();
              return;
            }
            void resolveLocation();
          }}
        />
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  typeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  typeChip: {
    minWidth: 90,
    minHeight: 44,
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
  },
  typeChipActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primarySoft,
  },
  typeChipPressed: {
    backgroundColor: theme.colors.surfaceMuted,
  },
  typeIcon: {
    fontSize: 16,
  },
  typeChipText: {
    fontSize: theme.typography.body,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  typeChipTextActive: {
    color: theme.colors.primary,
  },
  resultStack: {
    gap: theme.spacing.sm,
  },
  poiCard: {
    gap: theme.spacing.sm,
  },
  poiActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  poiActionButton: {
    flex: 1,
  },
});

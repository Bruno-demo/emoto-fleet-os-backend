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

const POI_TYPES: PoiType[] = ['GARAGE', 'SWAP', 'CLINIC'];
const DEFAULT_RADIUS_KM = 5;
const DEFAULT_LIMIT = 20;

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
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [selectedType, setSelectedType] = useState<PoiType>('GARAGE');
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
        title="Nearby"
        subtitle="Find garages, battery swaps, and clinics close to your current position."
      />

      <AppCard title="Location access" subtitle="Use your current GPS so the app can sort help points by distance.">
        <PrimaryButton
          label={isResolvingLocation ? 'Getting location...' : coordinates ? 'Refresh location' : 'Use current location'}
          loading={isResolvingLocation}
          onPress={() => {
            void resolveLocation();
          }}
        />
        {coordinates ? (
          <Badge
            label={`Searching within ${DEFAULT_RADIUS_KM} km`}
            tone="success"
          />
        ) : null}
        {locationError ? (
          <ErrorState
            title="Location needed"
            description={locationError}
            retryLabel="Try location again"
            onRetry={() => {
              void resolveLocation();
            }}
          />
        ) : null}
      </AppCard>

      <AppCard title="Filter" subtitle="Switch between the closest garages, swap points, and clinics.">
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
                    {contactPhone ? (
                      <View style={styles.poiActionButton}>
                        <SecondaryButton
                          label="Call"
                          onPress={() => {
                            void openPhoneDialer(contactPhone).catch((error: unknown) => {
                              logAppError('rider.poi_call_failed', error, {
                                feature: 'poi',
                                operation: 'call',
                              });
                            });
                          }}
                        />
                      </View>
                    ) : null}
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
    minWidth: 84,
    minHeight: 40,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeChipActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primarySoft,
  },
  typeChipPressed: {
    backgroundColor: theme.colors.surfaceMuted,
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

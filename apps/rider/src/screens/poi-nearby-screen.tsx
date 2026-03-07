import { useQuery } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { z } from 'zod';
import { LoadingState } from '../components/loading-state';
import { ScreenContainer } from '../components/screen-container';
import { ApiError, apiFetch } from '../lib/api/client';
import { buildQueryString } from '../lib/api/query-string';
import { nearbyPoiSchema } from '../lib/api/schemas';
import { logAppError } from '../lib/monitoring/error-log';
import type { NearbyPoi, PoiType } from '../lib/types/api';

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
        setLocationError('Location permission is required to fetch nearby POIs');
        return;
      }

      setCoordinates(nextCoordinates);
    } catch (error: unknown) {
      logAppError('rider.poi_location_failed', error, {
        feature: 'poi',
        operation: 'resolveLocation',
      });
      setLocationError('Unable to get current location');
    } finally {
      setIsResolvingLocation(false);
    }
  };

  useEffect(() => {
    void resolveLocation();
  }, []);

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
      onRefresh={() => void resolveLocation()}
    >
      <Text style={styles.title}>Nearby POIs</Text>
      <Text style={styles.subtitle}>
        Find nearby garages, swap stations, and clinics using your current GPS.
      </Text>

      <Pressable
        style={styles.locationButton}
        disabled={isResolvingLocation}
        onPress={() => void resolveLocation()}
      >
        {isResolvingLocation ? (
          <ActivityIndicator size="small" color="#111827" />
        ) : (
          <Text style={styles.locationButtonText}>Refresh Location</Text>
        )}
      </Pressable>

      <View style={styles.typeRow}>
        {POI_TYPES.map((poiType) => (
          <Pressable
            key={poiType}
            style={[
              styles.typeButton,
              selectedType === poiType ? styles.typeButtonActive : null,
            ]}
            onPress={() => setSelectedType(poiType)}
          >
            <Text
              style={[
                styles.typeButtonText,
                selectedType === poiType ? styles.typeButtonTextActive : null,
              ]}
            >
              {poiType}
            </Text>
          </Pressable>
        ))}
      </View>

      {locationError ? <Text style={styles.errorText}>{locationError}</Text> : null}

      {poiQuery.isLoading ? (
        <LoadingState message="Loading nearby POIs..." />
      ) : rows.length === 0 ? (
        <Text style={styles.emptyText}>
          {coordinates
            ? 'No nearby POIs found for the selected type.'
            : 'Location permission is required to load nearby POIs.'}
        </Text>
      ) : (
        rows.map((poi) => {
          const contactPhone = poi.phone;

          return (
            <View key={poi.id} style={styles.poiCard}>
            <Text style={styles.poiTitle}>{poi.name}</Text>
            <Text style={styles.poiMeta}>
              {poi.type} | {poi.distanceKm.toFixed(2)} km
            </Text>
            <Text style={styles.poiMeta}>
              {poi.address ?? `${poi.lat.toFixed(4)}, ${poi.lng.toFixed(4)}`}
            </Text>
            {contactPhone ? (
              <Pressable
                style={styles.callButton}
                onPress={() => {
                  void openPhoneDialer(contactPhone).catch((error: unknown) => {
                    logAppError('rider.poi_call_failed', error, {
                      feature: 'poi',
                      operation: 'call',
                    });
                  });
                }}
              >
                <Text style={styles.callButtonText}>Call</Text>
              </Pressable>
            ) : null}
          </View>
          );
        })
      )}
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
  locationButton: {
    borderWidth: 1,
    borderColor: '#d0d7de',
    borderRadius: 10,
    backgroundColor: '#ffffff',
    paddingVertical: 11,
    alignItems: 'center',
  },
  locationButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  typeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  typeButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d0d7de',
    borderRadius: 999,
    backgroundColor: '#ffffff',
    paddingVertical: 8,
    alignItems: 'center',
  },
  typeButtonActive: {
    backgroundColor: '#1d4ed8',
    borderColor: '#1d4ed8',
  },
  typeButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
  },
  typeButtonTextActive: {
    color: '#ffffff',
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 13,
    fontWeight: '600',
  },
  emptyText: {
    borderWidth: 1,
    borderColor: '#d0d7de',
    borderRadius: 12,
    backgroundColor: '#ffffff',
    padding: 14,
    color: '#4b5563',
  },
  poiCard: {
    borderWidth: 1,
    borderColor: '#d0d7de',
    borderRadius: 12,
    backgroundColor: '#ffffff',
    padding: 14,
    gap: 4,
  },
  poiTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  poiMeta: {
    fontSize: 13,
    color: '#374151',
  },
  callButton: {
    marginTop: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1d4ed8',
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: '#eff6ff',
  },
  callButtonText: {
    color: '#1d4ed8',
    fontSize: 13,
    fontWeight: '700',
  },
});

'use client';

import { useEffect, useState } from 'react';

export interface LocationLandmark {
  name: string;
  lat: number;
  lng: number;
  district?: string;
}

// Major Rwanda landmarks & hubs for instant offline lookup
export const KNOWN_LANDMARKS: LocationLandmark[] = [
  { name: 'Giporoso', lat: -1.9546, lng: 30.1171, district: 'Remera' },
  { name: 'Sonatube', lat: -1.9682, lng: 30.0881, district: 'Kicukiro' },
  { name: 'Nyamirambo', lat: -1.9861, lng: 30.0483, district: 'Nyarugenge' },
  { name: 'Nyabugogo', lat: -1.9392, lng: 30.0448, district: 'Nyarugenge' },
  { name: 'Kimironko', lat: -1.9423, lng: 30.1264, district: 'Gasabo' },
  { name: 'Kacyiru', lat: -1.9365, lng: 30.0825, district: 'Gasabo' },
  { name: 'Gikondo', lat: -1.9721, lng: 30.0682, district: 'Kicukiro' },
  { name: 'Kibagabaga', lat: -1.9304, lng: 30.1112, district: 'Gasabo' },
  { name: 'Gisozi', lat: -1.9213, lng: 30.0624, district: 'Gasabo' },
  { name: 'Downtown Kigali', lat: -1.9482, lng: 30.0601, district: 'Nyarugenge' },
  { name: 'Kanombe / Airport', lat: -1.9675, lng: 30.1342, district: 'Kicukiro' },
  { name: 'Gatenga', lat: -1.9882, lng: 30.0814, district: 'Kicukiro' },
  { name: 'Nyarutarama', lat: -1.9388, lng: 30.1001, district: 'Gasabo' },
  { name: 'Kagugu', lat: -1.9102, lng: 30.0854, district: 'Gasabo' },
  { name: 'Batsinda', lat: -1.8953, lng: 30.0762, district: 'Gasabo' },
  { name: 'Masaka', lat: -1.9951, lng: 30.2003, district: 'Kicukiro' },
  { name: 'Bweramvura', lat: -1.8701, lng: 30.0302, district: 'Gasabo' },
  { name: 'Ruyenzi', lat: -1.9701, lng: 29.9802, district: 'Kamonyi' },
  { name: 'Rwamagana', lat: -1.9486, lng: 30.4347, district: 'Rwamagana' },
  { name: 'Musanze', lat: -1.4983, lng: 29.6346, district: 'Musanze' },
  { name: 'Rubavu', lat: -1.6967, lng: 29.2564, district: 'Rubavu' },
  { name: 'Huye', lat: -2.5967, lng: 29.7397, district: 'Huye' },
];

/**
 * Calculates distance in kilometers between two lat/lng points using Haversine formula.
 */
function getHaversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Gets the closest landmark name instantly for any lat/lng.
 */
export function getFastLandmarkName(lat?: number | null, lng?: number | null): string {
  if (lat == null || lng == null || isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) {
    return 'Location unavailable';
  }

  let closestLandmark = KNOWN_LANDMARKS[0];
  let minDistance = getHaversineDistanceKm(lat, lng, closestLandmark.lat, closestLandmark.lng);

  for (let i = 1; i < KNOWN_LANDMARKS.length; i++) {
    const dist = getHaversineDistanceKm(lat, lng, KNOWN_LANDMARKS[i].lat, KNOWN_LANDMARKS[i].lng);
    if (dist < minDistance) {
      minDistance = dist;
      closestLandmark = KNOWN_LANDMARKS[i];
    }
  }

  if (minDistance <= 2.5) {
    return closestLandmark.name;
  }
  if (minDistance <= 10) {
    return `${closestLandmark.name} (${minDistance < 1 ? Math.round(minDistance * 1000) + 'm' : minDistance.toFixed(1) + 'km'})`;
  }

  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

// In-memory cache for Nominatim reverse geocode results
const geocodeCache = new Map<string, string>();

/**
 * Custom React hook to resolve human-readable location names (e.g. Giporoso, Sonatube, Nyamirambo)
 * with instant offline landmark matching + background OSM reverse geocoding.
 */
export function useLocationName(lat?: number | null, lng?: number | null): string {
  const fastName = getFastLandmarkName(lat, lng);
  const cacheKey =
    lat != null && lng != null && !isNaN(lat) && !isNaN(lng) && !(lat === 0 && lng === 0)
      ? `${lat.toFixed(3)}_${lng.toFixed(3)}`
      : null;

  const cachedName = cacheKey ? geocodeCache.get(cacheKey) ?? null : null;
  const [geoName, setGeoName] = useState<string | null>(cachedName);

  useEffect(() => {
    if (!cacheKey) return;
    if (geocodeCache.has(cacheKey)) return;

    let isMounted = true;
    const fetchAddress = async () => {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16`,
          {
            headers: {
              'Accept-Language': 'en',
            },
          },
        );

        if (!response.ok) return;

        const data = await response.json();
        const address = data?.address;

        if (address) {
          const area =
            address.suburb ||
            address.neighbourhood ||
            address.quarter ||
            address.residential ||
            address.village ||
            address.city_district ||
            address.town ||
            address.road;

          if (area) {
            const result = String(area);
            geocodeCache.set(cacheKey, result);
            if (isMounted) {
              setGeoName(result);
            }
          }
        }
      } catch {
        // Fallback to fast Haversine landmark name on network timeout or offline
      }
    };

    const timer = setTimeout(fetchAddress, 300);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [cacheKey, lat, lng]);

  return cachedName ?? geoName ?? fastName;
}

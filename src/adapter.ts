import type { TideForecastResult, TideExtreme } from './types.js';
import { approximateTideHeightAt } from './calculations.js';

export interface TideFeatureProperties {
    name: string;
    source: string;
    datum: string;
    units: string;
    date: string;
    extremes: TideExtreme[];
    heightNow: number | null;
    timestamp: string;
}

export interface TideFeature {
    type: 'Feature';
    geometry: {
        type: 'Point';
        coordinates: [number, number];
    };
    properties: TideFeatureProperties;
}

export type TideResourceCollection = Record<string, TideFeature>;

/**
 * Builds a deterministic resource URN from a station identifier and a date.
 */
function buildResourceId(stationName: string, date: string): string {
    const slug = stationName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return `urn:mrn:signalk:uuid:tides:${slug}:${date}`;
}

/**
 * Groups tide extremes by calendar date (UTC).
 */
function groupByDate(extremes: TideExtreme[]): Map<string, TideExtreme[]> {
    const groups = new Map<string, TideExtreme[]>();
    for (const extreme of extremes) {
        const date = extreme.time.slice(0, 10);
        const existing = groups.get(date);
        if (existing) {
            existing.push(extreme);
        } else {
            groups.set(date, [extreme]);
        }
    }
    return groups;
}

/**
 * Converts a TideForecastResult into a SignalK Resources API compatible
 * collection of GeoJSON Features, one per day.
 */
export function toResourceCollection(
    forecast: TideForecastResult,
    sourceId: string,
    now: Date = new Date()
): TideResourceCollection {
    const collection: TideResourceCollection = {};
    const byDate = groupByDate(forecast.extremes);

    for (const [date, extremes] of byDate) {
        const id = buildResourceId(forecast.station.name, date);
        const isToday = date === now.toISOString().slice(0, 10);

        collection[id] = {
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [forecast.station.position.longitude, forecast.station.position.latitude],
            },
            properties: {
                name: forecast.station.name,
                source: sourceId,
                datum: 'CD',
                units: 'm',
                date,
                extremes,
                heightNow: isToday ? approximateTideHeightAt(forecast.extremes, now) : null,
                timestamp: now.toISOString(),
            },
        };
    }

    return collection;
}

/**
 * Returns a single TideFeature by resource id from a forecast result.
 */
export function toSingleResource(
    forecast: TideForecastResult,
    resourceId: string,
    sourceId: string,
    now: Date = new Date()
): TideFeature | null {
    const collection = toResourceCollection(forecast, sourceId, now);
    return collection[resourceId] ?? null;
}

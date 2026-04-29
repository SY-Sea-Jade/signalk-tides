import type { SignalKApp, TideForecastParams, TideForecastResult, TideSource } from "../types.js";
import { getDistance } from "geolib";
import moment from 'moment';

interface ShomHarbor {
    cst: string;
    name: string;
    latitude: number;
    longitude: number;
}

interface ShomHltEntry {
    dt: string;
    hauteur: number;
    type: string;
}

interface ShomHarborRaw {
    cst: string;
    name?: string;
    libelle?: string;
    latitude: string;
    longitude: string;
}

type ShomApiResponse = { hlt?: ShomHltEntry[]; data?: ShomHltEntry[] } | ShomHltEntry[];

const HARBORS_URL = 'https://services.data.shom.fr/spm/harbors';

async function fetchHarbors(apiKey: string): Promise<ShomHarbor[]> {
    const url = new URL(HARBORS_URL);
    url.searchParams.set('apikey', apiKey);
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`SHOM harbor list failed: ${res.status} ${res.statusText}`);
    const data = await res.json() as ShomHarborRaw[];
    return data.map((h) => ({
        cst: h.cst,
        name: h.name || h.libelle || h.cst,
        latitude: parseFloat(h.latitude),
        longitude: parseFloat(h.longitude),
    }));
}

function closestHarbor(harbors: ShomHarbor[], position: { latitude: number; longitude: number }): ShomHarbor {
    let best = harbors[0];
    let bestDist = Infinity;
    for (const harbor of harbors) {
        const dist = getDistance(position, { latitude: harbor.latitude, longitude: harbor.longitude });
        if (dist < bestDist) {
            bestDist = dist;
            best = harbor;
        }
    }
    return best;
}

export default function (app: SignalKApp): TideSource {
  return {
    id: 'shom',
    title: 'SHOM',
    properties: {
      shomApiKey: {
        type: 'string',
        title: 'SHOM API Key'
      }
    },

    start({ shomApiKey } = {}) {
      app.debug("Using SHOM API");

      let cachedHarbors: ShomHarbor[] | null = null;

      return async ({ position, date = moment().toISOString() }: TideForecastParams): Promise<TideForecastResult> => {
        if (!shomApiKey) {
            throw new Error('SHOM API Key not configured');
        }

        if (!cachedHarbors) {
            app.debug('SHOM: fetching harbor list');
            cachedHarbors = await fetchHarbors(shomApiKey);
            app.debug(`SHOM: loaded ${cachedHarbors.length} harbors`);
        }

        const harbor = closestHarbor(cachedHarbors, position);
        app.debug(`SHOM: closest harbor is ${harbor.name} (${harbor.cst})`);

        const startDate = moment(date).format('YYYY-MM-DD');
        const endDate = moment(date).add(7, 'days').format('YYYY-MM-DD');

        const url = new URL('https://services.data.shom.fr/spm/hlt');
        url.searchParams.set('harborName', harbor.cst);
        url.searchParams.set('duration', 'week');
        url.searchParams.set('datref', startDate);
        url.searchParams.set('nbDays', '7');
        url.searchParams.set('apikey', shomApiKey);

        app.debug(`SHOM: fetching tides from ${url.toString().replace(shomApiKey, '***')}`);

        const response = await fetch(url.toString());

        if (!response.ok) {
            throw new Error(`SHOM API request failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json() as any;
        app.debug('SHOM response: ' + JSON.stringify(data, null, 2));

        const rawEntries: ShomHltEntry[] = data.hlt || data.data || data || [];

        const extremes = [];
        for (const item of rawEntries) {
            let type: "High" | "Low" | null = null;
            const rawType = (item.type || '').toUpperCase();
            if (rawType === 'PM' || rawType === 'HIGH' || rawType === 'HW') type = 'High';
            if (rawType === 'BM' || rawType === 'LOW' || rawType === 'LW') type = 'Low';

            if (type && item.dt) {
                extremes.push({
                    type,
                    value: item.hauteur ?? 0,
                    time: new Date(item.dt).toISOString(),
                });
            }
        }

        extremes.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

        const filtered = extremes.filter(e => {
            const t = new Date(e.time);
            return t >= new Date(startDate) && t <= new Date(endDate + 'T23:59:59Z');
        });

        return {
          station: {
            name: `${harbor.name} (SHOM)`,
            position: {
              latitude: harbor.latitude,
              longitude: harbor.longitude,
            },
          },
          extremes: filtered,
        };
      };
    }
  }
}

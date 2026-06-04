import type { SignalKApp, TideForecastParams, TideForecastResult, TideSource, StormGlassDatum } from "../types.js";
import type { StormGlassApiResponse } from "../types/stormglass.js";
import moment from 'moment';

export default function (app: SignalKApp): TideSource {
  return {
    id: 'stormglass',
    title: 'StormGlass.io',
    properties: {
      stormglassApiKey: {
        type: 'string',
        title: 'StormGlass.io API key'
      },
      stormglassDatum: {
        type: 'string',
        title: 'StormGlass.io datum',
        enum: ['MLLW', 'MSL'] satisfies StormGlassDatum[],
        enumNames: ['MLLW (Mean Lower Low Water)', 'MSL (Mean Sea Level)'],
        default: 'MSL'
      }
    },

    start({ stormglassApiKey, stormglassDatum = 'MSL' } = {}) {
      app.debug("Using StormGlass.io API");

      return async ({ position, date = moment().subtract(1, "days").toISOString() }: TideForecastParams): Promise<TideForecastResult> => {
        const endPoint = new URL("https://api.stormglass.io/v2/tide/extremes/point");

        endPoint.search = new URLSearchParams({
          start: moment(date).format("YYYY-MM-DD"),
          end: moment(date).add(7, "days").format("YYYY-MM-DD"),
          datum: stormglassDatum,
          lat: position.latitude.toString(),
          lng: position.longitude.toString()
        }).toString();

        app.debug("Fetching StormGlass.io: " + endPoint.toString());

        const res = await fetch(endPoint, {
          headers: { Authorization: stormglassApiKey ?? '' },
        });

        if (!res.ok) throw new Error('Failed to fetch StormGlass.io: ' + res.statusText);

        const data = await res.json() as StormGlassApiResponse;
        if (app.debug.enabled) {
          app.debug(JSON.stringify(data, null, 2));
        }

        return {
          station: {
            name: `${data.meta.station.name} (${data.meta.station.source})`,
            position: {
              latitude: data.meta.station.lat,
              longitude: data.meta.station.lng,
            },
          },
          extremes: data.data.map(({ type, time, height }) => {
            return {
              type: type === "high" ? "High" : "Low",
              value: height,
              time: new Date(time).toISOString(),
            };
          }),
        };
      };
    }
  }
}

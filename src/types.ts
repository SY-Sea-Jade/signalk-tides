import { Position, ServerAPI } from "@signalk/server-api";

// ServerAPI types debug as a plain function but the underlying debug package
// exposes .enabled, which we use to guard expensive JSON.stringify calls.
export type SignalKApp = Omit<ServerAPI, 'debug'> & {
  debug: ServerAPI['debug'] & { enabled: boolean };
};

export type OptionalPromise<T> = T | Promise<T>;

export type TideExtremeType = "High" | "Low";

export interface TideForecastParams {
  position: Omit<Position, "altitude">;
  date?: string;
}

export interface TideExtreme {
  time: string;
  value: number;
  type: TideExtremeType;
}

export interface TideForecastResult {
  station: {
    name: string;
    position: {
      latitude: number;
      longitude: number;
    };
  }
  extremes: TideExtreme[];
}

export type TideForecastFunction = (params: TideForecastParams) => OptionalPromise<TideForecastResult>;

export interface TideSource {
  id: string;
  title: string;
  start: (props: Config) => OptionalPromise<TideForecastFunction>;
  properties?: unknown; // TODO: use schema?
}

export type StormGlassDatum = 'MLLW' | 'MSL';

export type Config = {
  source?: string;
  period?: number;
  worldtidesApiKey?: string;
  stormglassApiKey?: string;
  localTidesPath?: string;
  shomApiKey?: string;
  stormglassDatum?: StormGlassDatum;
};

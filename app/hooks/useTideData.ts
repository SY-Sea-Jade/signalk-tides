import { useEffect, useState } from "react";

const { VITE_SIGNALK_URL = window.location.toString() } = import.meta.env;
export const API_URL = new URL("/signalk/v2/api/tides/extremes", VITE_SIGNALK_URL).toString();
export const SETTINGS_URL = new URL("/#/serverConfiguration/plugins/tides", VITE_SIGNALK_URL).toString();

export interface TideExtreme {
  time: string;
  level: number;
  high: boolean;
  low: boolean;
  label: string;
}

export interface TideStation {
  name: string;
  latitude: number;
  longitude: number;
}

export interface TideExtremesResult {
  station: TideStation;
  extremes: TideExtreme[];
}

export function useTideData() {
  const [data, setData] = useState<TideExtremesResult>()

  useEffect(() => {
    (async () => {
      const res = await fetch(API_URL);
      setData(await res.json());
    })()
  }, []);

  return data;
}

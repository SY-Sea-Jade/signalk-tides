import { Router } from "express";
import { openapi } from "@neaps/api";
import { approximateTideHeightAt } from "./calculations.js";
import type { TideExtreme, TideForecastFunction } from "./types.js";

/**
 * Create Express routes that implement a @neaps/api-compatible API
 * backed by the given tide forecast provider.
 */
export function createAdapterRoutes(provider: TideForecastFunction) {
  const router = Router();

  router.get("/openapi.json", (_req, res) => {
    res.json(openapi);
  });

  router.get("/extremes", async (req, res) => {
    const { latitude, longitude, start, end } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({ message: "latitude and longitude are required" });
    }

    try {
      const result = await provider({
        position: {
          latitude: Number(latitude),
          longitude: Number(longitude),
        },
        date: start ? String(start) : undefined,
      });

      const extremes = filterByTimeRange(result.extremes, start, end);

      res.json({
        station: result.station,
        extremes: extremes.map(toNeapsExtreme),
      });
    } catch (error: unknown) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  router.get("/timeline", async (req, res) => {
    const { latitude, longitude, start, end } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({ message: "latitude and longitude are required" });
    }

    try {
      const result = await provider({
        position: {
          latitude: Number(latitude),
          longitude: Number(longitude),
        },
        date: start ? String(start) : undefined,
      });

      const startTime = start ? new Date(String(start)) : new Date();
      const endTime = end
        ? new Date(String(end))
        : new Date(startTime.getTime() + 7 * 24 * 60 * 60 * 1000);

      const timeline = generateTimeline(result.extremes, startTime, endTime);

      res.json({
        station: result.station,
        timeline,
      });
    } catch (error: unknown) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Station endpoints are not supported by non-neaps sources
  router.get("/stations", (_req, res) => {
    res.status(501).json({ message: "Station discovery is not supported by this data source" });
  });

  router.get("/stations/:source/:id", (_req, res) => {
    res.status(501).json({ message: "Station lookup is not supported by this data source" });
  });

  router.get("/stations/:source/:id/extremes", (_req, res) => {
    res.status(501).json({ message: "Station lookup is not supported by this data source" });
  });

  router.get("/stations/:source/:id/timeline", (_req, res) => {
    res.status(501).json({ message: "Station lookup is not supported by this data source" });
  });

  return router;
}

/** Convert a TideExtreme to the @neaps/api extreme format */
function toNeapsExtreme(e: TideExtreme) {
  return {
    time: e.time,
    level: e.value,
    high: e.type === "High",
    low: e.type === "Low",
    label: e.type,
  };
}

function filterByTimeRange(
  extremes: TideExtreme[],
  start: unknown,
  end: unknown
) {
  let filtered = extremes;
  if (start) {
    const startTime = new Date(String(start)).getTime();
    filtered = filtered.filter((e) => new Date(e.time).getTime() >= startTime);
  }
  if (end) {
    const endTime = new Date(String(end)).getTime();
    filtered = filtered.filter((e) => new Date(e.time).getTime() <= endTime);
  }
  return filtered;
}

/**
 * Generate a timeline of water levels at regular intervals by interpolating
 * between known extremes using sine-eased approximation.
 */
function generateTimeline(
  extremes: TideExtreme[],
  start: Date,
  end: Date,
  intervalMinutes = 10
) {
  const timeline: { time: string; level: number }[] = [];
  const intervalMs = intervalMinutes * 60 * 1000;

  for (let t = start.getTime(); t <= end.getTime(); t += intervalMs) {
    const time = new Date(t);
    try {
      const level = approximateTideHeightAt(extremes, time);
      if (level !== null) {
        timeline.push({ time: time.toISOString(), level });
      }
    } catch {
      // Skip points outside the range of known extremes
    }
  }

  return timeline;
}

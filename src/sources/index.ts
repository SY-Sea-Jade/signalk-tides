import { SignalKApp, TideSource } from "../types.js";
import local from "./local.js";
import neaps from "./neaps.js";
import noaa from "./noaa.js";
import stormglass from "./stormglass.js";
import worldtides from "./worldtides.js";
import shom from "./shom.js";

export default function createSources(app: SignalKApp): TideSource[] {
  // Prefer local tide files as the default source when available
  return [local, neaps, noaa, stormglass, worldtides, shom].map((s) => s(app));
}
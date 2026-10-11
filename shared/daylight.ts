// Solar position for the island, following the NOAA solar calculator approximations.
const RAD = Math.PI / 180;
const smooth = (a: number, b: number, v: number) => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export type DayPhase = 'Night' | 'Morning' | 'Day' | 'Sunset';

export interface Daylight {
  elevation: number;
  daylight: number; // 0 night .. 1 full day
  golden: number; // strength of warm sunrise/sunset light
  night: number; // 1 at night
  phase: DayPhase;
  sun: { x: number; y: number; z: number };
}

export function computeDaylight(date: Date, latitude: number, longitude: number): Daylight {
  const year = date.getUTCFullYear();
  const daysInYear = (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / 864e5;
  const dayOfYear = (Date.UTC(year, date.getUTCMonth(), date.getUTCDate()) - Date.UTC(year, 0, 1)) / 864e5 + 1;
  const hours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  const gamma = ((2 * Math.PI) / daysInYear) * (dayOfYear - 1 + (hours - 12) / 24);
  const eqTime = 229.18 * (0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma) - 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma));
  const decl = 0.006918 - 0.399912 * Math.cos(gamma) + 0.070257 * Math.sin(gamma) - 0.006758 * Math.cos(2 * gamma) + 0.000907 * Math.sin(2 * gamma) - 0.002697 * Math.cos(3 * gamma) + 0.00148 * Math.sin(3 * gamma);
  const lat = latitude * RAD;
  const trueSolarMinutes = (((hours * 60 + eqTime + 4 * longitude) % 1440) + 1440) % 1440;
  const hourAngle = (trueSolarMinutes / 4 - 180) * RAD;
  const sinEl = Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(hourAngle);
  const east = -Math.cos(decl) * Math.sin(hourAngle);
  const north = Math.cos(lat) * Math.sin(decl) - Math.sin(lat) * Math.cos(decl) * Math.cos(hourAngle);
  const elevation = Math.asin(Math.max(-1, Math.min(1, sinEl))) / RAD;
  const daylight = smooth(-6, 12, elevation);
  const golden = smooth(-7, -1, elevation) * (1 - smooth(8, 27, elevation));
  const night = 1 - smooth(-9, 0, elevation);
  const phase: DayPhase = elevation < -6 ? 'Night' : elevation < 18 ? (hourAngle < 0 ? 'Morning' : 'Sunset') : 'Day';
  // Scene axes: x east, y up, z south (so north is -z).
  return { elevation, daylight, golden, night, phase, sun: { x: east, y: sinEl, z: -north } };
}

export function islandClock(date: Date, timeZone = 'Indian/Maldives'): string {
  try {
    return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone }).format(date);
  } catch {
    return date.toISOString().slice(11, 16);
  }
}

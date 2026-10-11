export interface XZ { x: number; z: number }
export type Pt = [number, number];

export interface Island {
  id: string; osmId: number; name: string; nameDv: string; main: boolean; kind: string; areaM2: number;
  x: number; z: number; points: Pt[]; bbox: [number, number, number, number]; inhabited: boolean; note: string; source: string;
}
export interface Road { id: string; kind: string; name: string; nameDv: string; surface: string; width: number; island: string; points: Pt[]; source: string }
export interface Building { id: string; name: string; kind: string; street: string; city: string; island: string; height: number; areaM2: number; points: Pt[]; x: number; z: number; review: string; source: string }
export interface Pier { id: string; kind: 'pier' | 'breakwater'; points: Pt[]; width: number; closed: boolean }
export interface Landing { id: string; island: string; name: string; nameDv: string; dock: Pt; water: Pt; kind: 'pier' | 'marina' | 'beach' }
export interface Place {
  id: string; name: string; nameDv: string; category: string; icon: string; color: string; x: number; z: number;
  latitude: number; longitude: number; island?: string; description: string; review: string; source: string; kind: 'place' | 'address'; visibility: string;
}
export interface World {
  schemaVersion: number;
  island: { name: string; nameDv: string; atoll: string; atollCode: string; postcode: string; latitude: number; longitude: number; timezone: string };
  coordinates: { name: string; origin: { latitude: number; longitude: number }; eastScale: number; northScale: number; axes: Record<string, string>; units: string; georeferenced: boolean };
  spawn: XZ;
  coastlines: Island[];
  atoll: Pt[] | null;
  reefs: { id: string; points: Pt[] }[];
  roads: Road[];
  buildings: Building[];
  piers: Pier[];
  docks: { id: string; name: string; points: Pt[] }[];
  pitches: { id: string; points: Pt[] }[];
  woods: { id: string; points: Pt[] }[];
  landings: Landing[];
  places: Place[];
  addresses: Place[];
  coverage: { islands: number; roads: number; buildings: number; places: number; addresses: number; landings: number; locallyReviewed: boolean; notes: string };
  source: { provider: string; url: string; api: string; retrievedAt: string; license: string; licenseUrl: string; coastlineWay: number };
}

/** An illustrative house generated along a road where OSM has no footprint. */
export interface IllustrativeHouse { id: string; x: number; z: number; w: number; d: number; rot: number; height: number; color: string; roofColor: string; roof: 'hip' | 'gable' | 'flat'; front: 1 | -1; points: Pt[]; plot: Pt[] }

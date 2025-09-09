import * as THREE from 'three';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { Line2 } from 'three/addons/lines/Line2.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

// Full station record you showed
export interface StationRecord {
  station_id: string;
  latitude: number;
  longitude: number;
  elevation?: number | null;
  station_name?: string;
  station_network?: string;
  timezone?: string;
  [k: string]: unknown;
}

export type StationPointsRich = THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial> & {
  userData: { stations: StationRecord[]; idToIndex: Map<string, number> };
};

// Accept several input shapes and normalize to StationRecord[]
export function normalizeStationRecords(input: unknown): StationRecord[] {
  // Case A: already an array of rich station dicts
  if (Array.isArray(input) && input.every(o =>
      o && typeof o === 'object' &&
      typeof (o as any).station_id === 'string' &&
      Number.isFinite((o as any).latitude) &&
      Number.isFinite((o as any).longitude)
  )) {
    // shallow copy to satisfy type
    return (input as StationRecord[]).map(s => ({ ...s }));
  }

  // Case B: Record<string, [lat, lon]>
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    const obj = input as Record<string, unknown>;
    const entries = Object.entries(obj);
    if (entries.every(([, v]) => Array.isArray(v) && v.length === 2 && Number.isFinite((v as any)[0]) && Number.isFinite((v as any)[1]))) {
      return entries.map(([id, v]) => {
        const [lat, lon] = v as [number, number];
        return { station_id: id, latitude: lat, longitude: lon };
      });
    }
  }

  throw new Error('[normalizeStationRecords] Unsupported stations JSON shape');
}

export type StationData = Record<string, [number, number]>; // { id: [lat, lon] }

export type StationPoints = THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial> & {
  userData: { stationIds: string[] };
};

export type DrawStationsParams = {
  json: StationData;
  radius: number;
  materialOptions?: THREE.PointsMaterialParameters;
};

export type DrawThreeGeoParams = {
  json: any; // GeoJSON Feature / FeatureCollection / GeometryCollection
  radius: number;
  /** color/opacity etc. from Three materials; linewidth is in pixels for Line2 */
  materialOptions?: Partial<THREE.MeshBasicMaterialParameters & { linewidth?: number }>;
  /** Stroke width in screen pixels (Line2). Default: 1.5 */
  lineWidth?: number;
};

// ---------------------------------------------------------------------------
// Utils
// ---------------------------------------------------------------------------

function degToRad(d: number): number { return (d * Math.PI) / 180; }

/**
 * Convert (lat, lon) in degrees to XYZ on a sphere radius r.
 * NOTE: This matches your original math and orientation; the container is later rotated -90° on X.
 */
function latLonToXYZ(lat: number, lon: number, r: number): [number, number, number] {
  const clat = Math.cos(degToRad(lat));
  const x = clat * Math.cos(degToRad(lon)) * r;
  const y = clat * Math.sin(degToRad(lon)) * r;
  const z = Math.sin(degToRad(lat)) * r;
  return [x, y, z];
}

/** Wrap longitude to [-180, 180] */
function wrapLon(lon: number): number {
  let l = lon;
  while (l > 180) l -= 360;
  while (l < -180) l += 360;
  return l;
}

/**
 * Densify a list of [lon, lat] points so adjacent vertices are at most ~stepDeg apart
 * (prevents straight lines through the sphere when drawing long geodesics).
 */
function densifyLngLat(coords: Array<[number, number]>, stepDeg = 5): Array<[number, number]> {
  if (coords.length <= 1) return coords.slice();
  const out: Array<[number, number]> = [];
  for (let i = 0; i < coords.length - 1; i++) {
    let [lon1, lat1] = coords[i];
    let [lon2, lat2] = coords[i + 1];

    lon1 = wrapLon(lon1); lon2 = wrapLon(lon2);
    // take the shortest path across the dateline
    let dLon = lon2 - lon1;
    if (dLon > 180) dLon -= 360;
    if (dLon < -180) dLon += 360;

    const dLat = lat2 - lat1;
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dLon), Math.abs(dLat)) / stepDeg));
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      out.push([wrapLon(lon1 + dLon * t), lat1 + dLat * t]);
    }
  }
  // push the last vertex
  out.push(coords[coords.length - 1]);
  return out;
}

// ---------------------------------------------------------------------------
// Textures
// ---------------------------------------------------------------------------

export function createCircleTexture(size = 32): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fillStyle = '#fff';
  ctx.fill();
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 1;
  return tex;
}

// ---------------------------------------------------------------------------
// Stations
// ---------------------------------------------------------------------------

export function drawStationsRich(params: {
  records: StationRecord[];
  radius: number;
  materialOptions?: THREE.PointsMaterialParameters;
}): StationPointsRich {
  const { records, radius, materialOptions } = params;

  const positions: number[] = [];
  const clean: StationRecord[] = [];

  for (const s of records) {
    const lat = Number(s.latitude), lon = Number(s.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) { console.warn('skip invalid station', s); continue; }
    const [x, y, z] = latLonToXYZ(lat, lon, radius);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) { console.warn('projection fail', s); continue; }
    positions.push(x, y, z);
    clean.push(s);
  }

  if (positions.length === 0) throw new Error('[drawStationsRich] No valid station positions');

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    size: 0.02,
    color: 0x9ce0f7,
    sizeAttenuation: true,
    map: createCircleTexture(),
    alphaTest: 0.5,
    transparent: true,
    ...(materialOptions ?? {}),
  });

  const points = new THREE.Points(geometry, material) as StationPointsRich;
  points.userData = {
    stations: clean,
    idToIndex: new Map(clean.map((s, i) => [s.station_id, i])),
  };
  points.rotation.x = -Math.PI * 0.5;
  return points;
}

export function drawStations({ json, radius, materialOptions }: DrawStationsParams): StationPoints {
  const ids: string[] = [];
  const positions: number[] = [];

  for (const [id, coords] of Object.entries(json)) {
    let [lat, lon] = coords as [number, number];
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      console.warn('[drawStations] skipping invalid coord', id, coords);
      continue;
    }
    const [x, y, z] = latLonToXYZ(lat, lon, radius);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
      console.warn('[drawStations] projection failed', id, { lat, lon });
      continue;
    }
    positions.push(x, y, z);
    ids.push(id);
  }

  if (positions.length === 0) {
    throw new Error('[drawStations] No valid station positions. Check JSON path/shape.');
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    size: 0.02,
    color: 0x9ce0f7,
    sizeAttenuation: true,
    map: createCircleTexture(),
    alphaTest: 0.5,
    transparent: true,
    ...(materialOptions ?? {}),
  });

  const points = new THREE.Points(geometry, material) as StationPoints;
  points.userData = { stationIds: ids };
  // Keep the same orientation hack as your original file
  points.rotation.x = -Math.PI * 0.5;
  return points;
}

// ---------------------------------------------------------------------------
// Countries / GeoJSON as fat lines (Line2)
// ---------------------------------------------------------------------------

export function drawThreeGeo({ json, radius, materialOptions, lineWidth = 1.5 }: DrawThreeGeoParams): THREE.Object3D {
  const container = new THREE.Object3D();
  // Orientation parity with your stations
  container.rotation.x = -Math.PI * 0.5;

  const color = (materialOptions?.color as THREE.ColorRepresentation) ?? 0xffffff;
  const opacity = materialOptions?.opacity ?? 0.6;
  const transparent = materialOptions?.transparent ?? true;

  const lines: Line2[] = [];

  function addLineFromLngLat(coords: Array<[number, number]>) {
    if (!coords || coords.length < 2) return;
    const dense = densifyLngLat(coords, 5);

    const positions: number[] = [];
    for (const pair of dense) {
      const [lon, lat] = pair;
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      const [x, y, z] = latLonToXYZ(lat, lon, radius);
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue;
      positions.push(x, y, z);
    }

    if (positions.length < 6) return;


    const geom = new LineGeometry();
    geom.setPositions(positions);

    const mat = new LineMaterial({ color, transparent, opacity, linewidth: lineWidth });
    if (typeof window !== 'undefined') {
      mat.resolution.set(window.innerWidth, window.innerHeight);
    }

    const line = new Line2(geom, mat);
    line.computeLineDistances();
    lines.push(line);
    container.add(line);
  }

  function handleGeometry(geom: any) {
    if (!geom) return;
    switch (geom.type) {
      case 'LineString': {
        const coords = geom.coordinates as Array<[number, number]>; // [lon, lat]
        addLineFromLngLat(coords);
        break;
      }
      case 'MultiLineString': {
        const segments = geom.coordinates as Array<Array<[number, number]>>;
        for (const seg of segments) addLineFromLngLat(seg);
        break;
      }
      case 'Polygon': {
        const rings = geom.coordinates as Array<Array<[number, number]>>; // rings of [lon,lat]
        for (const ring of rings) addLineFromLngLat(ring);
        break;
      }
      case 'MultiPolygon': {
        const polys = geom.coordinates as Array<Array<Array<[number, number]>>>;
        for (const poly of polys) for (const ring of poly) addLineFromLngLat(ring);
        break;
      }
      case 'GeometryCollection': {
        for (const g of geom.geometries ?? []) handleGeometry(g);
        break;
      }
      case 'Point':
      case 'MultiPoint':
      default:
        // Ignore for outline drawing
        break;
    }
  }

  if (json?.type === 'FeatureCollection') {
    for (const f of json.features ?? []) handleGeometry(f.geometry);
  } else if (json?.type === 'Feature') {
    handleGeometry(json.geometry);
  } else if (json?.type === 'GeometryCollection') {
    for (const g of json.geometries ?? []) handleGeometry(g);
  } else {
    // Assume a bare geometry
    handleGeometry(json);
  }

  // Convenience helpers for consumers (optional)
  (container.userData as any).setResolution = (w: number, h: number) => {
    for (const l of lines) l.material.resolution.set(w, h);
  };
  (container.userData as any).dispose = () => {
    for (const l of lines) {
      l.geometry.dispose();
      l.material.dispose();
    }
  };

  return container;
}

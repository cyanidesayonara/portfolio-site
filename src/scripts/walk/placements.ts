/*
  Absolute positions that live outside the district modules: the minimap's fixed
  place and threat markers, and the scattered bones. Each one is looked up from the
  layout data (`data/seafront.json` POIs and the pier) or from a district's own
  logic constants, so moving a district (the map re-orientation, see
  docs/superpowers/specs/2026-11-28-walk-reorientation-design.md) only means
  changing that district's data and modules.

  Kept free of Three.js imports so node --test can check every reference resolves.
*/
import { CASTELLERS_POS } from './castellersLogic.ts';
import { MOSAIC_HOME } from './mosaicLogic.ts';
import { SENGLARS_MAP_POS } from './senglarsLogic.ts';
import { MICO_HOME } from './micoLogic.ts';
import { CARTS_MAP_POS } from './gorgLogic.ts';
import { HILL_DX, shiftX } from './hillOffset.ts';

export interface Pt { x: number; z: number }

/** The parts of the layout data these lookups need (a subset of `TownLayout`). */
export interface PlacementLayout {
  pier: { x0: number; x1: number };
  districts: { id: string; pois: { id: string; x: number; z: number }[] }[];
}

/** A layout POI's position, by district id and POI id. Throws if the data no longer has it. */
export function poiPos(layout: PlacementLayout, district: string, poi: string): Pt {
  const p = layout.districts.find((d) => d.id === district)?.pois.find((q) => q.id === poi);
  if (!p) throw new Error(`walk layout: no POI "${poi}" in district "${district}"`);
  return { x: p.x, z: p.z };
}

export interface PlaceMark {
  x: number;
  z: number;
  color: string;
  label: string;
  kind: 'place' | 'threat';
}

type Ref = { district: string; poi: string } | { at: Pt };
const MAP_PLACES: (Ref & { color: string; label: string; kind: 'place' | 'threat' })[] = [
  { district: 'rambla', poi: 'station', color: '#e5302a', label: 'Estació', kind: 'place' },
  { district: 'seafront', poi: 'pipica', color: '#8bcb3c', label: 'Pipicà', kind: 'place' },
  { district: 'plaza', poi: 'pipica2', color: '#8bcb3c', label: 'Pipicà', kind: 'place' },
  { district: 'plaza', poi: 'market', color: '#e5487a', label: 'Mercat', kind: 'place' },
  { at: CASTELLERS_POS, color: '#e5487a', label: 'Castellers', kind: 'place' },
  { district: 'seafront', poi: 'pier', color: '#c9a26b', label: 'Old pier', kind: 'place' },
  { district: 'rambla', poi: 'underpass', color: '#f4f1ea', label: 'Underpass', kind: 'place' },
  { district: 'town', poi: 'carrer-del-mar', color: '#f4f1ea', label: 'Carrer del Mar', kind: 'place' },
  { district: 'hill', poi: 'museu', color: '#ffb020', label: 'Museu', kind: 'place' },
  { district: 'hill', poi: 'pipica3', color: '#8bcb3c', label: 'Pipicà', kind: 'place' },
  { district: 'hill', poi: 'church', color: '#f4f1ea', label: 'Església', kind: 'place' },
  { district: 'hill', poi: 'mirador', color: '#1fc9b7', label: 'Mirador', kind: 'place' },
  { district: 'marina', poi: 'port', color: '#3d73c7', label: 'Port', kind: 'place' },
  { district: 'marina', poi: 'pipica4', color: '#8bcb3c', label: 'Pipicà', kind: 'place' },
  { district: 'marina', poi: 'lighthouse', color: '#5eea8c', label: 'Far del Port', kind: 'place' },
  { district: 'gorg', poi: 'canal', color: '#1fc9b7', label: 'Canal', kind: 'place' },
  { district: 'gorg', poi: 'galeria', color: '#ffb020', label: 'Galeria', kind: 'place' },
  { district: 'gorg', poi: 'pavello', color: '#3d73c7', label: 'Pavelló', kind: 'place' },
  { district: 'gorg', poi: 'tram', color: '#5eea8c', label: 'Tramvia', kind: 'place' },
  { district: 'gorg', poi: 'pipica5', color: '#8bcb3c', label: 'Pipicà', kind: 'place' },
  { at: CARTS_MAP_POS, color: '#ff6b5a', label: 'Carts', kind: 'threat' },
  { at: MICO_HOME, color: '#ffb020', label: 'El Mico', kind: 'threat' },
  // The hill's boss and chase logic run in its local frame (hillOffset.ts).
  { at: shiftX(MOSAIC_HOME, HILL_DX), color: '#ffb020', label: 'Guardian', kind: 'threat' },
  { at: shiftX(SENGLARS_MAP_POS, HILL_DX), color: '#a86a3a', label: 'Senglars', kind: 'threat' },
];

/** The minimap's fixed place and threat markers. */
export function mapPlaceMarks(layout: PlacementLayout): PlaceMark[] {
  return MAP_PLACES.map((m) => {
    const p = 'at' in m ? m.at : poiPos(layout, m.district, m.poi);
    return { x: p.x, z: p.z, color: m.color, label: m.label, kind: m.kind };
  });
}

/**
 * Where the scattered bones lie, grouped by the district they sit in so a district
 * move updates one group. Spots on the pier follow the pier's layout data.
 */
export function boneSpots(layout: PlacementLayout): { district: string; spots: [number, number][] }[] {
  const pierX = (layout.pier.x0 + layout.pier.x1) / 2;
  return [
    { district: 'hill', spots: shiftX([[0, 186], [14, 187], [0, 211], [12, 224]] as [number, number][], HILL_DX) },
    { district: 'plaza', spots: [[10, 108], [-17, 148], [40, 158.4]] },
    { district: 'town', spots: [[1.5, 48], [-20, 53], [22, 71], [-14, 89], [30, 88.8]] },
    { district: 'rambla', spots: [[-40, 24], [40, 29], [60, 20], [-1, 9]] },
    { district: 'seafront', spots: [[-60, -5], [70, -3], [pierX, -60], [pierX, -100], [70, -27], [0, -40]] },
  ];
}

/*
  The walk's goal list: ids, labels, targets and areas. Goal ids are what saved
  progress (`walk3d-progress-v1`) stores, so they must never be renamed or reused,
  even when the districts they belong to move. Kept free of browser imports so
  node --test can check saves against it.
*/
import type { GoalRow } from './hud';

/** Fresh rows for a new game, in card order. Callers copy them before mutating. */
export const GOAL_DEFS: readonly Readonly<GoalRow>[] = [
  { id: 'whirl', label: 'Fling your human with a pole whirl', done: false, area: 'any' },
  { id: 'mark', label: 'Mark 5 spots (Q)', done: false, count: 0, target: 5, area: 'any' },
  { id: 'birds', label: 'Scatter the gulls or pigeons (E)', done: false, area: 'any' },
  { id: 'finds', label: 'Dig up 3 finds on the beach (Space)', done: false, count: 0, target: 3, area: 'seafront' },
  { id: 'hurdles', label: 'Clear the 3 hurdles in the pipicà (V)', done: false, count: 0, target: 3, area: 'seafront' },
  { id: 'coriolis', label: 'Play the Coriolis LED wall (X)', done: false, area: 'seafront' },
  { id: 'stemma', label: 'Change the music at stemma (X)', done: false, area: 'seafront' },
  { id: 'pier', label: 'Walk to the end of the pier', done: false, area: 'seafront' },
  { id: 'dimoni', label: 'Douse El Dimoni Gegant on the beach', done: false, area: 'seafront' },
  { id: 'gulls', label: 'Outsmart the swooping pier gulls', done: false, area: 'seafront' },
  { id: 'marina_quests', label: 'Help out at the marina', done: false, count: 0, target: 3, area: 'marina' },
  { id: 'marina_lighthouse', label: 'Reach the breakwater lighthouse', done: false, area: 'marina' },
  { id: 'marina_boats', label: 'Stroll both marina pontoons', done: false, count: 0, target: 2, area: 'marina' },
  { id: 'marina_wake', label: 'Outrun the harbor boat wake on a pontoon', done: false, area: 'marina' },
  { id: 'marina_mico', label: 'Outsmart El Mico de Bronze at Moll de Llevant', done: false, area: 'marina' },
  { id: 'gorg_quests', label: 'Help out around Canal i Galeria', done: false, count: 0, target: 3, area: 'gorg' },
  { id: 'gorg_bridges', label: 'Cross both bridges over the canal', done: false, count: 0, target: 2, area: 'gorg' },
  { id: 'gorg_carts', label: 'Dodge the runaway shopping carts at Galeria', done: false, area: 'gorg' },
  { id: 'ronda_quests', label: 'Help out around Ronda i Parc', done: false, count: 0, target: 3, area: 'ronda' },
  { id: 'ronda_bridge', label: 'Cross the Pont de vianants overpass', done: false, area: 'ronda' },
  { id: 'ronda_scooters', label: 'Dodge the runaway delivery scooters on the Ronda', done: false, area: 'ronda' },
  { id: 'fabrica_quests', label: 'Help out along Avinguda de la Fàbrica', done: false, count: 0, target: 3, area: 'fabrica' },
  { id: 'fabrica_chimney', label: 'Sniff out the old factory chimney', done: false, area: 'fabrica' },
  { id: 'fabrica_bins', label: 'Dodge the runaway recycling bins on the avenue', done: false, area: 'fabrica' },
  { id: 'santpau_quests', label: 'Help out in Sant Pau i Prim', done: false, count: 0, target: 3, area: 'santpau' },
  { id: 'santpau_pipica', label: 'Romp in the Placeta pipicà', done: false, area: 'santpau' },
  { id: 'santpau_bottles', label: 'Dodge the runaway butane bottles on Carrer de Sant Pau', done: false, area: 'santpau' },
  { id: 'town', label: 'Help out in the side streets', done: false, count: 0, target: 5, area: 'town' },
  { id: 'neteja', label: 'Outrun La Neteja down Carrer del Mar', done: false, area: 'town' },
  { id: 'correfoc', label: 'Survive the correfoc on the Rambla', done: false, area: 'town' },
  { id: 'tabalers', label: 'Brave the Rambla tabalers drum squad', done: false, area: 'town' },
  { id: 'plaza', label: 'Help out on Plaça del Mercat', done: false, count: 0, target: 3, area: 'plaza' },
  { id: 'plaza_castellers', label: 'Topple the Plaça Castellers tower', done: false, area: 'plaza' },
  { id: 'butcher', label: 'Get away with the butcher’s botifarra', done: false, area: 'plaza' },
  { id: 'hill_quests', label: 'Explore Dalt de la Vila', done: false, count: 0, target: 2, area: 'hill' },
  { id: 'cats', label: 'Send 3 old-town cats running', done: false, count: 0, target: 3, area: 'hill' },
  { id: 'hill_senglars', label: 'Outrun the wild boars on Dalt de la Vila', done: false, area: 'hill' },
  { id: 'hill_mosaic', label: 'Outsmart the Roman Mosaic Guardian at Museu', done: false, area: 'hill' },
  { id: 'hill_top', label: 'Climb to the hilltop church and head home', done: false, area: 'hill' },
];

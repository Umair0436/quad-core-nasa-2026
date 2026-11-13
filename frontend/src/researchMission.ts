import { canStand, SPAWN } from './components/moonWorld';
import type { BuildingId, Point } from './components/moonWorld';

export const supplies = [
  { id: 'oxygen', label: 'Oxygen', color: '#8ae2d3', perMeter: 1.45 },
  { id: 'water', label: 'Water', color: '#8dc7ff', perMeter: 1.05 },
  { id: 'food', label: 'Food', color: '#b7d990', perMeter: .85 },
  { id: 'power', label: 'Power', color: '#ffd08a', perMeter: 1.55 },
] as const;

export const deliveries = [
  {
    site: 'ridge', name: 'Ice Ridge', note: 'Ice scan',
    finding: 'Ice can stay frozen in Moon craters that sunlight never reaches.',
    upgrade: 'Extra solar panels', benefit: 'Your battery now uses less power on walks.',
  },
  {
    site: 'greenhouse', name: 'Greenhouse', note: 'Plant report',
    finding: 'Plants need light, water and air to grow in a Moon greenhouse.',
    upgrade: 'Bigger greenhouse', benefit: 'You can now carry 125 food instead of 100.',
  },
  {
    site: 'shelter', name: 'Storm Shelter', note: 'Storm reading',
    finding: 'Thick walls can help protect astronauts during a solar storm.',
    upgrade: 'New base unlocked', benefit: 'You can now visit Horizon Base.',
  },
] as const satisfies ReadonlyArray<{
  site: BuildingId; name: string; note: string; finding: string; upgrade: string; benefit: string;
}>;

export type SupplyId = typeof supplies[number]['id'];
export type Supplies = Record<SupplyId, number>;
export type ResearchMission = {
  delivered: number;
  carrying: boolean;
  supplies: Supplies;
  position: Point;
};

export function capacity(id: SupplyId, delivered: number) {
  return id === 'food' && delivered >= 2 ? 125 : 100;
}

function fullSupplies(delivered: number): Supplies {
  return { oxygen: 100, water: 100, food: capacity('food', delivered), power: 100 };
}

export function newMission(delivered = 0): ResearchMission {
  return { delivered, carrying: false, supplies: fullSupplies(delivered), position: { ...SPAWN } };
}

export function outOfSupplies(mission: ResearchMission) {
  return supplies.find(({ id }) => mission.supplies[id] <= 0);
}

export function travel(mission: ResearchMission, distance: number, position: Point): ResearchMission {
  const remaining = { ...mission.supplies };
  if (mission.delivered < deliveries.length) {
    for (const { id, perMeter } of supplies) {
      const use = id === 'power' && mission.delivered >= 1 ? perMeter * .6 : perMeter;
      remaining[id] = Math.max(0, remaining[id] - use * distance);
    }
  }
  return { ...mission, supplies: remaining, position };
}

export function refill(mission: ResearchMission): ResearchMission {
  return { ...mission, supplies: fullSupplies(mission.delivered) };
}

export function pickUp(mission: ResearchMission, location: BuildingId): ResearchMission {
  if (mission.carrying || deliveries[mission.delivered]?.site !== location || outOfSupplies(mission)) return mission;
  return { ...mission, carrying: true };
}

export function submit(mission: ResearchMission, location: BuildingId): ResearchMission {
  if (location !== 'lab' || !mission.carrying || mission.delivered >= deliveries.length || outOfSupplies(mission)) return mission;
  const delivered = mission.delivered + 1;
  return { ...mission, delivered, carrying: false, supplies: fullSupplies(delivered) };
}

function storageKey(astronaut: string) {
  return `luna-research-v1-${astronaut}`;
}

export function loadResearch(astronaut: string): ResearchMission {
  try {
    const saved: ResearchMission = JSON.parse(sessionStorage.getItem(storageKey(astronaut)) ?? 'null');
    if (saved && Number.isInteger(saved.delivered) && saved.delivered >= 0 && saved.delivered <= deliveries.length &&
        typeof saved.carrying === 'boolean' && !(saved.carrying && saved.delivered === deliveries.length) &&
        saved.position && canStand(saved.position) && supplies.every(({ id }) =>
          Number.isFinite(saved.supplies?.[id]) && saved.supplies[id] >= 0 && saved.supplies[id] <= capacity(id, saved.delivered))) {
      return saved;
    }
  } catch { /* Storage can be unavailable. */ }
  return newMission();
}

export function saveResearch(astronaut: string, mission: ResearchMission) {
  try { sessionStorage.setItem(storageKey(astronaut), JSON.stringify(mission)); }
  catch { /* Storage can be unavailable. */ }
}

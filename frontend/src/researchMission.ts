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
    site: 'solar', name: 'Solar Array', title: 'Oxygen emergency', dispatch: 'The crew is running low on air. Reach the Solar Array and bring the oxygen generator back online.', start: 'Restore crew oxygen',
    finding: 'Solar panels turn sunlight into electricity, and batteries store some of it for later.',
    badge: 'Oxygen Hero', badgeIcon: '⚡', cheer: 'You brought the crew’s air back!',
    upgrade: 'Extra solar panels', benefit: 'Your battery now uses less power on walks.',
  },
  {
    site: 'greenhouse', name: 'Greenhouse', title: 'Dinner before sunrise', dispatch: 'The crew needs food. Keep the lettuce alive through the night and harvest it.', start: 'Save the crop',
    finding: 'Plants need light, water and air to grow in a Moon greenhouse.',
    badge: 'Moon Gardener', badgeIcon: '🌱', cheer: 'You grew dinner for the whole crew!',
    upgrade: 'Bigger greenhouse', benefit: 'You can now carry 125 food instead of 100.',
  },
  {
    site: 'shelter', name: 'Storm Shelter', title: 'Solar storm inbound', dispatch: 'Get to the shelter, protect the crew and radio Earth when the storm passes.', start: 'Prepare the shelter',
    finding: 'Thick walls can help protect astronauts during a solar storm.',
    badge: 'Storm Guardian', badgeIcon: '🛡️', cheer: 'You kept everyone safe through the storm!',
    upgrade: 'Horizon Base unlocked', benefit: 'You can now visit Horizon Base.',
  },
] as const satisfies ReadonlyArray<{
  site: BuildingId; name: string; title: string; dispatch: string; start: string; finding: string; badge: string; badgeIcon: string; cheer: string; upgrade: string; benefit: string;
}>;

export type SupplyId = typeof supplies[number]['id'];
export type Supplies = Record<SupplyId, number>;
export type ResearchMission = {
  delivered: number;
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
  return { delivered, supplies: fullSupplies(delivered), position: { ...SPAWN } };
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

export function completeMission(mission: ResearchMission, location: BuildingId): ResearchMission {
  if (deliveries[mission.delivered]?.site !== location || outOfSupplies(mission)) return mission;
  const delivered = mission.delivered + 1;
  return { ...mission, delivered, supplies: fullSupplies(delivered) };
}

function storageKey(astronaut: string) {
  return `luna-research-v1-${astronaut}`;
}

export function loadResearch(astronaut: string): ResearchMission {
  try {
    const saved: ResearchMission = JSON.parse(sessionStorage.getItem(storageKey(astronaut)) ?? 'null');
    if (saved && Number.isInteger(saved.delivered) && saved.delivered >= 0 && saved.delivered <= deliveries.length &&
        supplies.every(({ id }) =>
          Number.isFinite(saved.supplies?.[id]) && saved.supplies[id] >= 0 && saved.supplies[id] <= capacity(id, saved.delivered))) {
      return { ...saved, position: saved.position && canStand(saved.position) ? saved.position : { ...SPAWN } };
    }
  } catch { /* Storage can be unavailable. */ }
  return newMission();
}

export function saveResearch(astronaut: string, mission: ResearchMission) {
  try { sessionStorage.setItem(storageKey(astronaut), JSON.stringify(mission)); }
  catch { /* Storage can be unavailable. */ }
}

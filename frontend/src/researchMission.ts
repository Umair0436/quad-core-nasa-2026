import { canStand, SPAWN } from './components/moonWorld';
import type { BuildingId, Point } from './components/moonWorld';

export const deliveries = [
  {
    site: 'solar', name: 'Solar Array', title: 'Oxygen emergency', dispatch: 'The crew is running low on air. Reach the Solar Array and bring the oxygen generator back online.', start: 'Restore crew oxygen',
    finding: 'Solar panels turn sunlight into electricity, and batteries store some of it for later.',
    badge: 'Oxygen Hero', badgeIcon: '⚡', cheer: 'You brought the crew’s air back!',
    upgrade: 'Extra solar panels', benefit: 'Your outpost has an extra solar panel.',
  },
  {
    site: 'greenhouse', name: 'Greenhouse', title: 'Dinner before sunrise', dispatch: 'The crew needs food. Keep the lettuce alive through the night and harvest it.', start: 'Save the crop',
    finding: 'Plants need light, water and air to grow in a Moon greenhouse.',
    badge: 'Moon Gardener', badgeIcon: '🌱', cheer: 'You grew dinner for the whole crew!',
    upgrade: 'Bigger greenhouse', benefit: 'More plants are growing inside the greenhouse.',
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

export type ResearchMission = {
  delivered: number;
  walkDistance: number;
  position: Point;
};

export function newMission(): ResearchMission {
  return { delivered: 0, walkDistance: 0, position: { ...SPAWN } };
}

export function travel(mission: ResearchMission, distance: number, position: Point): ResearchMission {
  return { ...mission, walkDistance: mission.walkDistance + distance, position };
}

export function completeMission(mission: ResearchMission, location: BuildingId): ResearchMission {
  if (deliveries[mission.delivered]?.site !== location) return mission;
  return { ...mission, delivered: mission.delivered + 1, walkDistance: 0 };
}

function storageKey(astronaut: string) {
  return `luna-research-v1-${astronaut}`;
}

export function loadResearch(astronaut: string): ResearchMission {
  try {
    const saved: ResearchMission = JSON.parse(sessionStorage.getItem(storageKey(astronaut)) ?? 'null');
    if (saved && Number.isInteger(saved.delivered) && saved.delivered >= 0 && saved.delivered <= deliveries.length) {
      return {
        delivered: saved.delivered,
        walkDistance: Number.isFinite(saved.walkDistance) && saved.walkDistance >= 0 ? saved.walkDistance : 0,
        position: saved.position && canStand(saved.position) ? saved.position : { ...SPAWN },
      };
    }
  } catch { /* Storage can be unavailable. */ }
  return newMission();
}

export function saveResearch(astronaut: string, mission: ResearchMission) {
  try { sessionStorage.setItem(storageKey(astronaut), JSON.stringify(mission)); }
  catch { /* Storage can be unavailable. */ }
}

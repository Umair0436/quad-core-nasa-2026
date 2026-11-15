export type Point = { x: number; z: number };
export type BuildingId = 'habitat' | 'shelter' | 'greenhouse' | 'ridge' | 'solar' | 'lab' | 'horizon';
export const SPAWN: Point = { x: 0, z: 8 };
export const WALK_SPEED = 3.3;
export const WORLD_EDGE = 28;
export const PLAYER_RADIUS = 0.42;
export const BUILDING_SCALE = 1.28;
export const MOON_BUILDINGS = [
  { id: 'habitat' as const, name: 'Habitat', x: -7, z: -6, radius: 3.05, height: 4.7, door: { x: -7, z: -1.65 }, color: '#8ae2d3' },
  { id: 'shelter' as const, name: 'Storm shelter', x: 11, z: -17, radius: 3.25, height: 3.15, door: { x: 11, z: -12.5 }, color: '#ffd08a' },
  { id: 'solar' as const, name: 'Solar Array', x: -18, z: 3, radius: 2.35, height: 2.1, door: { x: -18, z: 6.1 }, color: '#8ec5ff' },
  { id: 'lab' as const, name: 'Research Lab', x: -1, z: -18, radius: 2.15, height: 3.35, door: { x: -1, z: -14.75 }, color: '#d4b5ff' },
  { id: 'ridge' as const, name: 'Ice Ridge', x: -19, z: -15, radius: 1.7, height: 2.15, door: { x: -19, z: -12 }, color: '#9fdcff' },
  { id: 'horizon' as const, name: 'Horizon Base', x: 22, z: -7, radius: 2.65, height: 4.3, door: { x: 22, z: -3.25 }, color: '#ffd08a' },
  { id: 'greenhouse' as const, name: 'Greenhouse', x: 15, z: 7, radius: 3.05, height: 3.1, door: { x: 15, z: 11.3 }, color: '#b7d990' },
].map(({ door, ...building }) => ({
  ...building,
  radius: building.radius * BUILDING_SCALE,
  height: building.height * BUILDING_SCALE,
  door: { x: door.x, z: building.z + (door.z - building.z) * BUILDING_SCALE },
}));
const obstacles = [
  ...MOON_BUILDINGS,
  { x: -12, z: 10, radius: 1.55 },
];

export function canStand(point: Point): boolean {
  return Math.abs(point.x) <= WORLD_EDGE && Math.abs(point.z) <= WORLD_EDGE &&
    obstacles.every((obstacle) => Math.hypot(point.x - obstacle.x, point.z - obstacle.z) >= obstacle.radius + PLAYER_RADIUS);
}

// Frame-rate-independent movement, diagonal normalization, and wall sliding.
export function moveOnMoon(position: Point, direction: Point, delta: number): Point {
  const length = Math.hypot(direction.x, direction.z);
  if (!length || delta <= 0 || !Number.isFinite(length) || !Number.isFinite(delta)) return { ...position };
  const step = WALK_SPEED * Math.min(delta, 0.05);
  const dx = direction.x / length * step;
  const dz = direction.z / length * step;
  let next = { x: position.x + dx, z: position.z + dz };
  if (canStand(next)) return next;
  next = { ...position };
  if (canStand({ x: next.x + dx, z: next.z })) next.x += dx;
  if (canStand({ x: next.x, z: next.z + dz })) next.z += dz;
  return next;
}

export function nearbyBuilding(point: Point): BuildingId | null {
  let nearest: BuildingId | null = null;
  let distance = 2.05;
  for (const building of MOON_BUILDINGS) {
    const value = Math.hypot(point.x - building.door.x, point.z - building.door.z);
    if (value < distance) { distance = value; nearest = building.id; }
  }
  return nearest;
}

function snapWalkable(point: Point): Point | null {
  let best: Point | null = null;
  let distance = Infinity;
  for (let x = Math.round(point.x) - 2; x <= Math.round(point.x) + 2; x++) {
    for (let z = Math.round(point.z) - 2; z <= Math.round(point.z) + 2; z++) {
      const value = Math.hypot(x - point.x, z - point.z);
      if (canStand({ x, z }) && value < distance) { best = { x, z }; distance = value; }
    }
  }
  return best;
}

// A small A* grid lets the guide buttons walk around buildings instead of teleporting.
export function findMoonPath(start: Point, goal: Point): Point[] {
  if (!canStand(start) || !canStand(goal)) return [];
  const from = snapWalkable(start);
  const to = snapWalkable(goal);
  if (!from || !to) return [];
  const key = (point: Point) => `${point.x},${point.z}`;
  const startKey = key(from);
  const goalKey = key(to);
  const open = new Map<string, Point>([[startKey, from]]);
  const cameFrom = new Map<string, Point>();
  const scores = new Map<string, number>([[startKey, 0]]);
  const closed = new Set<string>();
  const directions = [-1, 0, 1].flatMap((x) => [-1, 0, 1].filter((z) => x || z).map((z) => ({ x, z })));

  while (open.size) {
    let current = from;
    let best = Infinity;
    for (const [id, point] of open) {
      const score = scores.get(id)! + Math.hypot(to.x - point.x, to.z - point.z);
      if (score < best) { best = score; current = point; }
    }
    const id = key(current);
    if (id === goalKey) {
      const path = [goal, current];
      while (cameFrom.has(key(current))) { current = cameFrom.get(key(current))!; path.push(current); }
      return path.reverse();
    }
    open.delete(id); closed.add(id);
    for (const direction of directions) {
      const next = { x: current.x + direction.x, z: current.z + direction.z };
      const nextKey = key(next);
      if (closed.has(nextKey) || !canStand(next)) continue;
      if (direction.x && direction.z && (!canStand({ x: current.x + direction.x, z: current.z }) || !canStand({ x: current.x, z: current.z + direction.z }))) continue;
      const cost = scores.get(id)! + Math.hypot(direction.x, direction.z);
      if (cost >= (scores.get(nextKey) ?? Infinity)) continue;
      cameFrom.set(nextKey, current); scores.set(nextKey, cost); open.set(nextKey, next);
    }
  }
  return [];
}

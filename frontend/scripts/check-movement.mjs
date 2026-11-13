import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../src/components/moonWorld.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const world = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const { SPAWN, WALK_SPEED, WORLD_EDGE, PLAYER_RADIUS, MOON_BUILDINGS, canStand, moveOnMoon, nearbyBuilding, findMoonPath } = world;
assert.ok(canStand(SPAWN));

const straight = moveOnMoon(SPAWN, { x: 0, z: -1 }, 1 / 60);
const diagonal = moveOnMoon(SPAWN, { x: 1, z: -1 }, 1 / 60);
assert.ok(Math.abs(Math.hypot(straight.x - SPAWN.x, straight.z - SPAWN.z) - Math.hypot(diagonal.x - SPAWN.x, diagonal.z - SPAWN.z)) < 1e-9, 'Diagonal movement must not be faster');
assert.ok(Math.hypot(moveOnMoon(SPAWN, { x: 1, z: 0 }, 40).x - SPAWN.x) <= WALK_SPEED * .05 + 1e-9, 'Long frames must not teleport the astronaut');

let edge = SPAWN;
for (let i = 0; i < 1000; i++) edge = moveOnMoon(edge, { x: 0, z: 1 }, 1 / 60);
assert.ok(Math.abs(edge.z) <= WORLD_EDGE, 'The astronaut must stay in the outpost area');

for (const building of MOON_BUILDINGS) {
  assert.ok(!canStand(building), `${building.id} must have collision`);
  let position = building.door;
  for (let i = 0; i < 500; i++) position = moveOnMoon(position, { x: 0, z: -1 }, 1 / 60);
  assert.ok(Math.hypot(position.x - building.x, position.z - building.z) >= building.radius + PLAYER_RADIUS - 1e-9, `${building.id} must stop the astronaut at its wall`);
  assert.equal(nearbyBuilding(building.door), building.id, `${building.id} must be interactable at its entrance`);
}
assert.equal(nearbyBuilding(SPAWN), null, 'Buildings must not be remotely interactable from spawn');

let routes = 0;
for (const from of [SPAWN, ...MOON_BUILDINGS.map((building) => building.door)]) {
  for (const building of MOON_BUILDINGS) {
    const path = findMoonPath(from, building.door);
    assert.ok(path.length, `A guide path to ${building.id} must exist`);
    let position = { ...from };
    let step = 0;
    for (; step < 2000 && path.length; step++) {
      while (path.length && Math.hypot(path[0].x - position.x, path[0].z - position.z) < .18) path.shift();
      if (!path.length) break;
      position = moveOnMoon(position, { x: path[0].x - position.x, z: path[0].z - position.z }, 1 / 60);
      assert.ok(canStand(position), 'Guided movement must not pass through walls');
    }
    assert.ok(step < 2000, `The guide must reach ${building.id} without becoming stuck`);
    assert.equal(nearbyBuilding(position), building.id);
    routes++;
  }
}
console.log(`Movement checks passed: ${routes} guided routes, building collisions, bounds, interaction range, frame clamp, and diagonal speed.`);

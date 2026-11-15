import { Component, forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import Astronaut3D from './Astronaut3D';
import type { ExplorerPose } from './Astronaut3D';
import MoonEnvironment3D from './MoonEnvironment3D';
import { findMoonPath, MOON_BUILDINGS, moveOnMoon, nearbyBuilding, SPAWN } from './moonWorld';
import type { BuildingId, Point } from './moonWorld';
import './third-person.css';

export type ExplorerHandle = { walkTo: (id: BuildingId) => boolean; focus: () => void; reset: () => void };
type Input = { forward: boolean; back: boolean; left: boolean; right: boolean; active: boolean };
type Command = { path: Point[]; resetCamera: boolean };
type Orbit = { yaw: number; pitch: number; distance: number };
type Drag = { id: number; x: number; y: number; startX: number; startY: number };
const DEFAULT_ORBIT: Orbit = { yaw: 0, pitch: .37, distance: 11 };

function positionCamera(desired: Vector3, position: Point, yaw: number, pitch: number, distance: number) {
  const dx = Math.sin(yaw);
  const dz = Math.cos(yaw);
  const arm = Math.cos(pitch) * distance;
  let height = Math.max(3.2, 1.55 + Math.sin(pitch) * distance);
  for (const building of MOON_BUILDINGS) {
    const x = building.x - position.x;
    const z = building.z - position.z;
    const along = x * dx + z * dz;
    const radius = building.radius + .12;
    const offsetSquared = x * x + z * z - along * along;
    if (along <= 0 || offsetSquared >= radius * radius) continue;
    const hit = along - Math.sqrt(radius * radius - offsetSquared);
    if (hit > arm) continue;
    // Lift the view over walls instead of pushing the camera into the astronaut.
    const roofHeight = 1.55 + (building.height + .35 - 1.55) * arm / Math.max(2.1, hit);
    height = Math.max(height, Math.min(14, roofHeight));
  }
  desired.set(position.x + dx * arm, height, position.z + dz * arm);
}

type Props = { astronautId: string; suitColor: string; active?: BuildingId; upgrades: number; start: Point; enabled: boolean; pauseLabel?: string; onInteract: (id: BuildingId) => void; onNearChange: (id: BuildingId | null) => void; onTravel: (distance: number, point: Point) => void; onMapVisit: (id: BuildingId) => void };

function ExplorerController({ pose, input, command, orbit, enabled, root, labels, onNearby, onArrive, onCancelGuide, onTravel }: {
  pose: RefObject<ExplorerPose>; input: RefObject<Input>; command: RefObject<Command>;
  orbit: RefObject<Orbit>; enabled: boolean; root: RefObject<HTMLDivElement | null>; labels: RefObject<(HTMLSpanElement | null)[]>;
  onNearby: (id: BuildingId | null) => void; onArrive: (near: BuildingId | null) => void; onCancelGuide: () => void; onTravel: Props['onTravel'];
}) {
  const { camera, size } = useThree();
  const nearby = useRef<BuildingId | null>(null);
  const telemetryTime = useRef(0);
  const desired = useRef(new Vector3());
  const cameraYaw = useRef(0);
  const target = useRef(new Vector3());
  const projected = useRef(new Vector3());

  useFrame(({ clock }, rawDelta) => {
    const delta = Math.min(rawDelta, .05);
    const state = pose.current;
    const { yaw: requestedYaw, pitch, distance: cameraDistance } = orbit.current;
    const yawDelta = Math.atan2(Math.sin(requestedYaw - cameraYaw.current), Math.cos(requestedYaw - cameraYaw.current));
    if (command.current.resetCamera) cameraYaw.current = requestedYaw;
    else cameraYaw.current += yawDelta * (1 - Math.exp(-delta * 12));
    const yaw = cameraYaw.current;
    const sinYaw = Math.sin(yaw);
    const cosYaw = Math.cos(yaw);
    let direction = { x: 0, z: 0 };
    if (enabled && input.current.active) {
      const strafe = Number(input.current.right) - Number(input.current.left);
      const advance = Number(input.current.back) - Number(input.current.forward);
      if (strafe || advance) {
        direction = { x: strafe * cosYaw + advance * sinYaw, z: advance * cosYaw - strafe * sinYaw };
        if (command.current.path.length) { command.current.path = []; onCancelGuide(); }
      } else {
        while (command.current.path.length && Math.hypot(command.current.path[0].x - state.position.x, command.current.path[0].z - state.position.z) < .18) command.current.path.shift();
        const next = command.current.path[0];
        if (next) direction = { x: next.x - state.position.x, z: next.z - state.position.z };
      }
    }
    const next = moveOnMoon(state.position, direction, delta);
    const distance = Math.hypot(next.x - state.position.x, next.z - state.position.z);
    state.moving = distance > .0001;
    if (state.moving) {
      state.angle = Math.atan2(next.x - state.position.x, next.z - state.position.z);
      state.distance += distance;
      state.position = next;
      onTravel(distance, next);
    }
    const near = nearbyBuilding(state.position);
    if (near !== nearby.current) { nearby.current = near; onNearby(near); }
    if (!command.current.path.length) onArrive(near);

    const turn = Math.atan2(Math.sin(state.angle - state.facing), Math.cos(state.angle - state.facing));
    state.facing += turn * (1 - Math.exp(-delta * 10));
    positionCamera(desired.current, state.position, yaw, pitch, cameraDistance);
    // Look past the astronaut so the outpost stays visible ahead.
    const sideOffset = size.width / size.height > 1.25 ? -1.5 : 0;
    target.current.set(
      state.position.x - sinYaw * 2.2 + cosYaw * sideOffset,
      2.8,
      state.position.z - cosYaw * 2.2 - sinYaw * sideOffset,
    );
    if (command.current.resetCamera) {
      camera.position.copy(desired.current);
      command.current.resetCamera = false;
    } else {
      camera.position.x = desired.current.x;
      camera.position.z = desired.current.z;
      // Clear the roof immediately and ease the descent once the path is open.
      camera.position.y = Math.max(desired.current.y, camera.position.y + (desired.current.y - camera.position.y) * (1 - Math.exp(-delta * 6)));
    }
    camera.lookAt(target.current); camera.updateMatrixWorld();
    MOON_BUILDINGS.forEach((building, index) => {
      const label = labels.current[index];
      if (!label) return;
      projected.current.set(building.x, building.height + 1.1, building.z).project(camera);
      const visible = projected.current.z < 1 && projected.current.z > -1 && Math.abs(projected.current.x) < 1.1 && Math.abs(projected.current.y) < 1.1;
      label.style.visibility = visible ? 'visible' : 'hidden';
      label.style.transform = `translate3d(${(projected.current.x * .5 + .5) * size.width}px,${(-projected.current.y * .5 + .5) * size.height}px,0) translate(-50%,-100%)`;
    });
    if (root.current && clock.elapsedTime - telemetryTime.current > .15) {
      telemetryTime.current = clock.elapsedTime;
      root.current.dataset.playerX = state.position.x.toFixed(2); root.current.dataset.playerZ = state.position.z.toFixed(2);
      root.current.dataset.playerAnimation = state.moving ? 'walking' : 'idle';
      root.current.dataset.playerYaw = state.facing.toFixed(3);
      root.current.dataset.cameraX = camera.position.x.toFixed(2); root.current.dataset.cameraZ = camera.position.z.toFixed(2);
      root.current.dataset.nearby = near ?? '';
    }
  }, -1);
  return null;
}

class RendererBoundary extends Component<{ children: ReactNode; onFailure: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFailure(); }
  render() { return this.state.failed ? null : this.props.children; }
}

const ThirdPersonOutpost = forwardRef<ExplorerHandle, Props>(function ThirdPersonOutpost({ astronautId, suitColor, active, upgrades, start, enabled, pauseLabel = 'Choose an action to continue.', onInteract, onNearChange, onTravel, onMapVisit }, ref) {
  const root = useRef<HTMLDivElement>(null);
  const labels = useRef<(HTMLSpanElement | null)[]>([]);
  const pose = useRef<ExplorerPose>({ position: { ...start }, angle: Math.PI, facing: Math.PI, moving: false, distance: 0, reset: 0 });
  const input = useRef<Input>({ forward: false, back: false, left: false, right: false, active: false });
  const command = useRef<Command>({ path: [], resetCamera: true });
  const orbit = useRef<Orbit>({ ...DEFAULT_ORBIT });
  const drag = useRef<Drag | null>(null);
  const dragged = useRef(false);
  const nearRef = useRef<BuildingId | null>(null);
  const guideRef = useRef<BuildingId | null>(null);
  const callback = useRef(onInteract);
  const [near, setNear] = useState<BuildingId | null>(null);
  const [guided, setGuided] = useState<BuildingId | null>(null);
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => { callback.current = onInteract; }, [onInteract]);
  useEffect(() => {
    const canvas = document.createElement('canvas');
    try { const context = canvas.getContext('webgl2'); setWebgl(Boolean(context)); context?.getExtension('WEBGL_lose_context')?.loseContext(); }
    catch { setWebgl(false); }
  }, []);

  const stop = useCallback(() => {
    input.current.forward = input.current.back = input.current.left = input.current.right = false;
    command.current.path = []; pose.current.moving = false;
    if (guideRef.current) { guideRef.current = null; setGuided(null); }
  }, []);

  useEffect(() => {
    if (!enabled) stop();
  }, [enabled, stop]);

  useEffect(() => {
    const clear = () => { stop(); input.current.active = false; drag.current = null; };
    const release = (event: KeyboardEvent) => {
      const mapping = { KeyW: 'forward', ArrowUp: 'forward', KeyS: 'back', ArrowDown: 'back', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right' } as const;
      const name = mapping[event.code as keyof typeof mapping];
      if (name) input.current[name] = false;
    };
    window.addEventListener('blur', clear); window.addEventListener('keyup', release);
    return () => { window.removeEventListener('blur', clear); window.removeEventListener('keyup', release); };
  }, [stop]);

  const onNearby = useCallback((id: BuildingId | null) => { nearRef.current = id; setNear(id); onNearChange(id); }, [onNearChange]);
  const clearGuide = useCallback(() => {
    if (!guideRef.current) return;
    guideRef.current = null;
    setGuided(null);
  }, []);
  const onArrive = useCallback((nearby: BuildingId | null) => {
    const destination = guideRef.current;
    clearGuide();
    if (destination && destination === nearby) callback.current(destination);
  }, [clearGuide]);
  const focus = useCallback((scroll = false) => { root.current?.focus({ preventScroll: true }); if (scroll) root.current?.scrollIntoView({ block: 'center', behavior: 'auto' }); input.current.active = true; }, []);

  const interact = useCallback(() => {
    if (!enabled || !nearRef.current) return;
    const id = nearRef.current; stop(); callback.current(id);
  }, [enabled, stop]);

  const walkTo = useCallback((id: BuildingId) => {
    if (webgl === false || failed) return false;
    if (webgl === null) return true;
    const building = MOON_BUILDINGS.find((item) => item.id === id)!;
    if (nearRef.current === id) { stop(); callback.current(id); return true; }
    const path = findMoonPath(pose.current.position, building.door);
    if (!path.length) return true;
    command.current.path = path; guideRef.current = id; setGuided(id); focus(true);
    return true;
  }, [webgl, failed, stop, focus]);

  const resetCamera = useCallback(() => { orbit.current = { ...DEFAULT_ORBIT }; }, []);
  const turnCamera = (angle: number) => {
    orbit.current.yaw += angle;
  };

  useEffect(() => { focus(); }, [focus]);

  useImperativeHandle(ref, () => ({
    walkTo, focus: () => focus(true),
    reset: () => { stop(); pose.current.position = { ...SPAWN }; pose.current.angle = Math.PI; pose.current.facing = Math.PI; pose.current.distance = 0; pose.current.reset += 1; resetCamera(); command.current.resetCamera = true; },
  }), [walkTo, focus, stop, resetCamera]);

  const failure = useCallback(() => setFailed(true), []);
  const fallback = failed || webgl === false;
  const guideBuilding = MOON_BUILDINGS.find((building) => building.id === guided);
  const nearbyStation = MOON_BUILDINGS.find((building) => building.id === near);
  return <div className={`explorer-stage ${fallback ? 'explorer-fallback' : ''}`} ref={root} tabIndex={0} role="application" aria-label="3D Moon outpost exploration" aria-describedby="explorer-controls" data-astronaut-id={astronautId} data-suit-color={suitColor} data-player-x={SPAWN.x} data-player-z={SPAWN.z}
    onFocus={() => { input.current.active = true; }}
    onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) { input.current.active = false; stop(); } }}
    onPointerDown={(event) => {
      if (!(event.target instanceof HTMLCanvasElement) || event.button !== 0 || !event.isPrimary) return;
      focus();
      dragged.current = false;
      drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY };
    }}
    onPointerMove={(event) => {
      const pointer = drag.current;
      if (!pointer || pointer.id !== event.pointerId) return;
      if (!dragged.current && Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY) < 5) return;
      if (!dragged.current && event.target instanceof HTMLCanvasElement) event.target.setPointerCapture(event.pointerId);
      dragged.current = true;
      turnCamera(-(event.clientX - pointer.x) * .008);
      orbit.current.pitch = Math.max(.13, Math.min(1.05, orbit.current.pitch + (event.clientY - pointer.y) * .007));
      pointer.x = event.clientX;
      pointer.y = event.clientY;
    }}
    onPointerUp={(event) => { if (drag.current?.id === event.pointerId) drag.current = null; }}
    onPointerCancel={() => { drag.current = null; }}
    onLostPointerCapture={() => { drag.current = null; }}
    onWheel={(event) => {
      if (!(event.target instanceof HTMLCanvasElement)) return;
      orbit.current.distance = Math.max(5.2, Math.min(13.5, orbit.current.distance + Math.sign(event.deltaY) * .65));
    }}
    onKeyDown={(event) => {
      if (event.code === 'KeyC') {
        orbit.current = { ...DEFAULT_ORBIT, yaw: pose.current.facing - Math.PI };
      }
      if (event.code === 'KeyQ') turnCamera(.13);
      if (event.code === 'KeyR') turnCamera(-.13);
      if (!enabled) return;
      const mapping = { KeyW: 'forward', ArrowUp: 'forward', KeyS: 'back', ArrowDown: 'back', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right' } as const;
      const name = mapping[event.code as keyof typeof mapping];
      if (name) { event.preventDefault(); input.current[name] = true; }
      if (event.code === 'KeyE' && !event.repeat) { event.preventDefault(); interact(); }
      if (event.code === 'Escape') { event.preventDefault(); stop(); root.current?.blur(); }
    }}>
    {fallback ? <div className="explorer-static-map">
      <img src="/images/moon-outpost.png" alt="Illustrated Moon outpost" />
      {enabled && <nav className="explorer-map-stations" id="explorer-controls" aria-label="Map stations">
        {MOON_BUILDINGS.filter(({ id }) => id === active || id === 'habitat' || (upgrades >= 3 && (id === 'solar' || id === 'greenhouse')))
          .sort((a, b) => Number(b.id === active) - Number(a.id === active))
          .map(({ id, name }) => <button key={id} data-active={active === id} onClick={() => onMapVisit(id)}>{name}</button>)}
      </nav>}
    </div>
    : webgl === null ? <div className="explorer-preparing" role="status">Preparing your 3D Moon base…</div>
    : <RendererBoundary onFailure={failure}><Canvas shadows camera={{ position: [SPAWN.x, 4.7, SPAWN.z + 8.2], fov: 54, near: .1, far: 220 }} dpr={[1, 1.5]} gl={{ antialias: true, powerPreference: 'high-performance' }} onCreated={({ gl }) => gl.domElement.addEventListener('webglcontextlost', (event) => { event.preventDefault(); if (gl.domElement.isConnected && root.current?.contains(gl.domElement)) failure(); }, { once: true })}>
      <MoonEnvironment3D active={active} near={near} upgrades={upgrades} onWalkTo={(id) => { if (enabled && !dragged.current) walkTo(id); }} />
      <ExplorerController pose={pose} input={input} command={command} orbit={orbit} enabled={enabled} root={root} labels={labels} onNearby={onNearby} onArrive={onArrive} onCancelGuide={clearGuide} onTravel={onTravel} />
      <Astronaut3D id={astronautId} color={suitColor} pose={pose} />
    </Canvas></RendererBoundary>}

    {!fallback && webgl && <>
      <div className="explorer-building-labels" aria-hidden="true">
        {MOON_BUILDINGS.map((building, index) => building.id === active && <span key={building.id}
          ref={(element) => { labels.current[index] = element; }} style={{ borderColor: building.color }}>
          {building.name}
        </span>)}
      </div>
      {!enabled && <div className="explorer-paused">{pauseLabel}</div>}
      {nearbyStation && enabled && !guided && <button className="explorer-interact" onClick={interact}>Open {nearbyStation.name}</button>}
      {guideBuilding && enabled && <div className="explorer-guide" role="status">Walking to {guideBuilding.name.toLowerCase()}…</div>}
      <div className="explorer-dpad" aria-label="On-screen movement controls">{[
        { name: 'forward' as const, label: 'Walk forward', symbol: '↑' }, { name: 'left' as const, label: 'Walk left', symbol: '←' },
        { name: 'back' as const, label: 'Walk backward', symbol: '↓' }, { name: 'right' as const, label: 'Walk right', symbol: '→' },
      ].map((button) => <button key={button.name} className={`dpad-${button.name}`} aria-label={button.label} disabled={!enabled}
        onPointerDown={(event) => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); focus(); input.current[button.name] = true; }}
        onPointerUp={(event) => { input.current[button.name] = false; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}
        onLostPointerCapture={() => { input.current[button.name] = false; }}
        onPointerCancel={() => { input.current[button.name] = false; }}>{button.symbol}</button>)}</div>
    </>}
    {!fallback && <div className="explorer-controls" id="explorer-controls">
      <span className="desktop-controls">WASD / arrows to move · E to interact</span>
      <span>Drag to change view<span className="desktop-controls"> · Scroll to zoom · C to recenter</span></span>
    </div>}
  </div>;
});

export default ThirdPersonOutpost;

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CanvasTexture, CatmullRomCurve3, Color, Group, PlaneGeometry, RepeatWrapping, SRGBColorSpace, Shape, Vector3 } from 'three';
import { BUILDING_SCALE, MOON_BUILDINGS } from './moonWorld';
import type { BuildingId } from './moonWorld';

function makeMoonTexture() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
  const context = canvas.getContext('2d')!;
  let seed = 43;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const pixels = context.createImageData(512, 512);
  for (let i = 0; i < pixels.data.length; i += 4) {
    const x = (i / 4) % 512;
    const y = Math.floor(i / 2048);
    const broad = Math.sin(x * Math.PI / 128 + Math.sin(y * Math.PI / 256)) * 13 + Math.cos((x + y) * Math.PI / 64) * 7;
    const value = 113 + broad + random() * 40;
    pixels.data[i] = value; pixels.data[i + 1] = value; pixels.data[i + 2] = value + 2; pixels.data[i + 3] = 255;
  }
  context.putImageData(pixels, 0, 0);
  for (let i = 0; i < 44; i++) {
    const x = random() * 512, y = random() * 512, radius = 5 + random() ** 1.8 * 25;
    const gradient = context.createRadialGradient(x - radius * .15, y - radius * .15, radius * .1, x, y, radius);
    gradient.addColorStop(0, '#30373c65');
    gradient.addColorStop(.54, '#42484c44');
    gradient.addColorStop(.76, '#c1c3c539');
    gradient.addColorStop(1, '#989fa100');
    context.fillStyle = gradient; context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  const texture = new CanvasTexture(canvas); texture.colorSpace = SRGBColorSpace;
  texture.wrapS = texture.wrapT = RepeatWrapping; texture.repeat.set(9, 9); texture.anisotropy = 4;
  return texture;
}

function makeEarthTexture() {
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 512;
  const context = canvas.getContext('2d')!;
  context.fillStyle = '#16457e'; context.fillRect(0, 0, 1024, 512);
  const land = [
    [[.05, .2], [.12, .12], [.23, .17], [.28, .27], [.22, .38], [.18, .43], [.16, .57], [.12, .4], [.08, .35]],
    [[.21, .46], [.28, .48], [.32, .6], [.29, .77], [.25, .9], [.22, .72]],
    [[.45, .3], [.48, .23], [.55, .26], [.57, .37], [.62, .43], [.57, .67], [.51, .79], [.47, .62], [.44, .44]],
    [[.47, .22], [.53, .13], [.71, .13], [.85, .22], [.87, .34], [.78, .43], [.73, .57], [.67, .42], [.6, .38], [.56, .28]],
    [[.77, .66], [.85, .62], [.91, .72], [.87, .82], [.8, .8]],
    [[.27, .08], [.35, .07], [.36, .19], [.31, .26]],
  ];
  for (const polygon of land) {
    context.beginPath(); polygon.forEach(([x, y], i) => i ? context.lineTo(x * 1024, y * 512) : context.moveTo(x * 1024, y * 512));
    context.closePath();
    const landColor = context.createLinearGradient(0, 75, 0, 450);
    landColor.addColorStop(0, '#78917f');
    landColor.addColorStop(.48, '#7b8761');
    landColor.addColorStop(1, '#af9c76');
    context.fillStyle = landColor;
    context.fill();
  }
  context.lineCap = 'round';
  for (let i = 0; i < 75; i++) {
    const x = (i * 113) % 1024, y = 35 + (i * 47) % 440;
    context.strokeStyle = i % 3 ? '#eaf6fa45' : '#eaf6fa8a';
    context.lineWidth = 2 + (i * 7 % 12);
    context.beginPath();
    context.moveTo(x - 36, y);
    context.bezierCurveTo(x - 5, y - 21, x + 30, y + 22, x + 45 + (i % 6) * 12, y - 8);
    context.stroke();
  }
  context.fillStyle = '#edf7f2'; context.fillRect(0, 0, 1024, 28); context.fillRect(0, 488, 1024, 24);
  const texture = new CanvasTexture(canvas); texture.colorSpace = SRGBColorSpace; return texture;
}

function Portal({ color, z, open }: { color: string; z: number; open: boolean }) {
  const left = useRef<Group>(null);
  const right = useRef<Group>(null);
  useFrame((_, delta) => {
    const step = 1 - Math.exp(-delta * 7);
    const gap = open ? .69 : .245;
    if (left.current) left.current.position.x += (-gap - left.current.position.x) * step;
    if (right.current) right.current.position.x += (gap - right.current.position.x) * step;
  });
  const arch = useMemo(() => {
    const shape = new Shape(); shape.moveTo(-.63, 0); shape.lineTo(-.63, 1.05);
    shape.quadraticCurveTo(-.63, 1.63, 0, 1.63); shape.quadraticCurveTo(.63, 1.63, .63, 1.05); shape.lineTo(.63, 0); shape.closePath(); return shape;
  }, []);
  return <group position={[0, .12, z]}>
    <mesh castShadow><extrudeGeometry args={[arch, { depth: .18, bevelEnabled: true, bevelThickness: .05, bevelSize: .05, bevelSegments: 2, steps: 1 }]} /><meshStandardMaterial color="#7a858e" metalness={.5} roughness={.54} /></mesh>
    <mesh position={[0, .09, .24]} scale={[.8, .86, .15]}><extrudeGeometry args={[arch, { depth: .08, bevelEnabled: false }]} /><meshStandardMaterial color="#25333a" emissive={color} emissiveIntensity={open ? .65 : .24} roughness={.74} /></mesh>
    {[-1, 1].map((side) => <group key={side} ref={side < 0 ? left : right} position={[side * .245, .68, .31]}>
      <mesh castShadow><boxGeometry args={[.48, 1.18, .105]} /><meshStandardMaterial color="#454f58" metalness={.42} roughness={.58} /></mesh>
      <mesh position={[0, .23, .06]}><boxGeometry args={[.24, .19, .026]} /><meshStandardMaterial color="#253e4d" metalness={.3} roughness={.3} /></mesh>
      <mesh position={[-side * .11, -.14, .068]}><boxGeometry args={[.035, .18, .04]} /><meshStandardMaterial color="#bdc7cc" metalness={.55} /></mesh>
    </group>)}
    <mesh position={[0, 0, .45]} receiveShadow><boxGeometry args={[1.65, .16, 1.1]} /><meshStandardMaterial color="#727981" metalness={.32} roughness={.84} /></mesh>
    {[-1, 1].map((side) => <mesh key={side} position={[side * .73, .084, .47]}><boxGeometry args={[.055, .018, .89]} /><meshStandardMaterial color={color} roughness={.8} /></mesh>)}
    <mesh position={[0, 1.85, .15]}><boxGeometry args={[.8, .08, .13]} /><meshBasicMaterial color={color} /></mesh>
    <pointLight position={[0, 1, .8]} color={color} intensity={open ? 3 : .8} distance={5} decay={2} />
  </group>;
}

function Habitat({ open }: { open: boolean }) {
  return <>
    <mesh position={[0, .18, 0]} receiveShadow castShadow><cylinderGeometry args={[2.8, 2.9, .36, 36]} /><meshStandardMaterial color="#ece4f7" metalness={.4} roughness={.6} /></mesh>
    <mesh position={[0, 1.45, 0]} castShadow><cylinderGeometry args={[2.48, 2.55, 2.5, 36]} /><meshStandardMaterial color="#d6d9ee" metalness={.25} roughness={.6} /></mesh>
    {[.45, 2.5].map((y) => <mesh key={y} position={[0, y, 0]}><cylinderGeometry args={[2.58, 2.58, .12, 36]} /><meshStandardMaterial color="#8295ad" metalness={.6} roughness={.4} /></mesh>)}
    <mesh position={[0, 2.74, 0]} scale={[1, .48, 1]} castShadow><sphereGeometry args={[1.7, 28, 18, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color="#374a58" metalness={.5} roughness={.25} /></mesh>
    <mesh position={[0, 2.78, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[1.7, .065, 8, 40]} /><meshBasicMaterial color="#82e9ed" /></mesh>
    {[-1.05, -2.1, 1.05, 2.1, Math.PI].map((angle) => <group key={angle} position={[Math.sin(angle) * 2.53, 1.5, Math.cos(angle) * 2.53]} rotation={[0, angle, 0]}>
      <mesh><boxGeometry args={[1.03, .9, .08]} /><meshStandardMaterial color="#697f9b" metalness={.5} /></mesh>
      <mesh position={[0, 0, .055]}><boxGeometry args={[.85, .7, .02]} /><meshStandardMaterial color="#97d5ee" emissive="#6aabbf" emissiveIntensity={.4} metalness={.3} roughness={.25} /></mesh>
      <mesh position={[0, 0, .08]}><boxGeometry args={[.04, .73, .03]} /><meshStandardMaterial color="#dae4ee" /></mesh>
    </group>)}
    <Portal color="#8ae2d3" z={2.53} open={open} />
    <group position={[-2.62, .9, .2]}>
      <mesh castShadow><capsuleGeometry args={[.31, 1.1, 6, 16]} /><meshStandardMaterial color="#e3e7ee" metalness={.3} /></mesh>
      {[.25, -.3].map((y) => <mesh key={y} position={[0, y, 0]}><cylinderGeometry args={[.325, .325, .12, 16]} /><meshStandardMaterial color="#61bbd9" emissive="#16445a" emissiveIntensity={.4} /></mesh>)}
    </group>
    <mesh position={[1.5, 3.3, -.4]}><cylinderGeometry args={[.025, .025, 1.4, 8]} /><meshStandardMaterial color="#d2dce8" metalness={.7} /></mesh>
    <mesh position={[1.5, 4, -.4]}><sphereGeometry args={[.08, 10, 8]} /><meshBasicMaterial color="#f9d895" /></mesh>
  </>;
}

function Shelter({ open }: { open: boolean }) {
  return <>
    <mesh scale={[1, .74, 1]} castShadow><sphereGeometry args={[2.85, 32, 20, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color="#cab9a8" metalness={.3} roughness={.6} /></mesh>
    {[0, Math.PI / 3, Math.PI * 2 / 3].map((angle) => <mesh key={angle} rotation={[0, angle, 0]} scale={[1, .74, 1]}><torusGeometry args={[2.88, .065, 8, 48, Math.PI]} /><meshStandardMaterial color="#6f7c94" metalness={.4} /></mesh>)}
    {[-1, 1].flatMap((side) => [0, 1, 2, 3].map((i) => <mesh key={`${side}-${i}`} position={[side * (2 + i * .15), .4, -1.5 + i * .7]} scale={[.8, .52, .7]} castShadow><icosahedronGeometry args={[1, 1]} /><meshStandardMaterial color={i % 2 ? '#6f7477' : '#9a9890'} roughness={1} /></mesh>))}
    <Portal color="#ffd08a" z={2.57} open={open} />
    <mesh position={[0, 2.45, -.3]}><cylinderGeometry args={[.06, .09, .9, 12]} /><meshStandardMaterial color="#b5c1d4" metalness={.5} /></mesh>
    <mesh position={[0, 2.95, -.3]}><sphereGeometry args={[.14, 12, 8]} /><meshBasicMaterial color="#ffcd75" /></mesh>
  </>;
}

function Greenhouse({ open }: { open: boolean }) {
  const meridians = useMemo(() => Array.from({ length: 6 }, (_, index) => {
    const angle = index * Math.PI / 6;
    return new CatmullRomCurve3(Array.from({ length: 25 }, (_, step) => {
      const theta = step / 24 * Math.PI;
      return new Vector3(Math.cos(theta) * Math.cos(angle) * 2.7, Math.sin(theta) * 2.7 + .26, Math.cos(theta) * Math.sin(angle) * 2.7);
    }));
  }), []);
  return <>
    <mesh position={[0, .16, 0]} receiveShadow castShadow><cylinderGeometry args={[2.86, 2.95, .32, 40]} /><meshStandardMaterial color="#9da9a9" metalness={.3} roughness={.6} /></mesh>
    <mesh position={[0, .25, 0]}><sphereGeometry args={[2.7, 32, 24, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshPhysicalMaterial color="#92dfcd" transparent opacity={.29} roughness={.1} metalness={.15} depthWrite={false} /></mesh>
    {meridians.map((curve, i) => <mesh key={i}><tubeGeometry args={[curve, 24, .045, 6, false]} /><meshStandardMaterial color="#9aa6a8" metalness={.4} /></mesh>)}
    {[Math.PI / 6, Math.PI / 3, Math.PI / 2].map((angle) => <mesh key={angle} position={[0, Math.cos(angle) * 2.7 + .26, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[Math.sin(angle) * 2.7, .04, 6, 40]} /><meshStandardMaterial color="#9aa6a8" metalness={.4} /></mesh>)}
    {[-1.35, -.45, .45, 1.35].flatMap((x, row) => [-1, 0, 1].map((z, column) => <group key={`${x}-${z}`} position={[x, .3, z]}>
      <mesh castShadow><cylinderGeometry args={[.26, .19, .3, 10]} /><meshStandardMaterial color="#5a584d" roughness={1} /></mesh>
      <mesh position={[0, .36, 0]}><cylinderGeometry args={[.025, .035, .65, 6]} /><meshStandardMaterial color="#597f4c" /></mesh>
      {[0, 1, 2].map((leaf) => <mesh key={leaf} position={[Math.sin(leaf * 2 + row) * .16, .35 + leaf * .1, Math.cos(leaf * 2 + column) * .12]} rotation={[.3, leaf, .6]} scale={[.45, 1, .22]} castShadow><sphereGeometry args={[.32, 10, 8]} /><meshStandardMaterial color={leaf % 2 ? '#82a25b' : '#44693c'} /></mesh>)}
    </group>))}
    <Portal color="#b7d990" z={2.58} open={open} />
    {[-1, 1].map((side) => <mesh key={side} position={[side * 1.65, .2, 2.28]} rotation={[0, side * .6, 0]}><boxGeometry args={[.8, .12, .08]} /><meshBasicMaterial color="#8eebd7" /></mesh>)}
  </>;
}

function Beacon({ color }: { color: string }) {
  const group = useRef<Group>(null);
  useFrame(({ clock }) => { if (group.current) { group.current.position.y = 4.5 + Math.sin(clock.elapsedTime * 2) * .12; group.current.rotation.y = clock.elapsedTime * .5; } });
  return <group ref={group} position={[0, 4.5, 0]}><mesh><octahedronGeometry args={[.28]} /><meshBasicMaterial color={color} /></mesh><pointLight color={color} intensity={1} distance={7} /></group>;
}

function GroundPath({ x, z }: { x: number; z: number }) {
  const distance = Math.hypot(x, z);
  return <group>
    <mesh position={[x / 2, .012, z / 2]} rotation={[-Math.PI / 2, 0, Math.atan2(x, z)]} receiveShadow><planeGeometry args={[1.55, distance]} /><meshStandardMaterial color="#8d849b" roughness={1} /></mesh>
    {Array.from({ length: Math.max(2, Math.floor(distance / 1.5)) }, (_, index) => {
      const t = (index + .5) / Math.max(2, Math.floor(distance / 1.5));
      return <mesh key={index} position={[x * t + .65, .18, z * t]}><cylinderGeometry args={[.065, .065, .44, 8]} /><meshStandardMaterial color="#e7edf1" emissive="#8ae2d3" emissiveIntensity={.4} /></mesh>;
    })}
  </group>;
}

function ResearchLab({ open }: { open: boolean }) {
  return <group>
    <mesh position={[0, .18, 0]} castShadow receiveShadow>
      <cylinderGeometry args={[1.92, 2.05, .36, 8]} /><meshStandardMaterial color="#685880" />
    </mesh>
    <mesh position={[0, 1.29, 0]} castShadow>
      <cylinderGeometry args={[1.66, 1.84, 2.38, 8]} /><meshStandardMaterial color="#e4d8f4" roughness={.48} />
    </mesh>
    <mesh position={[0, 2.48, 0]}>
      <cylinderGeometry args={[1.54, 1.76, .28, 8]} /><meshStandardMaterial color="#625186" />
    </mesh>
    <mesh position={[0, 2.75, 0]} scale={[1, .43, 1]}>
      <sphereGeometry args={[1.3, 24, 16]} /><meshStandardMaterial color="#8a80bf" emissive="#58469c" emissiveIntensity={.38} />
    </mesh>
    <mesh position={[0, 2.30, 1.61]}>
      <boxGeometry args={[1.4, .24, .08]} /><meshBasicMaterial color="#d4b5ff" />
    </mesh>
    <Portal color="#d4b5ff" z={1.75} open={open} />
  </group>;
}

function IceRidge({ active }: { active: boolean }) {
  return <group>
    {[-1, 0, 1].map((offset) => <mesh key={offset} position={[offset * .77, .35, -.3]} scale={[1, .56, 1.16]} castShadow>
      <dodecahedronGeometry args={[.92, 0]} /><meshStandardMaterial color="#687d9a" flatShading />
    </mesh>)}
    {[-.78, 0, .78].map((x) => <mesh key={x} position={[x, 1.05 - Math.abs(x) * .33, .12]} rotation={[0, x, x * -.34]}>
      <octahedronGeometry args={[.56, 0]} /><meshStandardMaterial color="#9adfff" emissive="#237cb5" emissiveIntensity={.42} roughness={.29} />
    </mesh>)}
    {active && <mesh position={[0, 1.3, 1.05]} rotation={[-.2, .22, .1]}>
      <boxGeometry args={[.55, .41, .13]} /><meshStandardMaterial color="#bcfaff" emissive="#72daf3" emissiveIntensity={.8} />
    </mesh>}
  </group>;
}

function SolarArray({ upgraded }: { upgraded: boolean }) {
  return <group position={[0, .75, 0]}>
      {(upgraded ? [-1, 1, 3] : [-1, 1]).map((x) => <group key={x} position={[x === 3 ? 0 : x, 0, x === 3 ? -2.5 : 0]}>
        <mesh position={[0, -.4, 0]}><cylinderGeometry args={[.045, .06, .8, 8]} /><meshStandardMaterial color="#dce5ed" metalness={.6} /></mesh>
        <group rotation={[-.3, 0, 0]}><mesh castShadow><boxGeometry args={[1.7, .1, 2.3]} /><meshStandardMaterial color="#acc0d5" metalness={.6} /></mesh><mesh position={[0, .06, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[1.56, 2.15]} /><meshStandardMaterial color="#244c8a" metalness={.6} roughness={.3} /></mesh>{[-.5, 0, .5].map((z) => <mesh key={z} position={[0, .075, z]}><boxGeometry args={[1.58, .01, .015]} /><meshStandardMaterial color="#789bd4" /></mesh>)}{[-.39, 0, .39].map((z) => <mesh key={z} position={[z, .075, 0]}><boxGeometry args={[.015, .01, 2.15]} /><meshStandardMaterial color="#789bd4" /></mesh>)}</group>
      </group>)}
    </group>;
}

export default function MoonEnvironment3D({ active, near, upgrades, onWalkTo }: { active?: BuildingId; near: BuildingId | null; upgrades: number; onWalkTo: (id: BuildingId) => void }) {
  const moon = useMemo(makeMoonTexture, []);
  const earth = useMemo(makeEarthTexture, []);
  const earthGroup = useRef<Group>(null);
  const terrain = useMemo(() => {
    const geometry = new PlaneGeometry(160, 160, 120, 120);
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i), y = positions.getY(i);
      const edge = Math.max(0, Math.hypot(x, y) - 28);
      positions.setZ(i, Math.min(1, edge / 13) * (2.1 + Math.sin(x * .21) * Math.cos(y * .18) * 3.3 + Math.sin(x * .67 + y * .39) * .65));
    }
    geometry.computeVertexNormals(); return geometry;
  }, []);
  const stars = useMemo(() => {
    const positions = new Float32Array(1700 * 3);
    const colors = new Float32Array(1700 * 3);
    let seed = 91;
    const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    for (let i = 0; i < 1700; i++) {
      const angle = random() * Math.PI * 2, altitude = random() * .95 + .03, radius = 100 + random() * 70;
      positions.set([Math.cos(angle) * radius * Math.sqrt(1 - altitude * altitude), altitude * radius, Math.sin(angle) * radius * Math.sqrt(1 - altitude * altitude)], i * 3);
      const color = new Color(['#ffffff', '#c4d8ff', '#d5c3ff'][Math.floor(random() * 3)]); colors.set([color.r, color.g, color.b], i * 3);
    }
    return { positions, colors };
  }, []);
  useEffect(() => () => { moon.dispose(); earth.dispose(); terrain.dispose(); }, [moon, earth, terrain]);
  useFrame((_, delta) => { if (earthGroup.current) earthGroup.current.rotation.y += delta * .018; });

  return <>
    <color attach="background" args={['#080b1c']} /><fog attach="fog" args={['#242139', 48, 132]} />
    <hemisphereLight args={['#ebe2ff', '#716388', 1.25]} />
    <ambientLight intensity={.19} />
    <directionalLight position={[-19, 15, 7]} color="#fff2dc" intensity={2.7} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-24} shadow-camera-right={24} shadow-camera-top={24} shadow-camera-bottom={-24} shadow-normalBias={.035} />
    <directionalLight position={[16, 8, -16]} color="#b39bff" intensity={1.35} />
    <mesh geometry={terrain} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><meshStandardMaterial map={moon} bumpMap={moon} bumpScale={.048} color="#bdb7cf" roughness={1} /></mesh>
    <points><bufferGeometry><bufferAttribute attach="attributes-position" args={[stars.positions, 3]} /><bufferAttribute attach="attributes-color" args={[stars.colors, 3]} /></bufferGeometry><pointsMaterial size={.17} vertexColors sizeAttenuation fog={false} /></points>
    <group ref={earthGroup} position={[22, 17, -80]}>
      <mesh rotation={[0, -.8, .2]}><sphereGeometry args={[6.1, 48, 32]} /><meshStandardMaterial map={earth} emissive="#1d5599" emissiveIntensity={.2} roughness={.8} fog={false} /></mesh>
      <mesh><sphereGeometry args={[6.28, 40, 28]} /><meshBasicMaterial color="#88c7ff" transparent opacity={.1} depthWrite={false} fog={false} /></mesh>
    </group>
    {MOON_BUILDINGS.map((building) => <group key={building.id} position={[building.x, 0, building.z]} onClick={(event) => { event.stopPropagation(); onWalkTo(building.id); }}>
      <group scale={BUILDING_SCALE}>
        {building.id === 'habitat' && <Habitat open={near === building.id} />}
        {building.id === 'shelter' && <Shelter open={near === building.id} />}
        {building.id === 'greenhouse' && <Greenhouse open={near === building.id} />}
        {building.id === 'solar' && <SolarArray upgraded={upgrades >= 1} />}
        {building.id === 'lab' && <ResearchLab open={near === building.id} />}
        {building.id === 'ridge' && <IceRidge active={active === 'ridge'} />}
        {building.id === 'horizon' && <group scale={.91}><Habitat open={upgrades >= 3 && near === 'horizon'} /></group>}
        {active === building.id && <Beacon color={building.color} />}
      </group>
      {active === building.id && <><mesh position={[0, .045, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[building.radius + .1, building.radius + .19, 60]} /><meshBasicMaterial color={building.color} transparent opacity={.7} /></mesh></>}
    </group>)}
    {MOON_BUILDINGS.map((building) => <GroundPath key={building.id} {...building.door} />)}
    {upgrades >= 2 && <group position={[15, .32, 7.2]}>
      {[-.75, 0, .75].map((x) => <group key={x} position={[x, .14, .72]}>
        <mesh><boxGeometry args={[.51, .30, .57]} /><meshStandardMaterial color="#9a765b" /></mesh>
        <mesh position={[0, .31, 0]}><sphereGeometry args={[.23, 14, 10]} /><meshStandardMaterial color="#a3e274" /></mesh>
      </group>)}
    </group>}
    <group position={[-12, .72, 10]} rotation={[0, .5, 0]}>
      <mesh castShadow><boxGeometry args={[1.6, .6, 2.1]} /><meshStandardMaterial color="#dde5ec" metalness={.35} /></mesh>
      <mesh position={[0, .55, -.25]} castShadow><boxGeometry args={[1.15, .65, 1.1]} /><meshStandardMaterial color="#ebedf3" /></mesh>
      <mesh position={[0, .58, .315]}><boxGeometry args={[.98, .43, .04]} /><meshStandardMaterial color="#244968" emissive="#163b60" emissiveIntensity={.3} /></mesh>
      {[-1, 1].flatMap((side) => [-.72, .72].map((z) => <mesh key={`${side}-${z}`} position={[side * .88, -.35, z]} rotation={[0, 0, Math.PI / 2]} castShadow><cylinderGeometry args={[.4, .4, .25, 14]} /><meshStandardMaterial color="#394157" roughness={1} /></mesh>))}
      <mesh position={[.55, 1.3, -.7]}><cylinderGeometry args={[.02, .025, 1.2, 6]} /><meshStandardMaterial color="#b5c3d3" /></mesh>
    </group>
    {Array.from({ length: 64 }, (_, i) => {
      const angle = i * 2.39996, radius = 12 + (i % 17) * 1.39;
      const size = radius > 22 ? .52 + i % 5 * .22 : .13 + i % 4 * .065;
      return <mesh key={i} position={[Math.cos(angle) * radius, size * .16, Math.sin(angle) * radius]} rotation={[i * .31, i, .3]} scale={[size * 1.25, size * .61, size]} castShadow>
        <dodecahedronGeometry args={[1, 0]} /><meshStandardMaterial color={i % 2 ? '#727773' : '#999991'} roughness={.99} flatShading />
      </mesh>;
    })}
  </>;
}

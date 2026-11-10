import { Component, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import type { ModuleId } from '../api';

const modules: { id: ModuleId; position: [number, number, number]; color: string }[] = [
  { id: 'habitat', position: [-2.1, 0, 0.4], color: '#70dfce' },
  { id: 'shelter', position: [0.5, 0, -1.5], color: '#ffa66c' },
  { id: 'greenhouse', position: [2.5, 0, 0.9], color: '#b9dd83' },
];

function Building({ id, position, color, active, onSelect }: typeof modules[number] & { active: boolean; onSelect: (id: ModuleId) => void }) {
  const [hovered, setHovered] = useState(false);
  const beacon = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (beacon.current) beacon.current.position.y = 2.1 + Math.sin(clock.elapsedTime * 2) * 0.12;
  });
  return (
    <group position={position} onClick={(event) => { event.stopPropagation(); onSelect(id); }}
      onPointerOver={(event) => { event.stopPropagation(); setHovered(true); }} onPointerOut={() => setHovered(false)}>
      <mesh position={[0, 0.12, 0]} receiveShadow>
        <cylinderGeometry args={[1.15, 1.25, 0.24, 6]} />
        <meshStandardMaterial color={active ? color : '#526371'} metalness={0.4} roughness={0.65} />
      </mesh>
      <mesh position={[0, 0.72, 0]} castShadow>
        {id === 'greenhouse' ? <sphereGeometry args={[0.95, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2]} /> : <boxGeometry args={[1.55, 1.05, 1.25]} />}
        <meshStandardMaterial color={hovered || active ? '#d7e4e6' : '#94a4b4'} roughness={0.45} metalness={0.3} />
      </mesh>
      {[ -0.46, 0, 0.46 ].map((x) => (
        <mesh key={x} position={[x, 0.86, 0.641]}>
          <boxGeometry args={[0.27, 0.32, 0.025]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={active ? 1 : 0.25} />
        </mesh>
      ))}
      <mesh position={[0, 1.3, 0]} castShadow>
        <boxGeometry args={[1.7, 0.12, 1.42]} />
        <meshStandardMaterial color="#e6eded" />
      </mesh>
      {active && <group ref={beacon} position={[0, 2.1, 0]}>
        <mesh rotation={[0, 0, Math.PI]}>
          <coneGeometry args={[0.18, 0.3, 4]} />
          <meshBasicMaterial color={color} />
        </mesh>
      </group>}
    </group>
  );
}

function World({ active, onSelect }: { active?: ModuleId; onSelect: (id: ModuleId) => void }) {
  return <>
    <color attach="background" args={['#101c2a']} />
    <ambientLight intensity={1.1} />
    <directionalLight position={[-5, 9, 4]} intensity={3} castShadow shadow-mapSize={[1024, 1024]} />
    <hemisphereLight args={['#c4e8ff', '#3a3b4a', 1]} />
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <circleGeometry args={[9, 64]} />
      <meshStandardMaterial color="#49515d" roughness={1} />
    </mesh>
    <gridHelper args={[18, 18, '#6b7884', '#56616e']} position={[0, 0.012, 0]} />
    {[[-4, -2, 0.6], [3.8, -3, 0.9], [-3.2, 2.9, 0.8], [0, 3.8, 0.45]].map(([x, z, scale], i) => (
      <mesh key={i} position={[x, 0.12, z]} scale={[scale, 0.3, scale]}>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial color="#68717b" roughness={1} />
      </mesh>
    ))}
    <group position={[-0.6, 0.42, 1.8]} rotation={[0, -0.2, 0]}>
      <mesh castShadow><boxGeometry args={[1.6, 0.1, 0.8]} /><meshStandardMaterial color="#315e9d" metalness={0.65} roughness={0.35} /></mesh>
      <mesh position={[0, -0.22, 0]}><cylinderGeometry args={[0.045, 0.045, 0.5]} /><meshStandardMaterial color="#d5dce2" /></mesh>
    </group>
    {modules.map((module) => <Building key={module.id} {...module} active={active === module.id} onSelect={onSelect} />)}
    <mesh position={[-7, 6, -9]}><sphereGeometry args={[1.3, 32, 32]} /><meshStandardMaterial color="#5a9bd7" emissive="#173e63" emissiveIntensity={0.5} /></mesh>
  </>;
}

class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <div className="scene-fallback">3D view unavailable. Use the module buttons below to continue your mission.</div>;
    return this.props.children;
  }
}

export default function Outpost({ active, onSelect }: { active?: ModuleId; onSelect: (id: ModuleId) => void }) {
  const [canRender, setCanRender] = useState(false);
  useEffect(() => {
    const canvas = document.createElement('canvas');
    try {
      const context = canvas.getContext('webgl2');
      setCanRender(Boolean(context));
      context?.getExtension('WEBGL_lose_context')?.loseContext();
    } catch { setCanRender(false); }
  }, []);
  return <SceneBoundary>
    {canRender ? <Canvas shadows camera={{ position: [8, 8, 11], fov: 43 }} onCreated={({ camera }) => camera.lookAt(0, 0, 0)} dpr={[1, 1.5]}>
      <World active={active} onSelect={onSelect} />
    </Canvas> : <div className="scene-fallback">Your outpost is ready. Use the module buttons below to explore.</div>}
  </SceneBoundary>;
}

import { useMemo, useRef } from 'react';
import type { RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { CatmullRomCurve3, Color, Group, Vector3 } from 'three';
import type { Point } from './moonWorld';

export type ExplorerPose = { position: Point; angle: number; moving: boolean; walk: number };
export default function Astronaut3D({ id, color, pose }: { id: string; color: string; pose: RefObject<ExplorerPose> }) {
  const root = useRef<Group>(null);
  const leftLeg = useRef<Group>(null);
  const rightLeg = useRef<Group>(null);
  const leftArm = useRef<Group>(null);
  const rightArm = useRef<Group>(null);
  const currentAngle = useRef(Math.PI);
  const suit = useMemo(() => new Color(({ nova: '#9563d6', leo: '#367bce', maya: '#e77d37', kai: '#279d92' } as Record<string, string>)[id] ?? color), [id, color]);
  const armor = useMemo(() => suit.clone().lerp(new Color('#d5dce5'), .16), [suit]);
  const fabric = useMemo(() => suit.clone().multiplyScalar(.62), [suit]);
  const skin = id === 'nova' ? '#a96d42' : id === 'kai' ? '#74462d' : id === 'maya' ? '#f3bd95' : '#c78e5e';
  const hair = id === 'maya' ? '#b14b25' : id === 'kai' ? '#211b1c' : '#382620';
  const hose = useMemo(() => new CatmullRomCurve3([
    new Vector3(-.21, 1.63, -.48), new Vector3(-.48, 1.32, -.22),
    new Vector3(-.43, 1.23, .25), new Vector3(-.19, 1.49, .34),
  ]), []);

  useFrame(({ clock }, delta) => {
    if (!root.current) return;
    const state = pose.current;
    const difference = Math.atan2(Math.sin(state.angle - currentAngle.current), Math.cos(state.angle - currentAngle.current));
    currentAngle.current += difference * Math.min(1, delta * 11);
    root.current.position.set(state.position.x, state.moving ? Math.abs(Math.sin(state.walk * 2)) * .038 : Math.sin(clock.elapsedTime * 1.6) * .012, state.position.z);
    root.current.rotation.y = currentAngle.current;
    const gait = state.moving ? Math.sin(state.walk) : 0;
    if (leftLeg.current) leftLeg.current.rotation.x = gait * .45;
    if (rightLeg.current) rightLeg.current.rotation.x = -gait * .45;
    if (leftArm.current) leftArm.current.rotation.x = -gait * .33;
    if (rightArm.current) rightArm.current.rotation.x = gait * .33;
  });

  return <group ref={root} name={`astronaut-${id}`}>
    <mesh position={[0, 1.52, 0]} scale={[1, 1, .79]} castShadow>
      <capsuleGeometry args={[.31, .52, 8, 24]} /><meshStandardMaterial color={fabric} roughness={.89} />
    </mesh>
    <mesh position={[0, 1.64, .16]} scale={[1, 1.13, .52]} castShadow>
      <sphereGeometry args={[.33, 24, 16]} /><meshStandardMaterial color={suit} roughness={.57} />
    </mesh>
    <mesh position={[0, 1.19, 0]} scale={[1, .73, .81]} castShadow>
      <sphereGeometry args={[.34, 20, 16]} /><meshStandardMaterial color={suit} roughness={.8} />
    </mesh>
    <mesh position={[0, 1.24, 0]} scale={[1, 1, .83]}>
      <cylinderGeometry args={[.35, .35, .09, 24]} /><meshStandardMaterial color="#292f3a" roughness={.75} />
    </mesh>
    <mesh position={[0, 1.24, .3]}>
      <boxGeometry args={[.12, .094, .05]} /><meshStandardMaterial color="#b9c3cb" metalness={.55} roughness={.48} />
    </mesh>

    <group position={[0, 1.63, -.34]}>
      <mesh castShadow><boxGeometry args={[.59, .8, .31]} /><meshStandardMaterial color="#353c46" metalness={.28} roughness={.68} /></mesh>
      <mesh position={[0, .035, -.19]} castShadow><boxGeometry args={[.51, .63, .13]} /><meshStandardMaterial color={suit} metalness={.2} roughness={.5} /></mesh>
      <mesh position={[0, .25, -.263]}><boxGeometry args={[.39, .11, .014]} /><meshStandardMaterial color="#b7c1c7" metalness={.48} roughness={.4} /></mesh>
      {[-.08, 0, .08].map((x) => <mesh key={x} position={[x, -.12, -.267]}>
        <boxGeometry args={[.04, .23, .02]} /><meshStandardMaterial color="#29323c" metalness={.45} roughness={.59} />
      </mesh>)}
      {[-1, 1].map((side) => <group key={side} position={[side * .31, -.07, -.09]}>
        <mesh castShadow><capsuleGeometry args={[.08, .44, 6, 14]} /><meshStandardMaterial color="#a0aab4" metalness={.5} roughness={.5} /></mesh>
        {[-.16, .16].map((y) => <mesh key={y} position={[0, y, 0]}>
          <cylinderGeometry args={[.085, .085, .06, 14]} /><meshStandardMaterial color={armor} roughness={.64} />
        </mesh>)}
      </group>)}
      <mesh position={[0, .27, -.274]}><boxGeometry args={[.075, .021, .01]} /><meshBasicMaterial color="#83ded6" /></mesh>
    </group>
    <mesh position={[0, 1.62, .325]}><boxGeometry args={[.31, .23, .085]} /><meshStandardMaterial color="#c2cbd2" metalness={.42} roughness={.47} /></mesh>
    <mesh position={[0, 1.656, .373]}><boxGeometry args={[.23, .08, .015]} /><meshStandardMaterial color="#173347" emissive="#2a8093" emissiveIntensity={.25} /></mesh>
    {[-.068, 0, .068].map((x) => <mesh key={x} position={[x, 1.655, .384]}>
      <boxGeometry args={[.024, .026, .008]} /><meshBasicMaterial color="#90e6da" />
    </mesh>)}
    <mesh><tubeGeometry args={[hose, 20, .033, 8, false]} /><meshStandardMaterial color="#929da9" metalness={.38} roughness={.65} /></mesh>

    {[-1, 1].map((side) => <group key={side} ref={side === -1 ? leftLeg : rightLeg} position={[side * .172, 1.15, 0]}>
      <mesh position={[0, -.28, 0]} castShadow><capsuleGeometry args={[.146, .35, 6, 18]} /><meshStandardMaterial color={suit} roughness={.86} /></mesh>
      <mesh position={[0, -.52, .055]} scale={[1, .92, .64]} castShadow><sphereGeometry args={[.174, 16, 12]} /><meshStandardMaterial color="#424b55" roughness={.8} /></mesh>
      <mesh position={[0, -.5, .148]} scale={[1, 1.1, .31]}><sphereGeometry args={[.13, 16, 12]} /><meshStandardMaterial color={armor} metalness={.16} roughness={.52} /></mesh>
      <mesh position={[0, -.77, 0]} castShadow><capsuleGeometry args={[.13, .30, 6, 18]} /><meshStandardMaterial color={fabric} roughness={.83} /></mesh>
      <mesh position={[0, -.9, 0]}><cylinderGeometry args={[.152, .158, .095, 18]} /><meshStandardMaterial color={armor} roughness={.55} /></mesh>
      <mesh position={[0, -1.005, .087]} scale={[.87, .64, 1.45]} castShadow><sphereGeometry args={[.19, 20, 14]} /><meshStandardMaterial color="#adb8c3" roughness={.68} /></mesh>
      <mesh position={[0, -1.11, .087]}><boxGeometry args={[.31, .071, .45]} /><meshStandardMaterial color="#2e343c" roughness={.95} /></mesh>
    </group>)}
    {[-1, 1].map((side) => <group key={side} ref={side === -1 ? leftArm : rightArm} position={[side * .351, 1.86, .018]} rotation={[0, 0, side * .125]}>
      <mesh position={[side * .035, -.067, 0]} scale={[.95, 1, .91]} castShadow><sphereGeometry args={[.16, 18, 14]} /><meshStandardMaterial color={armor} roughness={.52} /></mesh>
      <mesh position={[side * .046, -.237, 0]} castShadow><capsuleGeometry args={[.109, .235, 6, 16]} /><meshStandardMaterial color={suit} roughness={.81} /></mesh>
      {[-.365, -.397].map((y) => <mesh key={y} position={[side * .046, y, 0]}>
        <cylinderGeometry args={[.118, .118, .023, 14]} /><meshStandardMaterial color="#373f49" roughness={.92} />
      </mesh>)}
      <mesh position={[side * .046, -.49, .024]} castShadow><capsuleGeometry args={[.104, .125, 6, 16]} /><meshStandardMaterial color={armor} roughness={.72} /></mesh>
      <mesh position={[side * .046, -.6, .028]}><cylinderGeometry args={[.115, .115, .058, 16]} /><meshStandardMaterial color="#a4b1be" metalness={.35} roughness={.48} /></mesh>
      <mesh position={[side * .046, -.696, .04]} scale={[.86, 1.25, .77]} castShadow><sphereGeometry args={[.116, 16, 12]} /><meshStandardMaterial color="#aeb9c4" roughness={.78} /></mesh>
      <mesh position={[side * -.026, -.672, .087]} scale={[.86, 1.3, .84]}><sphereGeometry args={[.051, 12, 10]} /><meshStandardMaterial color="#aeb9c4" roughness={.78} /></mesh>
    </group>)}

    <group position={[0, 2.25, 0]} scale={[.82, .8, .85]}>
      <group position={[0, -.04, .015]} scale={[.9, .89, .9]}>
      <mesh scale={[.92, 1, .91]} castShadow><sphereGeometry args={[.48, 24, 20]} /><meshStandardMaterial color={skin} roughness={.85} /></mesh>
      <mesh position={[0, .16, -.075]} scale={[1, .8, .9]}><sphereGeometry args={[.47, 20, 16]} /><meshStandardMaterial color={hair} roughness={1} /></mesh>
      {[ -.27, -.12, .04, .2, .31 ].map((x, i) => <mesh key={x} position={[x, .29 - Math.abs(x) * .16, .31]} scale={[1.1, .8, .8]}><sphereGeometry args={[.125 + (i % 2) * .02, 10, 8]} /><meshStandardMaterial color={hair} /></mesh>)}
      {[-1, 1].map((side) => <group key={side}>
        <mesh position={[side * .165, .035, .404]} scale={[.85, 1.08, .65]}><sphereGeometry args={[.081, 16, 12]} /><meshStandardMaterial color="#fffaf4" /></mesh>
        <mesh position={[side * .165, .035, .463]}><sphereGeometry args={[.04, 12, 10]} /><meshStandardMaterial color="#211b22" roughness={.3} /></mesh>
        <mesh position={[side * .15, .055, .501]}><sphereGeometry args={[.012, 8, 8]} /><meshBasicMaterial color="white" /></mesh>
        <mesh position={[side * .23, -.08, .386]} scale={[1.2, .65, .25]}><sphereGeometry args={[.065, 12, 8]} /><meshStandardMaterial color={id === 'maya' ? '#e99279' : '#bc7556'} /></mesh>
      </group>)}
      <mesh position={[0, -.045, .45]} scale={[1, .8, 1]}><sphereGeometry args={[.057, 12, 10]} /><meshStandardMaterial color={skin} /></mesh>
      <mesh position={[0, -.135, .422]} rotation={[0, 0, Math.PI]}><torusGeometry args={[.096, .012, 7, 20, Math.PI]} /><meshStandardMaterial color="#6a3530" /></mesh>
      {id === 'nova' && [-1, 1].map((side) => <mesh key={side} position={[side * .37, .18, -.02]} scale={[1, 1.08, .9]}><sphereGeometry args={[.16, 12, 10]} /><meshStandardMaterial color={hair} /></mesh>)}
      {id === 'maya' && [-1, 1].flatMap((side) => [0, 1, 2, 3].map((index) => <mesh key={`${side}-${index}`} position={[side * (.36 + index * .015), -.01 - index * .115, -.035]}><sphereGeometry args={[.1 - index * .01, 10, 8]} /><meshStandardMaterial color={hair} /></mesh>))}
      </group>
      <mesh castShadow><sphereGeometry args={[.61, 32, 24, Math.PI, Math.PI, 0, Math.PI]} /><meshPhysicalMaterial color={suit} metalness={.18} roughness={.46} clearcoat={.26} /></mesh>
      <mesh position={[0, -.48, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[.435, .085, 12, 36]} /><meshStandardMaterial color="#343d49" metalness={.48} roughness={.48} /></mesh>
      <mesh position={[0, -.506, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[.44, .038, 10, 32]} /><meshStandardMaterial color="#bfcbd3" metalness={.45} roughness={.47} /></mesh>
      <mesh position={[0, .008, .29]} scale={[1, .86, 1]}><torusGeometry args={[.527, .06, 12, 48]} /><meshStandardMaterial color="#252e39" metalness={.43} roughness={.49} /></mesh>
      <mesh position={[0, .008, .324]} scale={[1, .86, 1]}><torusGeometry args={[.527, .024, 10, 48]} /><meshStandardMaterial color="#a4b3c1" metalness={.4} roughness={.45} /></mesh>
      <mesh position={[0, .008, .28]} scale={[1, .86, .58]}><sphereGeometry args={[.523, 32, 24, 0, Math.PI]} /><meshPhysicalMaterial color="#82aac2" transparent opacity={.23} roughness={.17} metalness={.12} clearcoat={.8} depthWrite={false} /></mesh>
      {[-1, 1].map((side) => <group key={side} position={[side * .546, -.03, .02]} rotation={[0, 0, Math.PI / 2]}>
        <mesh><cylinderGeometry args={[.179, .179, .1, 20]} /><meshStandardMaterial color="#353e47" metalness={.38} roughness={.48} /></mesh>
        <mesh position={[0, -side * .056, 0]}><cylinderGeometry args={[.119, .119, .024, 18]} /><meshStandardMaterial color={armor} metalness={.2} roughness={.46} /></mesh>
      </group>)}
      <mesh position={[.45, .24, .32]} rotation={[0, .26, 0]}><boxGeometry args={[.13, .075, .11]} /><meshStandardMaterial color="#35424c" metalness={.45} /></mesh>
      <mesh position={[.454, .24, .381]}><boxGeometry args={[.071, .036, .012]} /><meshBasicMaterial color="#f9e4b8" /></mesh>
    </group>
  </group>;
}

import { useMemo, useRef } from 'react';
import type { RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { CatmullRomCurve3, Color, Group, MathUtils, Vector3 } from 'three';
import type { Point } from './moonWorld';
import { ANKLE_HEIGHT, createGait, HIP_HEIGHT, resetGait, SHIN_LENGTH, solveKnee, STEP_LENGTH, THIGH_LENGTH, updateGait } from './astronautWalk';

export type ExplorerPose = { position: Point; angle: number; facing: number; moving: boolean; distance: number; reset: number };

const down = new Vector3(0, -1, 0);

function aimLimb(limb: Group, from: Vector3, to: Vector3, length: number, direction: Vector3) {
  limb.position.copy(from);
  direction.subVectors(to, from);
  limb.scale.y = direction.length() / length;
  limb.quaternion.setFromUnitVectors(down, direction.normalize());
}

export default function Astronaut3D({ id, color, pose }: { id: string; color: string; pose: RefObject<ExplorerPose> }) {
  const root = useRef<Group>(null);
  const torso = useRef<Group>(null);
  const head = useRef<Group>(null);
  const eyes = useRef<Group>(null);
  const upperLegs = useRef<(Group | null)[]>([]);
  const lowerLegs = useRef<(Group | null)[]>([]);
  const boots = useRef<(Group | null)[]>([]);
  const arms = useRef<(Group | null)[]>([]);
  const elbows = useRef<(Group | null)[]>([]);
  const activeReset = useRef(-1);
  const walkBlend = useRef(0);
  const gait = useMemo(() => ({
    walk: createGait(),
    hip: new Vector3(),
    knee: new Vector3(),
    ankle: new Vector3(),
    axis: new Vector3(),
    forward: new Vector3(0, 0, 1),
  }), []);
  const suit = useMemo(() => new Color(({ nova: '#a277db', leo: '#2e70d4', maya: '#f58b32', kai: '#139e93' } as Record<string, string>)[id] ?? color), [id, color]);
  const armor = '#e5dcea';
  const fabric = useMemo(() => suit.clone().multiplyScalar(.83), [suit]);
  const skin = id === 'nova' ? '#a96d42' : id === 'kai' ? '#74462d' : id === 'maya' ? '#f3bd95' : '#c78e5e';
  const hair = id === 'maya' ? '#b14b25' : id === 'kai' ? '#211b1c' : '#382620';
  const hose = useMemo(() => new CatmullRomCurve3([
    new Vector3(-.21, 1.63, -.48), new Vector3(-.48, 1.32, -.22),
    new Vector3(-.43, 1.23, .25), new Vector3(-.19, 1.49, .34),
  ]), []);

  useFrame(({ clock }, rawDelta) => {
    if (!root.current || !torso.current || !head.current || !eyes.current) return;
    const delta = Math.min(rawDelta, .05);
    const { position, angle, facing: yaw, moving, distance, reset } = pose.current;
    if (activeReset.current !== reset) {
      activeReset.current = reset;
      walkBlend.current = 0;
      resetGait(gait.walk, position.x, position.z, angle);
    }

    const turn = Math.atan2(Math.sin(angle - yaw), Math.cos(angle - yaw));
    const sinYaw = Math.sin(yaw);
    const cosYaw = Math.cos(yaw);
    root.current.position.set(position.x, 0, position.z);
    root.current.rotation.y = yaw;

    walkBlend.current = MathUtils.damp(walkBlend.current, Number(moving), 12, delta);
    const strength = walkBlend.current;
    updateGait(gait.walk, position.x, position.z, angle, yaw, distance, moving, delta);
    const step = 1 - gait.walk.nextFoot;
    const stepFraction = MathUtils.clamp((distance - gait.walk.stepStart) / STEP_LENGTH, 0, 1);
    const swing = -Math.cos(Math.PI * stepFraction) * strength * (step === 0 ? 1 : -1);
    const phase = distance * Math.PI / STEP_LENGTH;
    const weightShift = .037 * swing;
    const hipY = HIP_HEIGHT + .027 * Math.cos(phase * 2) * strength;
    torso.current.position.set(weightShift, hipY - HIP_HEIGHT, 0);
    torso.current.rotation.set(.055 * strength, -.10 * swing, -.04 * swing);

    // The head anticipates turns and compensates for the shoulder swing.
    head.current.rotation.y = MathUtils.clamp(turn * .28, -.42, .42) + .07 * swing;
    head.current.rotation.x = -.055 * strength + .025 * Math.sin(phase * 2) * strength;
    const blink = Math.max(0, 1 - Math.abs((clock.elapsedTime % 4.3) - 4.08) / .09);
    eyes.current.scale.y = 1 - .88 * blink;

    gait.walk.feet.forEach((foot, index) => {
      const upper = upperLegs.current[index];
      const lower = lowerLegs.current[index];
      const boot = boots.current[index];
      const arm = arms.current[index];
      const elbow = elbows.current[index];
      if (!upper || !lower || !boot || !arm || !elbow) return;

      const dx = foot.position.x - position.x;
      const dz = foot.position.z - position.z;
      gait.hip.set(foot.side * .185 + weightShift, hipY, 0);
      gait.ankle.set(cosYaw * dx - sinYaw * dz, foot.position.y, sinYaw * dx + cosYaw * dz);
      solveKnee(gait.hip, gait.ankle, gait.knee, gait.axis, gait.forward);
      aimLimb(upper, gait.hip, gait.knee, THIGH_LENGTH, gait.axis);
      aimLimb(lower, gait.knee, gait.ankle, SHIN_LENGTH, gait.axis);
      boot.position.copy(gait.ankle);
      boot.rotation.set(Math.sin(Math.PI * gait.walk.progress * 2) * .18 * Number(gait.walk.swingFoot === index) * strength, foot.yaw - yaw, 0);
      arm.rotation.x = -foot.side * swing * .32;
      elbow.rotation.x = -.12 - Math.max(0, -arm.rotation.x) * .65;
    });
  });

  return <group ref={root} name={`astronaut-${id}`}>
    <group ref={torso}>
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
        <mesh castShadow><boxGeometry args={[.59, .8, .31]} /><meshStandardMaterial color={armor} metalness={.13} roughness={.68} /></mesh>
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

      {[-1, 1].map((side, index) => <group key={side} ref={(node) => { arms.current[index] = node; }} position={[side * .35, 1.84, .018]} rotation={[0, 0, side * .14]}>
        <mesh position={[side * .035, -.067, 0]} scale={[.95, 1, .91]} castShadow>
          <sphereGeometry args={[.16, 18, 14]} /><meshStandardMaterial color={armor} roughness={.52} />
        </mesh>
        <mesh position={[side * .045, -.23, 0]} castShadow>
          <capsuleGeometry args={[.112, .21, 6, 16]} /><meshStandardMaterial color={suit} roughness={.81} />
        </mesh>
        <group ref={(node) => { elbows.current[index] = node; }} position={[side * .045, -.37, 0]}>
          <mesh position={[0, -.11, .02]} castShadow>
            <capsuleGeometry args={[.109, .15, 6, 16]} /><meshStandardMaterial color={suit} roughness={.72} />
          </mesh>
          <mesh position={[0, -.22, .027]}>
            <cylinderGeometry args={[.12, .12, .075, 16]} /><meshStandardMaterial color={armor} roughness={.48} />
          </mesh>
          <mesh position={[0, -.31, .04]} scale={[.86, 1.23, .79]} castShadow>
            <sphereGeometry args={[.115, 16, 12]} /><meshStandardMaterial color={armor} roughness={.78} />
          </mesh>
        </group>
      </group>)}

      <group ref={head} position={[0, 2.27, 0]} scale={[.94, .94, .94]}>
        <group position={[0, -.04, .015]} scale={[.9, .89, .9]}>
          <mesh scale={[.92, 1, .91]} castShadow><sphereGeometry args={[.48, 24, 20]} /><meshStandardMaterial color={skin} roughness={.85} /></mesh>
          <mesh position={[0, .16, -.075]} scale={[1, .8, .9]}><sphereGeometry args={[.47, 20, 16]} /><meshStandardMaterial color={hair} roughness={1} /></mesh>
          {[ -.27, -.12, .04, .2, .31 ].map((x, i) => <mesh key={x} position={[x, .29 - Math.abs(x) * .16, .31]} scale={[1.1, .8, .8]}><sphereGeometry args={[.125 + (i % 2) * .02, 10, 8]} /><meshStandardMaterial color={hair} /></mesh>)}
          <group position={[0, .035, 0]} ref={eyes}>
            {[-1, 1].map((side) => <group key={side} position={[side * .16, 0, 0]}>
              <mesh position={[0, 0, .399]} scale={[1, 1.15, .69]}><sphereGeometry args={[.093, 18, 14]} /><meshStandardMaterial color="#fff7eb" /></mesh>
              <mesh position={[0, 0, .461]}><sphereGeometry args={[.058, 16, 12]} /><meshStandardMaterial color={id === 'maya' ? '#52754a' : '#75482e'} roughness={.42} /></mesh>
              <mesh position={[0, 0, .502]}><sphereGeometry args={[.03, 14, 10]} /><meshStandardMaterial color="#201623" roughness={.3} /></mesh>
              <mesh position={[-.016, .023, .521]}><sphereGeometry args={[.014, 10, 8]} /><meshBasicMaterial color="#fff8ee" /></mesh>
            </group>)}
        </group>
        {[-1, 1].map((side) => <group key={side}>
          <mesh position={[side * .165, .154, .399]} rotation={[0, side * .22, Math.PI / 2 + side * -.16]}>
            <capsuleGeometry args={[.021, .095, 5, 10]} /><meshStandardMaterial color={hair} />
          </mesh>
          <mesh position={[side * .235, -.075, .366]} scale={[1.15, .62, .3]}><sphereGeometry args={[.07, 12, 8]} /><meshStandardMaterial color={id === 'maya' ? '#e99279' : '#bc7556'} /></mesh>
          {id === 'maya' && [0, 1, 2].map((freckle) => <mesh key={freckle} position={[side * (.182 + freckle * .037), -.063 - freckle % 2 * .025, .405 - freckle * .021]}><sphereGeometry args={[.012, 8, 6]} /><meshStandardMaterial color="#b56947" /></mesh>)}
        </group>)}
        <mesh position={[0, -.045, .45]} scale={[1, .8, 1]}><sphereGeometry args={[.057, 12, 10]} /><meshStandardMaterial color={skin} /></mesh>
        <mesh position={[0, -.135, .422]} rotation={[0, 0, Math.PI]}><torusGeometry args={[.096, .012, 7, 20, Math.PI]} /><meshStandardMaterial color="#6a3530" /></mesh>
        {id === 'nova' && [-1, 1].map((side) => <mesh key={side} position={[side * .37, .18, -.02]} scale={[1, 1.08, .9]}><sphereGeometry args={[.16, 12, 10]} /><meshStandardMaterial color={hair} /></mesh>)}
        </group>
        {id === 'maya' && [-1, 1].map((side) => <group key={side} position={[side * .39, -.15, -.15]} rotation={[.14, 0, side * .21]}>
          {[0, 1, 2, 3].map((segment) => <mesh key={segment} position={[0, -segment * .103, segment % 2 * .025]} scale={[.86, 1.16, 1]} castShadow>
            <sphereGeometry args={[.107 - segment * .012, 12, 10]} /><meshStandardMaterial color={hair} roughness={.87} />
          </mesh>)}
          <mesh position={[0, -.37, .018]}><sphereGeometry args={[.061, 10, 8]} /><meshStandardMaterial color="#f6ad52" /></mesh>
        </group>)}
        <mesh position={[0, .07, -.13]} scale={[.93, .91, .87]}><sphereGeometry args={[.49, 28, 18]} /><meshStandardMaterial color={hair} roughness={.87} /></mesh>
        <mesh><sphereGeometry args={[.61, 32, 24, Math.PI, Math.PI, 0, Math.PI]} /><meshPhysicalMaterial color="#c5b4f2" transparent opacity={.28} roughness={.14} metalness={.12} depthWrite={false} /></mesh>
        <mesh position={[0, -.48, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[.435, .085, 12, 36]} /><meshStandardMaterial color="#343d49" metalness={.48} roughness={.48} /></mesh>
        <mesh position={[0, -.506, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[.44, .038, 10, 32]} /><meshStandardMaterial color="#bfcbd3" metalness={.45} roughness={.47} /></mesh>
        <mesh position={[0, .008, .29]} scale={[1, .86, 1]}><torusGeometry args={[.527, .06, 12, 48]} /><meshStandardMaterial color="#c6bbd8" metalness={.20} roughness={.49} /></mesh>
        <mesh position={[0, .008, .324]} scale={[1, .86, 1]}><torusGeometry args={[.527, .024, 10, 48]} /><meshStandardMaterial color="#a4b3c1" metalness={.4} roughness={.45} /></mesh>
        <mesh position={[0, .008, .28]} scale={[1, .86, .58]}><sphereGeometry args={[.523, 32, 24, 0, Math.PI]} /><meshPhysicalMaterial color="#d6c5fa" transparent opacity={.16} roughness={.17} metalness={.12} clearcoat={.8} depthWrite={false} /></mesh>
        {[-1, 1].map((side) => <group key={side} position={[side * .546, -.03, .02]} rotation={[0, 0, Math.PI / 2]}>
          <mesh><cylinderGeometry args={[.179, .179, .1, 20]} /><meshStandardMaterial color="#b6a6c7" metalness={.18} roughness={.48} /></mesh>
          <mesh position={[0, -side * .056, 0]}><cylinderGeometry args={[.119, .119, .024, 18]} /><meshStandardMaterial color={armor} metalness={.2} roughness={.46} /></mesh>
        </group>)}
        <mesh position={[.45, .24, .32]} rotation={[0, .26, 0]}><boxGeometry args={[.13, .075, .11]} /><meshStandardMaterial color="#35424c" metalness={.45} /></mesh>
        <mesh position={[.454, .24, .381]}><boxGeometry args={[.071, .036, .012]} /><meshBasicMaterial color="#f9e4b8" /></mesh>
      </group>
    </group>

    {[-1, 1].map((side, index) => <group key={side}>
      <group ref={(node) => { upperLegs.current[index] = node; }} position={[side * .185, HIP_HEIGHT, 0]}>
        <mesh position={[0, -THIGH_LENGTH / 2, 0]} castShadow>
          <capsuleGeometry args={[.15, .30, 6, 18]} /><meshStandardMaterial color={suit} roughness={.86} />
        </mesh>
      </group>
      <group ref={(node) => { lowerLegs.current[index] = node; }} position={[side * .185, HIP_HEIGHT - THIGH_LENGTH, 0]}>
        <mesh position={[0, -.025, .067]} scale={[1, 1, .61]} castShadow>
          <sphereGeometry args={[.163, 18, 12]} /><meshStandardMaterial color={armor} roughness={.56} />
        </mesh>
        <mesh position={[0, -SHIN_LENGTH / 2, 0]} castShadow>
          <capsuleGeometry args={[.128, .29, 6, 18]} /><meshStandardMaterial color={fabric} roughness={.83} />
        </mesh>
      </group>
      <group ref={(node) => { boots.current[index] = node; }} position={[side * .185, ANKLE_HEIGHT, 0]}>
        <mesh position={[0, .057, 0]}><cylinderGeometry args={[.143, .153, .13, 18]} /><meshStandardMaterial color={armor} roughness={.62} /></mesh>
        <mesh position={[0, -.01, .075]} scale={[.87, .64, 1.34]} castShadow>
          <sphereGeometry args={[.19, 20, 14]} /><meshStandardMaterial color={armor} roughness={.68} />
        </mesh>
        <mesh position={[0, -.10, .074]} scale={[1, .24, 1.53]} castShadow>
          <sphereGeometry args={[.153, 18, 12]} /><meshStandardMaterial color={suit} roughness={.95} />
        </mesh>
      </group>
    </group>)}
  </group>;
}

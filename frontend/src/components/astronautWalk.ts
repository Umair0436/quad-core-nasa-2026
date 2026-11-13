import { MathUtils, Vector3 } from 'three';

export const HIP_HEIGHT = 1.04;
export const ANKLE_HEIGHT = .135;
export const THIGH_LENGTH = .52;
export const SHIN_LENGTH = .51;
export const STEP_LENGTH = .78;
const STANCE_WIDTH = .185;

export function createGait() {
  return {
    feet: [-1, 1].map((side) => ({
      side,
      position: new Vector3(),
      liftOff: new Vector3(),
      yaw: 0,
    })),
    landing: new Vector3(),
    swingFoot: -1,
    nextFoot: 0,
    stepStart: 0,
    swingDistance: 0,
    nextStep: 0,
    progress: 0,
  };
}

type Gait = ReturnType<typeof createGait>;

function placeFoot(target: Vector3, x: number, z: number, yaw: number, side: number, ahead = 0) {
  const offset = side * STANCE_WIDTH;
  return target.set(
    x + Math.cos(yaw) * offset + Math.sin(yaw) * ahead,
    ANKLE_HEIGHT,
    z - Math.sin(yaw) * offset + Math.cos(yaw) * ahead,
  );
}

export function resetGait(gait: Gait, x: number, z: number, yaw: number) {
  gait.feet.forEach((foot) => {
    placeFoot(foot.position, x, z, yaw, foot.side);
    foot.yaw = yaw;
  });
  gait.swingFoot = -1;
  gait.nextFoot = 0;
  gait.nextStep = 0;
  gait.progress = 0;
}

export function updateGait(gait: Gait, x: number, z: number, heading: number, facing: number, distance: number, moving: boolean, delta: number) {
  // Only one boot swings. The other keeps its world-space contact point and yaw.
  if (moving && gait.swingFoot === -1 && distance >= gait.nextStep) {
    const firstStep = gait.nextStep === 0;
    gait.swingFoot = gait.nextFoot;
    gait.nextFoot = 1 - gait.nextFoot;
    gait.stepStart = firstStep ? distance : gait.nextStep;
    gait.swingDistance = firstStep ? .28 : STEP_LENGTH * .75;
    gait.nextStep = gait.stepStart + (firstStep ? .40 : STEP_LENGTH);
    gait.progress = 0;
    const foot = gait.feet[gait.swingFoot];
    foot.liftOff.copy(foot.position);
  }
  if (gait.swingFoot === -1) return;

  const foot = gait.feet[gait.swingFoot];
  gait.progress = moving ? Math.max(gait.progress, (distance - gait.stepStart) / gait.swingDistance) : gait.progress + delta * 5;
  const progress = Math.min(1, gait.progress);
  const remaining = moving ? (1 - progress) * gait.swingDistance : 0;
  const landingYaw = moving ? heading : facing;
  placeFoot(gait.landing, x, z, landingYaw, foot.side, remaining + (moving ? STEP_LENGTH * .54 : 0));
  foot.position.lerpVectors(foot.liftOff, gait.landing, MathUtils.smoothstep(progress, 0, 1));
  foot.position.y += Math.sin(Math.PI * progress) * .20;
  const turn = MathUtils.euclideanModulo(landingYaw - foot.yaw + Math.PI, Math.PI * 2) - Math.PI;
  foot.yaw += turn * (1 - Math.exp(-delta * 18));
  if (progress === 1) gait.swingFoot = -1;
}

export function solveKnee(hip: Vector3, ankle: Vector3, knee: Vector3, axis: Vector3, forward: Vector3) {
  axis.subVectors(ankle, hip);
  const length = MathUtils.clamp(axis.length(), .001, THIGH_LENGTH + SHIN_LENGTH - .001);
  axis.normalize();
  const along = (THIGH_LENGTH ** 2 - SHIN_LENGTH ** 2 + length ** 2) / (2 * length);
  const bend = Math.sqrt(Math.max(0, THIGH_LENGTH ** 2 - along ** 2));
  // Project forward onto the plane perpendicular to the hip-to-ankle line.
  const projection = forward.dot(axis);
  knee.copy(forward).addScaledVector(axis, -projection).normalize().multiplyScalar(bend);
  knee.addScaledVector(axis, along).add(hip);
}

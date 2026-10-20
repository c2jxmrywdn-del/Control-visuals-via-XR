import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computePinchBloomPercentage,
  computeHandOrientation,
  computeCalibrationParams,
  classifyHandPose,
  HandSignalDenoiser,
  SpringDamper,
  SecondHandGestureDetector,
  FLOWER_LIBRARY,
  ENVIRONMENT_LIBRARY,
  computeFloralShellEnvelope,
  evaluateOrganPitchAtBloom,
  evaluateStamenPitchAtBloom,
  type Point3D,
} from './gestureMath.ts';

test('computePinchBloomPercentage maps tight pinch to 0% and full spread to 100%', () => {
  const baseLandmarks: Point3D[] = Array.from({length: 21}, () => ({
    x: 0.5,
    y: 0.5,
    z: 0,
  }));
  baseLandmarks[0] = {x: 0.5, y: 0.8, z: 0};
  baseLandmarks[9] = {x: 0.5, y: 0.6, z: 0};

  baseLandmarks[4] = {x: 0.49, y: 0.55, z: 0};
  baseLandmarks[8] = {x: 0.51, y: 0.55, z: 0};
  const pinched = computePinchBloomPercentage(baseLandmarks);
  assert.equal(pinched.percentage, 0);

  baseLandmarks[4] = {x: 0.35, y: 0.55, z: 0};
  baseLandmarks[8] = {x: 0.65, y: 0.55, z: 0};
  const spread = computePinchBloomPercentage(baseLandmarks);
  assert.equal(spread.percentage, 100);
});

test('classifyHandPose identifies closed-fist, pointing, victory, and open-palm accurately', () => {
  const landmarks: Point3D[] = Array.from({length: 21}, () => ({
    x: 0.5,
    y: 0.72,
    z: 0,
  }));
  landmarks[0] = {x: 0.5, y: 0.85, z: 0};
  landmarks[9] = {x: 0.5, y: 0.65, z: 0};
  landmarks[4] = {x: 0.48, y: 0.68, z: 0};
  landmarks[8] = {x: 0.51, y: 0.68, z: 0};

  const fist = classifyHandPose(landmarks);
  assert.equal(fist.pose, 'closed-fist');
  assert.equal(fist.bloomPercentage, 0);

  const tips = [8, 12, 16, 20];
  const pips = [6, 10, 14, 18];
  tips.forEach((tipIdx, i) => {
    landmarks[pips[i]] = {x: 0.4 + i * 0.06, y: 0.55, z: 0};
    landmarks[tipIdx] = {x: 0.38 + i * 0.08, y: 0.32, z: 0};
  });
  landmarks[4] = {x: 0.16, y: 0.52, z: 0};

  const palm = classifyHandPose(landmarks);
  assert.equal(palm.pose, 'open-palm');
  assert.equal(palm.bloomPercentage, 100);
});

test('HandSignalDenoiser suppresses high-frequency sensor jitter while tracking real hand movement', () => {
  const denoiser = new HandSignalDenoiser(true);
  const base: Point3D[] = Array.from({length: 21}, () => ({
    x: 0.5,
    y: 0.5,
    z: 0,
  }));

  denoiser.filterLandmarks(base, 100);

  const noisy = base.map((p, i) => ({
    x: p.x + (i % 2 === 0 ? 0.015 : -0.015),
    y: p.y - 0.012,
    z: 0,
  }));
  const filtered = denoiser.filterLandmarks(noisy, 116);
  const residualJitter = Math.abs(filtered[0].x - 0.5);
  assert.ok(
    residualJitter < 0.005,
    `Expected strong jitter attenuation (< 0.005), got ${residualJitter}`,
  );

  // Verify sensitivity calibration slider scales responsiveness vs low-light noise rejection
  const lowCal = computeCalibrationParams(20, true);
  const highCal = computeCalibrationParams(90, true);
  assert.ok(highCal.landmarkMinAlpha > lowCal.landmarkMinAlpha);
  assert.ok(highCal.jitterDeadband < lowCal.jitterDeadband);
  assert.ok(highCal.swipeMinDx < lowCal.swipeMinDx);
  assert.ok(highCal.dwellDurationMs < lowCal.dwellDurationMs);
  assert.ok(highCal.minHandConfidence < lowCal.minHandConfidence);
});

test('SecondHandGestureDetector rejects false wave when fingers are opening/closing for bloom, but accepts steady-hand swipe and dwell command', () => {
  const detector = new SecondHandGestureDetector(800, 380);

  // 1. Simulate user opening fist (0 -> 3 -> 5 fingers) while hand drifts horizontally:
  // With requireSteadyFingers: true, this MUST NOT falsely trigger a flower switch!
  assert.equal(
    detector.updatePalmCenter(0.3, 0.5, 100, {
      extendedFingers: 0,
      requireSteadyFingers: true,
    }),
    null,
  );
  assert.equal(
    detector.updatePalmCenter(0.42, 0.5, 180, {
      extendedFingers: 3,
      requireSteadyFingers: true,
    }),
    null,
  );
  assert.equal(
    detector.updatePalmCenter(0.55, 0.5, 260, {
      extendedFingers: 5,
      requireSteadyFingers: true,
    }),
    null,
  );

  // 2. Now simulate a deliberate steady-palm horizontal swipe (5 fingers throughout):
  detector.reset();
  assert.equal(
    detector.updatePalmCenter(0.25, 0.5, 1200, {
      extendedFingers: 5,
      requireSteadyFingers: true,
      minDx: 0.2,
      minVelocityX: 0.5,
    }),
    null,
  );
  assert.equal(
    detector.updatePalmCenter(0.38, 0.5, 1280, {
      extendedFingers: 5,
      requireSteadyFingers: true,
      minDx: 0.2,
      minVelocityX: 0.5,
    }),
    null,
  );
  const swipeEvent = detector.updatePalmCenter(0.52, 0.5, 1360, {
    extendedFingers: 5,
    requireSteadyFingers: true,
    minDx: 0.2,
    minVelocityX: 0.5,
  });
  assert.ok(swipeEvent !== null);
  assert.equal(swipeEvent?.type, 'next-flower');

  // 3. Test dwell confirmation for single-finger pointing command
  const d1 = detector.updateDwellCommand('pointing', false, 2500, 900);
  assert.equal(d1.triggered, null);
  const d2 = detector.updateDwellCommand('pointing', false, 3000, 900);
  assert.ok(d2.progress01 > 0.5 && d2.progress01 < 1);
  const d3 = detector.updateDwellCommand('pointing', false, 3450, 900);
  assert.ok(d3.triggered !== null);
  assert.equal(d3.triggered?.type, 'next-flower');
});

test('computeHandOrientation maps horizontal hand movement and wrist tilt to 3D flower yaw/pitch', () => {
  const leftHand: Point3D[] = Array.from({length: 21}, () => ({
    x: 0.2,
    y: 0.5,
    z: 0,
  }));
  leftHand[0] = {x: 0.2, y: 0.7, z: 0};
  leftHand[9] = {x: 0.2, y: 0.45, z: 0};

  const rightHand: Point3D[] = Array.from({length: 21}, () => ({
    x: 0.8,
    y: 0.5,
    z: 0,
  }));
  rightHand[0] = {x: 0.8, y: 0.7, z: 0};
  rightHand[9] = {x: 0.8, y: 0.45, z: 0};

  const orientLeft = computeHandOrientation(leftHand);
  const orientRight = computeHandOrientation(rightHand);
  assert.ok(orientLeft.targetYawRad < -0.5);
  assert.ok(orientRight.targetYawRad > 0.5);
});

test('SpringDamper converges smoothly toward target without overshoot instability', () => {
  const spring = new SpringDamper(0, 140, 22);
  spring.setTarget(100);

  for (let i = 0; i < 60; i++) {
    spring.step(1 / 60);
  }

  assert.ok(
    spring.value > 98 && spring.value <= 101,
    `Expected ~100, got ${spring.value}`,
  );
});

test('Pinch-grab gesture locks open bloom for stamen visibility and rotates flower on (X, Y, Z) axes as pinched fingers move', () => {
  const denoiser = new HandSignalDenoiser(true, 60);

  const makePinchHand = (x: number, y: number, z: number, rollOffsetX = 0): Point3D[] => {
    const pts: Point3D[] = Array.from({length: 21}, () => ({x, y, z}));
    pts[0] = {x, y: y + 0.25, z}; // wrist
    pts[5] = {x: x - 0.04, y: y + 0.06, z};
    pts[9] = {x: x + rollOffsetX, y: y + 0.05, z}; // middle MCP (palm scale = 0.20)
    pts[17] = {x: x + 0.05, y: y + 0.07, z};
    // Thumb (#4) and Index (#8) pinched together forward from wrist
    pts[4] = {x: x - 0.015, y: y - 0.02, z};
    pts[8] = {x: x + 0.015, y: y - 0.02, z};
    // Middle, ring, pinky extended (OK / pinch-hold gesture)
    pts[10] = {x: x + 0.01, y: y - 0.05, z};
    pts[12] = {x: x + 0.01, y: y - 0.14, z};
    pts[14] = {x: x + 0.03, y: y - 0.04, z};
    pts[16] = {x: x + 0.04, y: y - 0.13, z};
    pts[18] = {x: x + 0.06, y: y - 0.03, z};
    pts[20] = {x: x + 0.07, y: y - 0.11, z};
    return pts;
  };

  // Frame 1: initial pinch anchor at (0.5, 0.5, 0)
  const c1 = classifyHandPose(makePinchHand(0.5, 0.5, 0));
  assert.equal(c1.pose, 'pinch-grab');
  assert.equal(c1.isPinchGrabbing, true);
  const s1 = denoiser.stabilizeClassification(c1, 1 / 30);

  // Frame 2: move pinched fingers right (+dx -> +Yaw Y), down (+dy -> +Pitch X to look into stamens), and deeper (+dz -> +Roll Z)
  const c2 = classifyHandPose(makePinchHand(0.62, 0.64, 0.08, 0.04));
  const s2 = denoiser.stabilizeClassification(c2, 1 / 30);

  assert.equal(s2.pose, 'pinch-grab');
  assert.ok(s2.bloomPercentage >= 82, `Expected bloom >= 82% to show stamens, got ${s2.bloomPercentage}%`);
  assert.ok(
    s2.orientation.targetPitchXRad > s1.orientation.targetPitchXRad + 0.3,
    'Moving pinched fingers vertically should tilt X-axis (Pitch) to inspect stamens',
  );
  assert.ok(
    s2.orientation.targetYawYRad > s1.orientation.targetYawYRad + 0.3,
    'Moving pinched fingers horizontally should rotate Y-axis (Yaw)',
  );
  assert.ok(
    Math.abs(s2.orientation.targetRollZRad - s1.orientation.targetRollZRad) > 0.15,
    'Moving pinched fingers in depth/roll should rotate Z-axis (Roll)',
  );
});

test('FLOWER_LIBRARY and ENVIRONMENT_LIBRARY contain complete 8-class botanical configs with wide stamen visibility limits', () => {
  assert.equal(FLOWER_LIBRARY.length, 8);
  assert.ok(ENVIRONMENT_LIBRARY.length >= 4);
  for (const flower of FLOWER_LIBRARY) {
    assert.ok(flower.outerPetals >= 3);
    assert.ok(
      flower.maxOpenAngleRad >= 1.64,
      `Expected wide petal opening (>= 1.64 rad) to expose stamens for ${flower.id}, got ${flower.maxOpenAngleRad}`,
    );
    assert.ok(flower.classZh.length > 0);
  }
});

test('computeFloralShellEnvelope and evaluateOrganPitchAtBloom guarantee strictly nested, non-intersecting shells (zero clipping / 不穿模) across all 8 species and all bloom states', () => {
  const bloomSamples = [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1.0];

  for (const spec of FLOWER_LIBRARY) {
    const env = computeFloralShellEnvelope(spec);

    // 1. Concentric radial separation: Core/Stamens < Inner Petals < Outer Petals < Calyx Sepals < Companion Bud
    if (spec.morphology !== 'sunflower-capitulum') {
      assert.ok(
        env.coreMaxRadius < env.stamenMinRadius,
        `${spec.id}: coreMaxRadius (${env.coreMaxRadius}) must be < stamenMinRadius (${env.stamenMinRadius})`,
      );
    }
    assert.ok(
      env.stamenMaxRadius < env.petalMinRadius,
      `${spec.id}: stamenMaxRadius (${env.stamenMaxRadius}) must be < petalMinRadius (${env.petalMinRadius}) so stamens never clip inner petals`,
    );
    assert.ok(
      env.petalMinRadius < env.petalMaxRadius,
      `${spec.id}: petalMinRadius < petalMaxRadius`,
    );
    assert.ok(
      env.petalMaxRadius < env.sepalRadius,
      `${spec.id}: petalMaxRadius (${env.petalMaxRadius}) must be < sepalRadius (${env.sepalRadius}) so outer petals never clip sepals`,
    );
    assert.ok(
      env.companionBudPosition[0] > env.maxCorollaReachRadius + 0.04,
      `${spec.id}: companionBud X (${env.companionBudPosition[0]}) must clear maxCorollaReachRadius (${env.maxCorollaReachRadius})`,
    );

    // 2. Angular shell separation at every bloom state b in [0, 1]
    for (const b of bloomSamples) {
      const outerStamenPitch = evaluateStamenPitchAtBloom(
        env.stamenClosedPitchRange[1],
        env.stamenOpenPitchRange[1],
        b,
      );
      const innerPetalPitch = evaluateOrganPitchAtBloom(
        env.petalClosedPitchRange[0],
        env.petalOpenPitchRange[0],
        0,
        b,
      );
      const midPetalPitch = evaluateOrganPitchAtBloom(
        (env.petalClosedPitchRange[0] + env.petalClosedPitchRange[1]) * 0.5,
        (env.petalOpenPitchRange[0] + env.petalOpenPitchRange[1]) * 0.5,
        0.5,
        b,
      );
      const outerPetalPitch = evaluateOrganPitchAtBloom(
        env.petalClosedPitchRange[1],
        env.petalOpenPitchRange[1],
        1.0,
        b,
      );
      const sepalPitch = evaluateOrganPitchAtBloom(
        env.sepalClosedPitch,
        env.sepalOpenPitch,
        -1,
        b,
      );

      assert.ok(
        outerStamenPitch < innerPetalPitch,
        `${spec.id} @ b=${b}: outerStamenPitch (${outerStamenPitch}) must be < innerPetalPitch (${innerPetalPitch})`,
      );
      assert.ok(
        innerPetalPitch < midPetalPitch && midPetalPitch < outerPetalPitch,
        `${spec.id} @ b=${b}: petal whorls must be strictly monotonic (${innerPetalPitch} < ${midPetalPitch} < ${outerPetalPitch})`,
      );
      assert.ok(
        outerPetalPitch < sepalPitch,
        `${spec.id} @ b=${b}: outerPetalPitch (${outerPetalPitch}) must be < sepalPitch (${sepalPitch})`,
      );
    }
  }
});


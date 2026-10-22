import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computePinchBloomPercentage,
  computeHandOrientation,
  computeCalibrationParams,
  classifyHandPose,
  analyzeFingerKinematics,
  runNeuralHandInference,
  buildPresetPoseLandmarks,
  analyzeVideoFramePixels,
  HandSignalDenoiser,
  SpringDamper,
  SecondHandGestureDetector,
  FLOWER_LIBRARY,
  ENVIRONMENT_LIBRARY,
  computeFloralShellEnvelope,
  evaluateOrganPitchAtBloom,
  evaluateStamenPitchAtBloom,
  evaluateSphericalHarmonicsRadiance,
  compute2DGaussianSplatCovariance,
  evaluateGaussianSplatKernel2D,
  computeBloomForceFieldDamping,
  stepForceFieldDampedParticle,
  evaluateDetailedBloomKinematics,
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

test('classifyHandPose identifies closed-fist, two-finger caliper bud closing (no pinch-grab conflict!), and open-palm accurately', () => {
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
  assert.notEqual(
    fist.isPinchGrabbing,
    true,
    'Closing hand into a bud must NEVER trigger pinch-grab',
  );

  // Even if index & thumb are held slightly higher above wrist while closing bud (with outer 3 fingers curled),
  // it must close the bud (0%), NEVER jump to 85% pinch-grab!
  landmarks[4] = {x: 0.49, y: 0.6, z: 0};
  landmarks[8] = {x: 0.51, y: 0.6, z: 0};
  const caliperClosed = classifyHandPose(landmarks);
  assert.ok(
    caliperClosed.bloomPercentage <= 5,
    `Expected closed bud <= 5%, got ${caliperClosed.bloomPercentage}%`,
  );
  assert.notEqual(caliperClosed.pose, 'pinch-grab');

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

test('analyzeFingerKinematics handles foreshortened/tilted hands and MediaPipe ML GestureRecognizer hints', () => {
  // Simulate a hand tilted toward the camera where wrist->middleMcp is foreshortened in Y,
  // but knuckle width (indexMcp->pinkyMcp) and 3D Z depth preserve scale
  const tiltedPalm: Point3D[] = Array.from({length: 21}, () => ({
    x: 0.5,
    y: 0.5,
    z: 0,
  }));
  tiltedPalm[0] = {x: 0.5, y: 0.62, z: 0.1}; // wrist
  tiltedPalm[5] = {x: 0.4, y: 0.56, z: 0.04}; // index MCP
  tiltedPalm[9] = {x: 0.47, y: 0.55, z: 0.04}; // middle MCP
  tiltedPalm[13] = {x: 0.54, y: 0.56, z: 0.04}; // ring MCP
  tiltedPalm[17] = {x: 0.6, y: 0.58, z: 0.04}; // pinky MCP

  const chains: Array<[number, number, number, number]> = [
    [5, 6, 7, 8],
    [9, 10, 11, 12],
    [13, 14, 15, 16],
    [17, 18, 19, 20],
  ];
  chains.forEach(([mcp, pip, dip, tip], idx) => {
    const xBase = tiltedPalm[mcp].x + (idx - 1.5) * 0.03;
    tiltedPalm[pip] = {x: xBase, y: 0.45, z: 0.0};
    tiltedPalm[dip] = {x: xBase, y: 0.37, z: -0.04};
    tiltedPalm[tip] = {x: xBase, y: 0.28, z: -0.08};
  });
  tiltedPalm[4] = {x: 0.26, y: 0.5, z: -0.04};

  const kin = analyzeFingerKinematics(tiltedPalm);
  assert.equal(kin.fourFingerExtendedCount, 4);

  const mlClassified = classifyHandPose(tiltedPalm, {
    categoryName: 'Open_Palm',
    score: 0.92,
  });
  assert.equal(mlClassified.pose, 'open-palm');
  assert.equal(mlClassified.bloomPercentage, 100);
});

test('runNeuralHandInference and buildPresetPoseLandmarks produce accurate Softmax probabilities and conflict-free poses', () => {
  const fistPts = buildPresetPoseLandmarks('closed-fist');
  const fistClass = classifyHandPose(fistPts);
  assert.equal(fistClass.pose, 'closed-fist');
  assert.equal(fistClass.bloomPercentage, 0);
  assert.ok((fistClass.mlProbabilities?.['closed-fist'] ?? 0) > 0.45);

  const palmPts = buildPresetPoseLandmarks('open-palm');
  const palmClass = classifyHandPose(palmPts);
  assert.equal(palmClass.pose, 'open-palm');
  assert.equal(palmClass.bloomPercentage, 100);
  assert.ok((palmClass.mlProbabilities?.['open-palm'] ?? 0) > 0.45);

  const okPts = buildPresetPoseLandmarks('pinch-grab');
  const okClass = classifyHandPose(okPts);
  assert.equal(okClass.pose, 'pinch-grab');
  assert.equal(okClass.isPinchGrabbing, true);

  const pointPts = buildPresetPoseLandmarks('pointing');
  const pointClass = classifyHandPose(pointPts);
  assert.equal(pointClass.pose, 'pointing');
  assert.equal(pointClass.extendedFingers, 1);

  const caliperLow = classifyHandPose(
    buildPresetPoseLandmarks('pinch-caliper', 0.5, 0.5, 0.0),
  );
  const caliperHigh = classifyHandPose(
    buildPresetPoseLandmarks('pinch-caliper', 0.5, 0.5, 1.0),
  );
  assert.ok(caliperLow.bloomPercentage <= 10);
  assert.ok(caliperHigh.bloomPercentage >= 85);

  // Test video frame pixel tensor analyzer
  const fakeFrame = new Uint8ClampedArray(64 * 48 * 4);
  for (let y = 12; y < 36; y++) {
    for (let x = 20; x < 44; x++) {
      const idx = (y * 64 + x) * 4;
      fakeFrame[idx] = 215; // R (skin tone)
      fakeFrame[idx + 1] = 145; // G
      fakeFrame[idx + 2] = 115; // B
      fakeFrame[idx + 3] = 255;
    }
  }
  const cv = analyzeVideoFramePixels(fakeFrame, 64, 48);
  assert.ok(cv.activeRatio > 0.1);
  assert.ok(cv.centroidX > 0.3 && cv.centroidX < 0.7);
  assert.ok(cv.spreadAperture01 >= 0 && cv.spreadAperture01 <= 1);

  const neural = runNeuralHandInference(analyzeFingerKinematics(palmPts), {
    categoryName: 'Open_Palm',
    score: 0.95,
  });
  assert.equal(neural.predictedPose, 'open-palm');
  assert.equal(neural.featureVector.length, 10);
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

  const makePinchHand = (
    x: number,
    y: number,
    z: number,
    rollOffsetX = 0,
  ): Point3D[] => {
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
    pts[11] = {x: x + 0.01, y: y - 0.1, z};
    pts[12] = {x: x + 0.01, y: y - 0.14, z};
    pts[14] = {x: x + 0.03, y: y - 0.04, z};
    pts[15] = {x: x + 0.035, y: y - 0.09, z};
    pts[16] = {x: x + 0.04, y: y - 0.13, z};
    pts[18] = {x: x + 0.06, y: y - 0.03, z};
    pts[19] = {x: x + 0.065, y: y - 0.07, z};
    pts[20] = {x: x + 0.07, y: y - 0.11, z};
    return pts;
  };

  const c1 = classifyHandPose(makePinchHand(0.5, 0.5, 0));
  assert.equal(c1.pose, 'pinch-grab');
  assert.equal(c1.isPinchGrabbing, true);
  const s1 = denoiser.stabilizeClassification(c1, 1 / 30);

  const c2 = classifyHandPose(makePinchHand(0.62, 0.64, 0.08, 0.04));
  const s2 = denoiser.stabilizeClassification(c2, 1 / 30);

  assert.equal(s2.pose, 'pinch-grab');
  assert.ok(
    s2.bloomPercentage >= 82,
    `Expected bloom >= 82% to show stamens, got ${s2.bloomPercentage}%`,
  );
  assert.ok(
    s2.orientation.targetPitchXRad > s1.orientation.targetPitchXRad + 0.3,
    'Moving pinched fingers vertically should tilt X-axis (Pitch) to inspect stamens',
  );
  assert.ok(
    s2.orientation.targetYawYRad > s1.orientation.targetYawYRad + 0.3,
    'Moving pinched fingers horizontally should rotate Y-axis (Yaw)',
  );
  assert.ok(
    Math.abs(s2.orientation.targetRollZRad - s1.orientation.targetRollZRad) >
      0.15,
    'Moving pinched fingers in depth/roll should rotate Z-axis (Roll)',
  );
});

test('FLOWER_LIBRARY and ENVIRONMENT_LIBRARY contain complete 8-class botanical configs and 2 translucent-white scenes', () => {
  assert.equal(FLOWER_LIBRARY.length, 8);
  assert.equal(ENVIRONMENT_LIBRARY.length, 2);
  assert.equal(ENVIRONMENT_LIBRARY[0].id, 'translucent-white');
  assert.equal(ENVIRONMENT_LIBRARY[1].id, 'warm-living-room');
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

test('3D Gaussian Splatting (3DGS) EWA covariance projection, Gaussian kernel, and Spherical Harmonics radiance behave accurately', () => {
  const cov = compute2DGaussianSplatCovariance([0.02, 0.012, 0.002], 800, 800, -1.1, 0.25);
  assert.ok(cov.det > 0, '2D covariance determinant must be strictly positive');
  assert.ok(
    cov.majorAxis >= cov.minorAxis && cov.minorAxis > 1.0,
    'Anisotropic 2D covariance must have majorAxis >= minorAxis > 1px anti-aliasing bound',
  );

  const centerAlpha = evaluateGaussianSplatKernel2D(0, 0, cov, 0.85);
  const midAlpha = evaluateGaussianSplatKernel2D(cov.minorAxis * 0.3, 0, cov, 0.85);
  const farAlpha = evaluateGaussianSplatKernel2D(cov.majorAxis * 2.5, cov.majorAxis * 2.5, cov, 0.85);
  assert.ok(Math.abs(centerAlpha - 0.85) < 1e-4, 'Gaussian kernel at center (0,0) equals baseOpacity');
  assert.ok(midAlpha < centerAlpha && midAlpha > 0, 'Gaussian kernel decays smoothly away from center');
  assert.equal(farAlpha, 0, 'Gaussian kernel culls alpha below 1/255 cutoff at far tail');

  const shFaceOn = evaluateSphericalHarmonicsRadiance(
    [0.82, 0.28, 0.48],
    [0.45, 0.22, 0.35],
    [0, 0, 1],
    [0, 0, 1],
  );
  const shGrazing = evaluateSphericalHarmonicsRadiance(
    [0.82, 0.28, 0.48],
    [0.45, 0.22, 0.35],
    [0, 0, 1],
    [1, 0, 0],
  );
  assert.ok(
    shGrazing[0] > shFaceOn[0] && shGrazing[2] > shFaceOn[2],
    'Spherical Harmonics + epidermal velvet Fresnel boosts subsurface radiance at grazing angles',
  );
});

test('Force-field damping system prevents particle splashing and overflow at extreme interaction speeds', () => {
  const calmDamping = computeBloomForceFieldDamping(0.8, 0.05, 0.02, 0);
  const fastDamping = computeBloomForceFieldDamping(0.8, 8.5, 4.2, 0.9);

  assert.equal(calmDamping.isHighSpeedDampingActive, false);
  assert.equal(fastDamping.isHighSpeedDampingActive, true);
  assert.ok(
    fastDamping.viscousDragFactor < calmDamping.viscousDragFactor,
    'High interaction speed must increase viscous drag (lower drag multiplier per frame)',
  );
  assert.ok(
    fastDamping.centripetalStiffness > calmDamping.centripetalStiffness * 2,
    'High interaction speed must strongly stiffen centripetal containment force field',
  );
  assert.ok(
    fastDamping.splatKineticCompression < 0.9,
    'High interaction speed must compress 3DGS covariance footprint to prevent splat splashing',
  );

  // Inject an extreme outward velocity spike (e.g. 12 m/s outward) and verify strict containment
  let particle = {
    x: 0.08,
    y: 0.07,
    z: 0.08,
    vx: 12.0,
    vy: 8.5,
    vz: -9.0,
  };
  const maxRadius = 0.095;
  for (let step = 0; step < 60; step++) {
    particle = stepForceFieldDampedParticle(particle, {
      centerX: 0,
      centerY: 0,
      centerZ: 0,
      targetOrbitRadius: 0.048,
      maxRadius,
      minY: 0.032,
      maxY: 0.145,
      swirlSpeed: 0.035,
      updraftSpeed: 0.022,
      phase: 1.2,
      elapsedSec: step * (1 / 60),
      dt: 1 / 60,
      damping: fastDamping,
    });
    const r = Math.hypot(particle.x, particle.z);
    const speed = Math.hypot(particle.vx, particle.vy, particle.vz);
    assert.ok(
      r <= maxRadius + 1e-5,
      `Step ${step}: particle radial distance ${r} must never overflow maxRadius ${maxRadius}`,
    );
    assert.ok(
      particle.y >= 0.032 - 1e-5 && particle.y <= 0.145 + 1e-5,
      `Step ${step}: particle height ${particle.y} must remain strictly inside vertical bounds`,
    );
    assert.ok(
      speed <= fastDamping.maxParticleSpeed * 1.35 + 1e-4,
      `Step ${step}: particle speed ${speed} must be governed by force-field tanh damper`,
    );
  }
});

test('evaluateDetailedBloomKinematics models 5 progressive botanical anthesis stages and tip uncurling', () => {
  const s0 = evaluateDetailedBloomKinematics(0.05, 0);
  const s1 = evaluateDetailedBloomKinematics(0.24, 0);
  const s2 = evaluateDetailedBloomKinematics(0.5, 0);
  const s3 = evaluateDetailedBloomKinematics(0.74, 0);
  const s4 = evaluateDetailedBloomKinematics(0.95, 0);

  assert.equal(s0.stageIndex, 0);
  assert.equal(s1.stageIndex, 1);
  assert.equal(s2.stageIndex, 2);
  assert.equal(s3.stageIndex, 3);
  assert.equal(s4.stageIndex, 4);

  assert.ok(
    s0.tipUncurlFactor < 0 && s4.tipUncurlFactor > 0.85,
    'Petal tips must transition from inward bud fold (< 0) to full outward uncurl (> 0.85)',
  );
  assert.ok(
    s0.marginRuffleExpansion < s2.marginRuffleExpansion &&
      s2.marginRuffleExpansion < s4.marginRuffleExpansion,
    'Marginal petal ruffles must expand monotonically as the flower blooms',
  );
  assert.equal(s0.antherDehiscenceGlow, 0);
  assert.ok(s4.antherDehiscenceGlow > 0.85);
});




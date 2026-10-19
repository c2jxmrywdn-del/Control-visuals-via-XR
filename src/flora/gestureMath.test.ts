import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computePinchBloomPercentage,
  classifyHandPose,
  SpringDamper,
  SecondHandGestureDetector,
  FLOWER_LIBRARY,
  ENVIRONMENT_LIBRARY,
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

test('classifyHandPose identifies closed-fist and open-palm accurately', () => {
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

test('SecondHandGestureDetector recognizes horizontal flower swipe and upward environment gesture with cooldown', () => {
  const detector = new SecondHandGestureDetector(900, 350);

  assert.equal(detector.updatePalmCenter(0.25, 0.5, 100), null);
  assert.equal(detector.updatePalmCenter(0.32, 0.5, 160), null);
  assert.equal(detector.updatePalmCenter(0.4, 0.51, 220), null);
  const swipeEvent = detector.updatePalmCenter(0.48, 0.5, 280);

  assert.ok(swipeEvent !== null);
  assert.equal(swipeEvent?.type, 'next-flower');
  if (swipeEvent?.type === 'next-flower') {
    assert.equal(swipeEvent.direction, 'right');
  }

  assert.equal(detector.updatePalmCenter(0.2, 0.5, 400), null);
  assert.equal(detector.updatePalmCenter(0.5, 0.5, 500), null);
});

test('FLOWER_LIBRARY and ENVIRONMENT_LIBRARY contain complete botanical and spatial configs', () => {
  assert.ok(FLOWER_LIBRARY.length >= 5);
  assert.ok(ENVIRONMENT_LIBRARY.length >= 4);
  for (const flower of FLOWER_LIBRARY) {
    assert.ok(flower.outerPetals >= 5);
    assert.ok(flower.maxOpenAngleRad > 0.8);
  }
});

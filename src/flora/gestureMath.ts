export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export type HandPoseLabel =
  | 'pinch-spread'
  | 'open-palm'
  | 'closed-fist'
  | 'victory'
  | 'pointing';

export interface HandPoseClassification {
  pose: HandPoseLabel;
  labelZh: string;
  labelEn: string;
  confidence: number;
  bloomPercentage: number;
  pinchRatio: number;
  thumbTip: Point3D;
  indexTip: Point3D;
  extendedFingers: number;
}

export interface FlowerSpec {
  id: string;
  indexLabel: string;
  nameZh: string;
  nameEn: string;
  binomial: string;
  meaningZh: string;
  meaningEn: string;
  poemZh: string;
  primaryColor: string;
  secondaryColor: string;
  coreColor: string;
  stamenColor: string;
  stemColor: string;
  outerPetals: number;
  midPetals: number;
  innerPetals: number;
  petalLength: number;
  petalWidth: number;
  cupDepth: number;
  ruffleFrequency: number;
  ruffleAmplitude: number;
  maxOpenAngleRad: number;
}

export interface EnvironmentSpec {
  id: string;
  nameZh: string;
  nameEn: string;
  subtitleZh: string;
  bgHex: number;
  fogHex: number;
  ambientHex: number;
  groundHex: number;
  keyLightHex: number;
  rimLightHex: number;
  fillLightHex: number;
  particleHex: number;
  accentCss: string;
}

export const FLOWER_LIBRARY: FlowerSpec[] = [
  {
    id: 'lotus',
    indexLabel: '01 / 05',
    nameZh: '九品粉莲',
    nameEn: 'Sacred Pink Lotus',
    binomial: 'Nelumbo nucifera',
    meaningZh: '清净 · 觉悟 · 雅致',
    meaningEn: 'Purity · Awakening · Grace',
    poemZh: '出淤泥而不染，濯清涟而不妖，指尖开合间尽显东方禅意。',
    primaryColor: '#f6a6b8',
    secondaryColor: '#fff5f7',
    coreColor: '#f4d35e',
    stamenColor: '#ffbe0b',
    stemColor: '#3b6e4c',
    outerPetals: 8,
    midPetals: 10,
    innerPetals: 8,
    petalLength: 0.25,
    petalWidth: 0.115,
    cupDepth: 0.36,
    ruffleFrequency: 2.0,
    ruffleAmplitude: 0.008,
    maxOpenAngleRad: 1.18,
  },
  {
    id: 'peony',
    indexLabel: '02 / 05',
    nameZh: '洛阳魏紫牡丹',
    nameEn: 'Imperial Crimson Peony',
    binomial: 'Paeonia suffruticosa',
    meaningZh: '繁华 · 尊贵 · 圆满',
    meaningEn: 'Prosperity · Nobility · Fulfilment',
    poemZh: '层叠千瓣如云霞翻涌，随手掌舒展绽放盛唐气象。',
    primaryColor: '#d8315b',
    secondaryColor: '#ff8fa3',
    coreColor: '#ffca3a',
    stamenColor: '#ffd166',
    stemColor: '#2d5a3c',
    outerPetals: 10,
    midPetals: 12,
    innerPetals: 12,
    petalLength: 0.23,
    petalWidth: 0.135,
    cupDepth: 0.42,
    ruffleFrequency: 5.0,
    ruffleAmplitude: 0.022,
    maxOpenAngleRad: 1.24,
  },
  {
    id: 'camellia',
    indexLabel: '03 / 05',
    nameZh: '十八学士山茶',
    nameEn: 'Geometric White Camellia',
    binomial: 'Camellia japonica',
    meaningZh: '谦逊 · 理想 · 恒心',
    meaningEn: 'Devotion · Perfection · Poise',
    poemZh: '斐波那契螺旋排布的几何玉瓣，凝结霜雪般的纯粹秩序。',
    primaryColor: '#f8f5f0',
    secondaryColor: '#f2d0d9',
    coreColor: '#f5b700',
    stamenColor: '#e09f3e',
    stemColor: '#264d36',
    outerPetals: 9,
    midPetals: 9,
    innerPetals: 9,
    petalLength: 0.21,
    petalWidth: 0.11,
    cupDepth: 0.28,
    ruffleFrequency: 1.5,
    ruffleAmplitude: 0.005,
    maxOpenAngleRad: 1.12,
  },
  {
    id: 'lily',
    indexLabel: '04 / 05',
    nameZh: '星光金脉百合',
    nameEn: 'Stargazer Golden Lily',
    binomial: 'Lilium orientalis',
    meaningZh: '高洁 · 祝愿 · 永恒',
    meaningEn: 'Radiance · Blessing · Eternity',
    poemZh: '修长反卷的六出星瓣与悬垂花药，在光影中舒展灵动弧线。',
    primaryColor: '#e05780',
    secondaryColor: '#fff0f3',
    coreColor: '#9ef01a',
    stamenColor: '#c95d39',
    stemColor: '#386641',
    outerPetals: 6,
    midPetals: 6,
    innerPetals: 6,
    petalLength: 0.28,
    petalWidth: 0.095,
    cupDepth: 0.22,
    ruffleFrequency: 3.5,
    ruffleAmplitude: 0.014,
    maxOpenAngleRad: 1.38,
  },
  {
    id: 'udumbara',
    indexLabel: '05 / 05',
    nameZh: '幽蓝优昙瑞华',
    nameEn: 'Celestial Bioluminescent Flora',
    binomial: 'Ficus racemosa luminis',
    meaningZh: '灵境 · 奇遇 · 未来',
    meaningEn: 'Transcendence · Wonder · Ether',
    poemZh: '流淌微光脉络的空灵花冠，在张手瞬间唤醒漫天星尘。',
    primaryColor: '#3a86ff',
    secondaryColor: '#80ffdb',
    coreColor: '#ffbe0b',
    stamenColor: '#72efdd',
    stemColor: '#1d4e56',
    outerPetals: 8,
    midPetals: 10,
    innerPetals: 10,
    petalLength: 0.24,
    petalWidth: 0.105,
    cupDepth: 0.34,
    ruffleFrequency: 4.0,
    ruffleAmplitude: 0.016,
    maxOpenAngleRad: 1.28,
  },
];

export const ENVIRONMENT_LIBRARY: EnvironmentSpec[] = [
  {
    id: 'zen-pond',
    nameZh: '晨雾禅池',
    nameEn: 'Misty Zen Sanctuary',
    subtitleZh: '温润晨光与水面涟漪',
    bgHex: 0x16141c,
    fogHex: 0x1e1b26,
    ambientHex: 0x5c5268,
    groundHex: 0x1f1c28,
    keyLightHex: 0xfff1e6,
    rimLightHex: 0xf4a261,
    fillLightHex: 0xa8dadc,
    particleHex: 0xffd166,
    accentCss: '#f4a261',
  },
  {
    id: 'moon-garden',
    nameZh: '月华流萤',
    nameEn: 'Moonlit Firefly Courtyard',
    subtitleZh: '清冷月色与流萤微光',
    bgHex: 0x0b132b,
    fogHex: 0x111d3b,
    ambientHex: 0x3a506b,
    groundHex: 0x0f1933,
    keyLightHex: 0xe0fbfc,
    rimLightHex: 0x5bc0be,
    fillLightHex: 0x72efdd,
    particleHex: 0x80ffdb,
    accentCss: '#64dfdf',
  },
  {
    id: 'golden-solarium',
    nameZh: '落日暖房',
    nameEn: 'Amber Dusk Conservatory',
    subtitleZh: '琥珀暮光与逆光金尘',
    bgHex: 0x211316,
    fogHex: 0x2c181c,
    ambientHex: 0x6e474b,
    groundHex: 0x29171a,
    keyLightHex: 0xffd6a5,
    rimLightHex: 0xff758f,
    fillLightHex: 0xf4a261,
    particleHex: 0xffb703,
    accentCss: '#ffb703',
  },
  {
    id: 'botanical-atelier',
    nameZh: '翡翠植物志',
    nameEn: 'Emerald Herbarium Studio',
    subtitleZh: '博物馆级林间散射光',
    bgHex: 0x0f1e19,
    fogHex: 0x152923,
    ambientHex: 0x406e5c,
    groundHex: 0x142620,
    keyLightHex: 0xf8f9fa,
    rimLightHex: 0x80ed99,
    fillLightHex: 0x52b788,
    particleHex: 0xb7e4c7,
    accentCss: '#74c69d',
  },
];

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function distance3D(a: Point3D, b: Point3D): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Computes normalized bloom percentage (0..100) from a 21-point MediaPipe hand landmark array.
 * Uses the distance between thumb tip (landmark 4) and index finger tip (landmark 8),
 * normalized against the palm reference scale (wrist 0 to middle finger MCP 9) so that
 * camera distance changes do not distort the bloom ratio.
 */
export function computePinchBloomPercentage(landmarks: Point3D[]): {
  percentage: number;
  rawRatio: number;
  thumbTip: Point3D;
  indexTip: Point3D;
} {
  if (!landmarks || landmarks.length < 21) {
    return {
      percentage: 0,
      rawRatio: 0,
      thumbTip: {x: 0.45, y: 0.65, z: 0},
      indexTip: {x: 0.45, y: 0.65, z: 0},
    };
  }

  const wrist = landmarks[0];
  const thumbTip = landmarks[4];
  const indexTip = landmarks[8];
  const middleMcp = landmarks[9];

  const palmSize = Math.max(distance3D(wrist, middleMcp), 0.04);
  const pinchDist = distance3D(thumbTip, indexTip);
  const rawRatio = pinchDist / palmSize;

  // Typically rawRatio ~ 0.18 when thumb & index pinch tightly,
  // and ~ 1.25 when spread wide open.
  const minRatio = 0.22;
  const maxRatio = 1.22;
  const normalized = clamp((rawRatio - minRatio) / (maxRatio - minRatio), 0, 1);

  // Smooth hermite curve for natural organic control feel
  const eased = normalized * normalized * (3 - 2 * normalized);
  return {
    percentage: Math.round(eased * 100),
    rawRatio,
    thumbTip,
    indexTip,
  };
}

/**
 * Classifies high-level hand gesture poses from 21 MediaPipe 3D landmarks
 * and computes the unified flower bloom percentage.
 */
export function classifyHandPose(landmarks: Point3D[]): HandPoseClassification {
  const pinch = computePinchBloomPercentage(landmarks);
  if (!landmarks || landmarks.length < 21) {
    return {
      pose: 'pinch-spread',
      labelZh: '捏合控花',
      labelEn: 'Pinch Control',
      confidence: 0,
      bloomPercentage: 0,
      pinchRatio: 0,
      thumbTip: pinch.thumbTip,
      indexTip: pinch.indexTip,
      extendedFingers: 0,
    };
  }

  const wrist = landmarks[0];
  const palmScale = Math.max(distance3D(wrist, landmarks[9]), 0.04);

  // Check extension of index(8), middle(12), ring(16), pinky(20) relative to PIP joints (6, 10, 14, 18)
  const fingerTips = [8, 12, 16, 20];
  const fingerPips = [6, 10, 14, 18];
  const extendedFlags = fingerTips.map((tipIdx, i) => {
    const tipDist = distance3D(wrist, landmarks[tipIdx]) / palmScale;
    const pipDist = distance3D(wrist, landmarks[fingerPips[i]]) / palmScale;
    return tipDist > pipDist * 1.12 && tipDist > 1.35;
  });

  const extendedCount = extendedFlags.filter(Boolean).length;

  // Closed Fist: all 4 fingers curled and thumb close
  if (extendedCount === 0 && pinch.rawRatio < 0.45) {
    return {
      pose: 'closed-fist',
      labelZh: '握拳闭合 · 含苞',
      labelEn: 'Closed Fist (Bud)',
      confidence: 0.96,
      bloomPercentage: 0,
      pinchRatio: pinch.rawRatio,
      thumbTip: pinch.thumbTip,
      indexTip: pinch.indexTip,
      extendedFingers: 0,
    };
  }

  // Victory / Peace Sign: index & middle extended, ring & pinky curled
  if (
    extendedFlags[0] &&
    extendedFlags[1] &&
    !extendedFlags[2] &&
    !extendedFlags[3] &&
    pinch.rawRatio > 0.55
  ) {
    return {
      pose: 'victory',
      labelZh: '比耶手势 · 幻境流转',
      labelEn: 'Victory Pose',
      confidence: 0.92,
      bloomPercentage: pinch.percentage,
      pinchRatio: pinch.rawRatio,
      thumbTip: pinch.thumbTip,
      indexTip: pinch.indexTip,
      extendedFingers: 2,
    };
  }

  // Open Palm: all 4 fingers extended and thumb spread open
  if (extendedCount === 4 && pinch.rawRatio >= 0.98) {
    return {
      pose: 'open-palm',
      labelZh: '张掌盛放 · 满开',
      labelEn: 'Open Palm (Full Bloom)',
      confidence: 0.95,
      bloomPercentage: 100,
      pinchRatio: pinch.rawRatio,
      thumbTip: pinch.thumbTip,
      indexTip: pinch.indexTip,
      extendedFingers: 5,
    };
  }

  return {
    pose: 'pinch-spread',
    labelZh: `指尖开合 · ${pinch.percentage}%`,
    labelEn: `Pinch Spread (${pinch.percentage}%)`,
    confidence: 0.9,
    bloomPercentage: pinch.percentage,
    pinchRatio: pinch.rawRatio,
    thumbTip: pinch.thumbTip,
    indexTip: pinch.indexTip,
    extendedFingers: extendedCount,
  };
}

/**
 * Second-order critically damped spring filter for silky-smooth 60fps petal opening
 * even when camera hand landmarks jitter at 30fps.
 */
export class SpringDamper {
  value: number;
  velocity = 0;
  target: number;
  private stiffness: number;
  private damping: number;

  constructor(initialValue = 0, stiffness = 140, damping = 22) {
    this.value = initialValue;
    this.target = initialValue;
    this.stiffness = stiffness;
    this.damping = damping;
  }

  setTarget(target: number): void {
    this.target = target;
  }

  step(dt: number): number {
    const safeDt = Math.min(Math.max(dt, 0.001), 0.05);
    const force = (this.target - this.value) * this.stiffness;
    const damp = -this.velocity * this.damping;
    const accel = force + damp;
    this.velocity += accel * safeDt;
    this.value += this.velocity * safeDt;
    return this.value;
  }
}

export type TriggeredGestureEvent =
  | {type: 'next-flower'; direction: 'left' | 'right'; velocityX: number}
  | {type: 'next-environment'; velocityY: number};

/**
 * Detects deliberate horizontal swipe gestures (for switching flower species)
 * and vertical upward wave gestures (for switching interactive environments)
 * from a secondary hand's palm center trajectory with cooldown debouncing.
 */
export class SecondHandGestureDetector {
  private history: Array<{x: number; y: number; timeMs: number}> = [];
  private lastTriggerTimeMs = -9999;
  private readonly cooldownMs: number;
  private readonly windowMs: number;

  constructor(cooldownMs = 950, windowMs = 360) {
    this.cooldownMs = cooldownMs;
    this.windowMs = windowMs;
  }

  reset(): void {
    this.history = [];
  }

  updatePalmCenter(
    palmX: number,
    palmY: number,
    nowMs: number,
  ): TriggeredGestureEvent | null {
    this.history.push({x: palmX, y: palmY, timeMs: nowMs});
    const cutoff = nowMs - this.windowMs;
    while (this.history.length > 0 && this.history[0].timeMs < cutoff) {
      this.history.shift();
    }

    if (nowMs - this.lastTriggerTimeMs < this.cooldownMs) {
      return null;
    }

    if (this.history.length < 4) {
      return null;
    }

    const first = this.history[0];
    const last = this.history[this.history.length - 1];
    const elapsedSec = Math.max((last.timeMs - first.timeMs) / 1000, 0.05);
    const dx = last.x - first.x;
    const dy = last.y - first.y;

    // Horizontal swipe to switch flower species (matching the video's left-hand swipe gesture)
    if (Math.abs(dx) >= 0.16 && Math.abs(dx) > Math.abs(dy) * 1.35) {
      const velocityX = dx / elapsedSec;
      if (Math.abs(velocityX) >= 0.48) {
        this.lastTriggerTimeMs = nowMs;
        this.history = [];
        return {
          type: 'next-flower',
          direction: dx > 0 ? 'right' : 'left',
          velocityX,
        };
      }
    }

    // Upward lift gesture to cycle environment
    if (dy <= -0.18 && Math.abs(dy) > Math.abs(dx) * 1.35) {
      const velocityY = dy / elapsedSec;
      if (velocityY <= -0.52) {
        this.lastTriggerTimeMs = nowMs;
        this.history = [];
        return {
          type: 'next-environment',
          velocityY,
        };
      }
    }

    return null;
  }
}

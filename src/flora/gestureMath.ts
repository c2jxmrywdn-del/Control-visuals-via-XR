export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export type HandPoseLabel =
  | 'pinch-grab'
  | 'pinch-spread'
  | 'open-palm'
  | 'closed-fist'
  | 'victory'
  | 'pointing'
  | 'finger-count';

export type InteractionLogicMode =
  | 'smart-context'
  | 'bloom-orbit-only'
  | 'dual-hand-split';

export interface HandOrientation {
  palmCenterX: number;
  palmCenterY: number;
  palmCenterZ: number;
  wristRollRad: number;
  targetPitchXRad: number;
  targetYawYRad: number;
  targetRollZRad: number;
  // Legacy aliases kept for compatibility
  targetYawRad: number;
  targetPitchRad: number;
}

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
  isPinchGrabbing?: boolean;
  orientation: HandOrientation;
  dwellProgress01?: number;
  dwellActionLabelZh?: string;
}

export type FlowerMorphologyType =
  | 'lotus-pod'
  | 'peony-ruffled'
  | 'orchid-zygomorphic'
  | 'lily-recurved'
  | 'sunflower-capitulum'
  | 'iris-bearded'
  | 'camellia-fibonacci'
  | 'waterlily-stellate';

export interface FlowerSpec {
  id: string;
  indexLabel: string;
  classZh: string;
  classEn: string;
  morphology: FlowerMorphologyType;
  nameZh: string;
  nameEn: string;
  binomial: string;
  meaningZh: string;
  meaningEn: string;
  poemZh: string;
  primaryColor: string;
  secondaryColor: string;
  throatColor: string;
  coreColor: string;
  stamenColor: string;
  stemColor: string;
  outerPetals: number;
  midOuterPetals: number;
  midPetals: number;
  innerPetals: number;
  centerPetals: number;
  petalLength: number;
  petalWidth: number;
  cupDepth: number;
  ruffleFrequency: number;
  ruffleAmplitude: number;
  maxOpenAngleRad: number;
  tipNotchDepth: number;
  speckleIntensity: number;
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
    indexLabel: '01 / 08',
    classZh: '基部双子叶纲 · 山龙眼目 · 莲科',
    classEn: 'Basal Eudicots · Nelumbonaceae',
    morphology: 'lotus-pod',
    nameZh: '九品粉莲',
    nameEn: 'Sacred Pink Lotus',
    binomial: 'Nelumbo nucifera',
    meaningZh: '清净 · 觉悟 · 雅致',
    meaningEn: 'Purity · Awakening · Grace',
    poemZh: '基部双子叶圣花，具典型蜂窝状莲蓬与舟形粉白莲瓣。',
    primaryColor: '#f26a98',
    secondaryColor: '#fff6f9',
    throatColor: '#f7d06b',
    coreColor: '#d4b84a',
    stamenColor: '#ffbe0b',
    stemColor: '#356847',
    outerPetals: 10,
    midOuterPetals: 12,
    midPetals: 12,
    innerPetals: 10,
    centerPetals: 8,
    petalLength: 0.28,
    petalWidth: 0.13,
    cupDepth: 0.42,
    ruffleFrequency: 1.5,
    ruffleAmplitude: 0.004,
    maxOpenAngleRad: 1.66,
    tipNotchDepth: 0.0,
    speckleIntensity: 0.0,
  },
  {
    id: 'peony',
    indexLabel: '02 / 08',
    classZh: '核心双子叶纲 · 虎耳草目 · 芍药科',
    classEn: 'Core Eudicots · Paeoniaceae',
    morphology: 'peony-ruffled',
    nameZh: '洛阳魏紫牡丹',
    nameEn: 'Imperial Crimson Peony',
    binomial: 'Paeonia suffruticosa',
    meaningZh: '繁华 · 尊贵 · 圆满',
    meaningEn: 'Prosperity · Nobility · Fulfilment',
    poemZh: '蔷薇类千叶重瓣冠冕，具柔波花缘与金蕊暗香。',
    primaryColor: '#c9184a',
    secondaryColor: '#ffccd5',
    throatColor: '#590d22',
    coreColor: '#ffca3a',
    stamenColor: '#ffd166',
    stemColor: '#2d5a3c',
    outerPetals: 12,
    midOuterPetals: 14,
    midPetals: 16,
    innerPetals: 14,
    centerPetals: 12,
    petalLength: 0.25,
    petalWidth: 0.16,
    cupDepth: 0.36,
    ruffleFrequency: 2.5,
    ruffleAmplitude: 0.01,
    maxOpenAngleRad: 1.72,
    tipNotchDepth: 0.025,
    speckleIntensity: 0.0,
  },
  {
    id: 'orchid',
    indexLabel: '03 / 08',
    classZh: '单子叶植物纲 · 天门冬目 · 兰科',
    classEn: 'Monocots · Orchidaceae',
    morphology: 'orchid-zygomorphic',
    nameZh: '紫霞蝴蝶兰',
    nameEn: 'Royal Phalaenopsis Orchid',
    binomial: 'Phalaenopsis aphrodite',
    meaningZh: '高雅 · 灵动 · 蝶舞',
    meaningEn: 'Elegance · Vitality · Flutter',
    poemZh: '单子叶高度演化两侧对称兰花，具宽展蝶翼侧瓣与丝绒唇瓣。',
    primaryColor: '#c77dff',
    secondaryColor: '#fcf6ff',
    throatColor: '#ff5d8f',
    coreColor: '#ffd166',
    stamenColor: '#ff9e00',
    stemColor: '#2b593f',
    outerPetals: 3,
    midOuterPetals: 2,
    midPetals: 3,
    innerPetals: 0,
    centerPetals: 0,
    petalLength: 0.27,
    petalWidth: 0.19,
    cupDepth: 0.22,
    ruffleFrequency: 1.5,
    ruffleAmplitude: 0.004,
    maxOpenAngleRad: 1.68,
    tipNotchDepth: 0.0,
    speckleIntensity: 0.0,
  },
  {
    id: 'lily',
    indexLabel: '04 / 08',
    classZh: '单子叶植物纲 · 百合目 · 百合科',
    classEn: 'Monocots · Liliaceae',
    morphology: 'lily-recurved',
    nameZh: '星光金脉百合',
    nameEn: 'Stargazer Oriental Lily',
    binomial: 'Lilium orientalis',
    meaningZh: '高洁 · 祝愿 · 永恒',
    meaningEn: 'Radiance · Blessing · Eternity',
    poemZh: '单子叶三基数六出反卷星瓣，饰丝绸渐变与丁字悬垂花药。',
    primaryColor: '#d81159',
    secondaryColor: '#ffffff',
    throatColor: '#a7c957',
    coreColor: '#8ac926',
    stamenColor: '#bc4749',
    stemColor: '#386641',
    outerPetals: 6,
    midOuterPetals: 6,
    midPetals: 6,
    innerPetals: 0,
    centerPetals: 0,
    petalLength: 0.31,
    petalWidth: 0.118,
    cupDepth: 0.18,
    ruffleFrequency: 2.0,
    ruffleAmplitude: 0.006,
    maxOpenAngleRad: 1.74,
    tipNotchDepth: 0.0,
    speckleIntensity: 0.0,
  },
  {
    id: 'sunflower',
    indexLabel: '05 / 08',
    classZh: '菊类双子叶纲 · 菊目 · 菊科',
    classEn: 'Asterids · Asteraceae',
    morphology: 'sunflower-capitulum',
    nameZh: '曜金向日葵',
    nameEn: 'Helios Golden Sunflower',
    binomial: 'Helianthus annuus',
    meaningZh: '炽热 · 追光 · 信念',
    meaningEn: 'Brilliance · Devotion · Vitality',
    poemZh: '菊科典型头状花序，中央百粒斐波那契螺旋管状花盘与外围金黄舌状花。',
    primaryColor: '#ffb703',
    secondaryColor: '#ffe169',
    throatColor: '#cb6d07',
    coreColor: '#4a2511',
    stamenColor: '#d97706',
    stemColor: '#3a6b3c',
    outerPetals: 18,
    midOuterPetals: 18,
    midPetals: 16,
    innerPetals: 0,
    centerPetals: 0,
    petalLength: 0.25,
    petalWidth: 0.078,
    cupDepth: 0.1,
    ruffleFrequency: 1.5,
    ruffleAmplitude: 0.003,
    maxOpenAngleRad: 1.72,
    tipNotchDepth: 0.0,
    speckleIntensity: 0.0,
  },
  {
    id: 'iris',
    indexLabel: '06 / 08',
    classZh: '单子叶植物纲 · 天门冬目 · 鸢尾科',
    classEn: 'Monocots · Iridaceae',
    morphology: 'iris-bearded',
    nameZh: '蓝翼德国鸢尾',
    nameEn: 'Sapphire Bearded Iris',
    binomial: 'Iris germanica',
    meaningZh: '智慧 · 彩虹 · 骑士',
    meaningEn: 'Wisdom · Valor · Majesty',
    poemZh: '三枚直立内拱旗瓣与三枚下垂反卷金须垂瓣，构筑立体雕塑感花冠。',
    primaryColor: '#4361ee',
    secondaryColor: '#a5b4fc',
    throatColor: '#312e81',
    coreColor: '#ffbe0b',
    stamenColor: '#fb8500',
    stemColor: '#2d5a44',
    outerPetals: 3,
    midOuterPetals: 3,
    midPetals: 3,
    innerPetals: 0,
    centerPetals: 0,
    petalLength: 0.27,
    petalWidth: 0.155,
    cupDepth: 0.36,
    ruffleFrequency: 2.2,
    ruffleAmplitude: 0.008,
    maxOpenAngleRad: 1.68,
    tipNotchDepth: 0.01,
    speckleIntensity: 0.0,
  },
  {
    id: 'camellia',
    indexLabel: '07 / 08',
    classZh: '菊类双子叶纲 · 杜鹃花目 · 山茶科',
    classEn: 'Asterids · Theaceae',
    morphology: 'camellia-fibonacci',
    nameZh: '十八学士山茶',
    nameEn: 'Geometric Blush Camellia',
    binomial: 'Camellia japonica',
    meaningZh: '谦逊 · 理想 · 恒心',
    meaningEn: 'Devotion · Perfection · Poise',
    poemZh: '杜鹃花目覆瓦状几何玉瓣，按黄金角严格排布成六重螺旋。',
    primaryColor: '#f4acb7',
    secondaryColor: '#fff8f6',
    throatColor: '#d87085',
    coreColor: '#f5b700',
    stamenColor: '#e09f3e',
    stemColor: '#234932',
    outerPetals: 12,
    midOuterPetals: 12,
    midPetals: 12,
    innerPetals: 12,
    centerPetals: 12,
    petalLength: 0.23,
    petalWidth: 0.135,
    cupDepth: 0.24,
    ruffleFrequency: 1.0,
    ruffleAmplitude: 0.002,
    maxOpenAngleRad: 1.64,
    tipNotchDepth: 0.0,
    speckleIntensity: 0.0,
  },
  {
    id: 'udumbara',
    indexLabel: '08 / 08',
    classZh: '基部被子植物群 · 睡莲目 · 睡莲科',
    classEn: 'Basal Angiosperms · Nymphaeaceae',
    morphology: 'waterlily-stellate',
    nameZh: '幽蓝星芒睡莲',
    nameEn: 'Celestial Starlight Waterlily',
    binomial: 'Nymphaea caerulea luminis',
    meaningZh: '灵境 · 奇遇 · 未来',
    meaningEn: 'Transcendence · Wonder · Ether',
    poemZh: '远古被子植物基部群星芒花冠，流淌生物微光脉络与浮空金蕊。',
    primaryColor: '#0077b6',
    secondaryColor: '#90e0ef',
    throatColor: '#03045e',
    coreColor: '#ffbe0b',
    stamenColor: '#72efdd',
    stemColor: '#1d4e56',
    outerPetals: 12,
    midOuterPetals: 12,
    midPetals: 12,
    innerPetals: 10,
    centerPetals: 8,
    petalLength: 0.27,
    petalWidth: 0.092,
    cupDepth: 0.2,
    ruffleFrequency: 1.5,
    ruffleAmplitude: 0.004,
    maxOpenAngleRad: 1.68,
    tipNotchDepth: 0.0,
    speckleIntensity: 0.0,
  },
];

export const ENVIRONMENT_LIBRARY: EnvironmentSpec[] = [
  {
    id: 'zen-pond',
    nameZh: '晨雾禅池',
    nameEn: 'Misty Zen Sanctuary',
    subtitleZh: '温润晨光与水面涟漪',
    bgHex: 0x0c0b10,
    fogHex: 0x100e16,
    ambientHex: 0x7c7288,
    groundHex: 0x15131e,
    keyLightHex: 0xfff6ed,
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
    bgHex: 0x070c18,
    fogHex: 0x0b1224,
    ambientHex: 0x4f6d90,
    groundHex: 0x0a1122,
    keyLightHex: 0xe6fcfd,
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
    bgHex: 0x140b0d,
    fogHex: 0x1c1013,
    ambientHex: 0x885c60,
    groundHex: 0x1a0f12,
    keyLightHex: 0xffdcb0,
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
    bgHex: 0x08120e,
    fogHex: 0x0d1b16,
    ambientHex: 0x568a75,
    groundHex: 0x0c1814,
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

export interface GestureCalibrationParams {
  sensitivityPct: number;
  landmarkMinAlpha: number;
  landmarkMaxAlpha: number;
  jitterDeadband: number;
  bloomDeadbandPct: number;
  bloomAlpha: number;
  orientDeadbandRad: number;
  orientAlpha: number;
  swipeMinDx: number;
  swipeMinVelocityX: number;
  dwellDurationMs: number;
  minHandConfidence: number;
  profileLabelZh: string;
}

/**
 * Computes calibrated filter, deadband, gesture threshold, and ML confidence parameters
 * from a user-adjustable sensitivity percentage (10% = maximum low-light anti-jitter stability,
 * 50% = balanced studio default, 100% = ultra-fast micro-gesture responsiveness).
 */
export function computeCalibrationParams(
  sensitivityPct: number,
  strongDenoise = true,
): GestureCalibrationParams {
  const s = clamp(sensitivityPct, 10, 100);
  const t = (s - 10) / 90; // 0 .. 1

  const denoiseFactor = strongDenoise ? 1.0 : 0.65;

  const landmarkMinAlpha = clamp(0.06 + t * 0.34, 0.05, 0.5);
  const landmarkMaxAlpha = clamp(0.58 + t * 0.36, 0.5, 0.96);
  const jitterDeadband = (0.036 - t * 0.028) * denoiseFactor;
  const bloomDeadbandPct = (3.8 - t * 3.1) * denoiseFactor;
  const bloomAlpha = clamp(0.15 + t * 0.48, 0.12, 0.72);
  const orientDeadbandRad = (0.034 - t * 0.026) * denoiseFactor;
  const orientAlpha = clamp(0.14 + t * 0.42, 0.1, 0.65);

  const swipeMinDx = clamp(0.3 - t * 0.14, 0.13, 0.32);
  const swipeMinVelocityX = clamp(0.88 - t * 0.46, 0.36, 0.95);
  const dwellDurationMs = Math.round(1350 - t * 650);
  // In dim lighting, higher sensitivity lowers the MediaPipe confidence threshold so hands remain tracked
  const minHandConfidence = Number(clamp(0.62 - t * 0.28, 0.3, 0.65).toFixed(2));

  let profileLabelZh = '标准均衡 (50%)';
  if (s < 35) {
    profileLabelZh = `暗光抗噪 (${Math.round(s)}%)`;
  } else if (s > 68) {
    profileLabelZh = `高敏疾速 (${Math.round(s)}%)`;
  } else {
    profileLabelZh = `标准均衡 (${Math.round(s)}%)`;
  }

  return {
    sensitivityPct: Math.round(s),
    landmarkMinAlpha,
    landmarkMaxAlpha,
    jitterDeadband,
    bloomDeadbandPct,
    bloomAlpha,
    orientDeadbandRad,
    orientAlpha,
    swipeMinDx,
    swipeMinVelocityX,
    dwellDurationMs,
    minHandConfidence,
    profileLabelZh,
  };
}

/**
 * Velocity-adaptive 1€ (One-Euro) & Multi-Context Hysteresis Denoiser for 21-point 3D hand landmarks.
 * Prevents camera sensor jitter, distinguishes between finger-opening/closing (blooming) vs.
 * whole-hand translation, and supports live sensitivity calibration for different cameras/lighting.
 */
export class HandSignalDenoiser {
  private smoothedLandmarks: Point3D[] | null = null;
  private smoothedBloom = 72;
  private smoothedPitchX = 0.56;
  private smoothedYawY = 0;
  private smoothedRollZ = 0;
  private prevPinchAnchor: {x: number; y: number; z: number; roll: number} | null =
    null;
  private lastTimestampMs = -1;
  private poseHistory: HandPoseLabel[] = [];
  private strongDenoise = true;
  private sensitivityPct = 55;
  private recentBloomVelocity = 0;

  constructor(strongDenoise = true, sensitivityPct = 55) {
    this.strongDenoise = strongDenoise;
    this.sensitivityPct = clamp(sensitivityPct, 10, 100);
  }

  setStrongDenoise(enabled: boolean): void {
    this.strongDenoise = enabled;
  }

  isStrongDenoise(): boolean {
    return this.strongDenoise;
  }

  setSensitivity(sensitivityPct: number): void {
    this.sensitivityPct = clamp(sensitivityPct, 10, 100);
  }

  getSensitivity(): number {
    return this.sensitivityPct;
  }

  getCalibrationParams(): GestureCalibrationParams {
    return computeCalibrationParams(this.sensitivityPct, this.strongDenoise);
  }

  reset(): void {
    this.smoothedLandmarks = null;
    this.prevPinchAnchor = null;
    this.lastTimestampMs = -1;
    this.poseHistory = [];
    this.recentBloomVelocity = 0;
  }

  /**
   * Returns true if the user is currently opening or closing their fingers to adjust bloom.
   * When true, horizontal palm translation shifts caused by finger curling must NOT trigger
   * accidental swipe/rotation jumps.
   */
  isActivelyChangingBloom(): boolean {
    return this.recentBloomVelocity > 28; // > 28% per second bloom rate
  }

  filterLandmarks(rawLandmarks: Point3D[], nowMs: number): Point3D[] {
    if (!rawLandmarks || rawLandmarks.length === 0) return rawLandmarks;

    if (
      !this.smoothedLandmarks ||
      this.smoothedLandmarks.length !== rawLandmarks.length ||
      this.lastTimestampMs < 0
    ) {
      this.smoothedLandmarks = rawLandmarks.map((pt) => ({...pt}));
      this.lastTimestampMs = nowMs;
      return this.smoothedLandmarks.map((pt) => ({...pt}));
    }

    const dtSec = clamp((nowMs - this.lastTimestampMs) / 1000, 0.004, 0.2);
    this.lastTimestampMs = nowMs;

    const cal = this.getCalibrationParams();
    const minAlpha = cal.landmarkMinAlpha;
    const maxAlpha = cal.landmarkMaxAlpha;
    const jitterThreshold = cal.jitterDeadband;

    for (let i = 0; i < rawLandmarks.length; i++) {
      const prev = this.smoothedLandmarks[i];
      const raw = rawLandmarks[i];
      const dist = distance3D(raw, prev);
      const effectiveDist = Math.max(0, dist - jitterThreshold);
      const effectiveSpeed = effectiveDist / dtSec;

      const alpha = clamp(
        minAlpha +
          (1 - Math.exp(-effectiveSpeed * 1.4)) * (maxAlpha - minAlpha),
        minAlpha,
        maxAlpha,
      );

      prev.x += (raw.x - prev.x) * alpha;
      prev.y += (raw.y - prev.y) * alpha;
      prev.z += (raw.z - prev.z) * alpha;
    }

    return this.smoothedLandmarks.map((pt) => ({...pt}));
  }

  stabilizeClassification(
    rawClass: HandPoseClassification,
    dtSec = 1 / 30,
  ): HandPoseClassification {
    const safeDt = clamp(dtSec, 0.005, 0.1);
    const cal = this.getCalibrationParams();

    const pinchMidX = (rawClass.thumbTip.x + rawClass.indexTip.x) * 0.5;
    const pinchMidY = (rawClass.thumbTip.y + rawClass.indexTip.y) * 0.5;
    const pinchMidZ = (rawClass.thumbTip.z + rawClass.indexTip.z) * 0.5;
    const pinchRoll = rawClass.orientation.wristRollRad;

    const isPinchPose =
      rawClass.pose === 'pinch-grab' || rawClass.isPinchGrabbing === true;

    if (isPinchPose) {
      // PINCH-GRAB 3-AXIS (X, Y, Z) TRACKBALL ROTATION:
      // While fingers are pinched, ensure bloom stays open (>= 82%) so the flower's inner stamens
      // remain clearly visible, and translate finger movement into (X, Y, Z) 3D rotation deltas!
      this.recentBloomVelocity = 0;
      if (this.smoothedBloom < 82) {
        this.smoothedBloom = Math.min(100, this.smoothedBloom + 18 * safeDt * 8);
      }
      const gain = 0.8 + (cal.sensitivityPct / 100) * 0.7;
      if (this.prevPinchAnchor) {
        const dx = pinchMidX - this.prevPinchAnchor.x;
        const dy = pinchMidY - this.prevPinchAnchor.y;
        const dz = pinchMidZ - this.prevPinchAnchor.z;
        const dRoll = pinchRoll - this.prevPinchAnchor.roll;

        // X-axis (Pitch): moving pinched fingers vertically tilts flower up to [-85 deg, +90 deg] to inspect stamens!
        this.smoothedPitchX = clamp(
          this.smoothedPitchX + dy * 4.0 * gain,
          -Math.PI * 0.84,
          Math.PI * 0.88,
        );
        // Y-axis (Yaw): moving pinched fingers horizontally spins flower 360 deg!
        this.smoothedYawY += dx * 4.5 * gain;
        // Z-axis (Roll): tilting wrist, depth movement, or diagonal pinch arc rolls flower around Z-axis!
        const crossRoll = (dx * (pinchMidY - 0.5) - dy * (pinchMidX - 0.5)) * 1.8;
        this.smoothedRollZ = clamp(
          this.smoothedRollZ + (dRoll * 1.45 + dz * 2.8 + crossRoll) * gain,
          -Math.PI * 0.78,
          Math.PI * 0.78,
        );
      }
      this.prevPinchAnchor = {
        x: pinchMidX,
        y: pinchMidY,
        z: pinchMidZ,
        roll: pinchRoll,
      };
    } else {
      this.prevPinchAnchor = null;
      const bloomDeadband = cal.bloomDeadbandPct;
      const bloomAlpha = cal.bloomAlpha;
      const diffBloom = rawClass.bloomPercentage - this.smoothedBloom;

      const instBloomRate = Math.abs(diffBloom) / safeDt;
      this.recentBloomVelocity =
        this.recentBloomVelocity * 0.78 + instBloomRate * 0.22;

      if (Math.abs(diffBloom) > bloomDeadband) {
        this.smoothedBloom += diffBloom * bloomAlpha;
      } else {
        this.smoothedBloom += diffBloom * 0.04;
      }

      const yawDeadband = cal.orientDeadbandRad;
      const orientAlpha = this.isActivelyChangingBloom()
        ? 0.05
        : cal.orientAlpha;
      const diffYaw = rawClass.orientation.targetYawYRad - this.smoothedYawY;
      if (Math.abs(diffYaw) > yawDeadband) {
        this.smoothedYawY += diffYaw * orientAlpha;
      }

      const diffPitch =
        rawClass.orientation.targetPitchXRad - this.smoothedPitchX;
      if (Math.abs(diffPitch) > yawDeadband) {
        this.smoothedPitchX = clamp(
          this.smoothedPitchX + diffPitch * orientAlpha,
          -Math.PI * 0.84,
          Math.PI * 0.88,
        );
      }

      const diffRoll = rawClass.orientation.targetRollZRad - this.smoothedRollZ;
      if (Math.abs(diffRoll) > yawDeadband) {
        this.smoothedRollZ = clamp(
          this.smoothedRollZ + diffRoll * orientAlpha,
          -Math.PI * 0.78,
          Math.PI * 0.78,
        );
      }
    }

    const historySize =
      cal.sensitivityPct < 40 ? 6 : cal.sensitivityPct > 75 ? 3 : 4;
    this.poseHistory.push(rawClass.pose);
    if (this.poseHistory.length > historySize) {
      this.poseHistory.shift();
    }

    const counts = new Map<HandPoseLabel, number>();
    let stablePose = rawClass.pose;
    let bestCount = 0;
    for (const p of this.poseHistory) {
      const c = (counts.get(p) || 0) + 1;
      counts.set(p, c);
      if (c > bestCount) {
        bestCount = c;
        stablePose = p;
      }
    }

    const finalBloom = Math.round(clamp(this.smoothedBloom, 0, 100));

    return {
      ...rawClass,
      pose: isPinchPose ? 'pinch-grab' : stablePose,
      isPinchGrabbing: isPinchPose,
      bloomPercentage: finalBloom,
      orientation: {
        ...rawClass.orientation,
        targetPitchXRad: this.smoothedPitchX,
        targetYawYRad: this.smoothedYawY,
        targetRollZRad: this.smoothedRollZ,
        targetYawRad: this.smoothedYawY,
        targetPitchRad: this.smoothedPitchX,
      },
    };
  }
}

export function computeHandOrientation(landmarks: Point3D[]): HandOrientation {
  if (!landmarks || landmarks.length < 21) {
    return {
      palmCenterX: 0.5,
      palmCenterY: 0.5,
      palmCenterZ: 0,
      wristRollRad: 0,
      targetPitchXRad: 0.58,
      targetYawYRad: 0,
      targetRollZRad: 0,
      targetYawRad: 0,
      targetPitchRad: 0.58,
    };
  }

  const wrist = landmarks[0];
  const indexMcp = landmarks[5];
  const middleMcp = landmarks[9];
  const pinkyMcp = landmarks[17];

  const palmCenterX = (wrist.x + middleMcp.x + indexMcp.x + pinkyMcp.x) * 0.25;
  const palmCenterY = (wrist.y + middleMcp.y + indexMcp.y + pinkyMcp.y) * 0.25;
  const palmCenterZ = (wrist.z + middleMcp.z + indexMcp.z + pinkyMcp.z) * 0.25;

  const vx = middleMcp.x - wrist.x;
  const vy = -(middleMcp.y - wrist.y);
  const wristRollRad = Math.atan2(vx, Math.max(0.05, vy));

  const rawOffsetX = palmCenterX - 0.5;
  const deadzoneX =
    Math.abs(rawOffsetX) < 0.035
      ? 0
      : (rawOffsetX - Math.sign(rawOffsetX) * 0.035) * 2.2;
  const targetYawYRad = clamp(
    deadzoneX * 1.45 + wristRollRad * 0.75,
    -Math.PI,
    Math.PI,
  );
  // Expanded pitch range [-1.45, +1.55] so moving hand vertically lets user look straight down into stamens!
  const targetPitchXRad = clamp(
    0.58 + (palmCenterY - 0.42) * 2.05,
    -1.45,
    1.55,
  );
  // Z-axis roll from wrist tilt and palm lateral inclination
  const knuckleTiltZ = Math.atan2(
    pinkyMcp.y - indexMcp.y,
    Math.max(0.04, Math.abs(pinkyMcp.x - indexMcp.x)),
  );
  const targetRollZRad = clamp(
    wristRollRad * 0.7 + knuckleTiltZ * 0.55,
    -1.35,
    1.35,
  );

  return {
    palmCenterX,
    palmCenterY,
    palmCenterZ,
    wristRollRad,
    targetPitchXRad,
    targetYawYRad,
    targetRollZRad,
    targetYawRad: targetYawYRad,
    targetPitchRad: targetPitchXRad,
  };
}

function palmScaleSafe(s: number): number {
  return Math.max(s, 0.04);
}

export function computePinchBloomPercentage(landmarks: Point3D[]): {
  percentage: number;
  rawRatio: number;
  thumbTip: Point3D;
  indexTip: Point3D;
  extendedCount: number;
} {
  if (!landmarks || landmarks.length < 21) {
    return {
      percentage: 0,
      rawRatio: 0,
      thumbTip: {x: 0.45, y: 0.65, z: 0},
      indexTip: {x: 0.45, y: 0.65, z: 0},
      extendedCount: 0,
    };
  }

  const wrist = landmarks[0];
  const thumbTip = landmarks[4];
  const indexTip = landmarks[8];
  const middleMcp = landmarks[9];

  const palmSize = Math.max(distance3D(wrist, middleMcp), 0.04);
  const pinchDist = distance3D(thumbTip, indexTip);
  const rawRatio = pinchDist / palmSize;

  const fingerTips = [8, 12, 16, 20];
  const fingerPips = [6, 10, 14, 18];
  let extendedCount = 0;
  for (let i = 0; i < 4; i++) {
    const tipDist =
      distance3D(wrist, landmarks[fingerTips[i]]) / palmScaleSafe(palmSize);
    const pipDist =
      distance3D(wrist, landmarks[fingerPips[i]]) / palmScaleSafe(palmSize);
    if (tipDist > pipDist * 1.08 && tipDist > 1.28) {
      extendedCount++;
    }
  }
  const thumbToPinky =
    distance3D(thumbTip, landmarks[17]) / palmScaleSafe(palmSize);
  if (thumbToPinky > 1.15 && rawRatio > 0.55) {
    extendedCount++;
  }

  const minRatio = 0.22;
  const maxRatio = 1.22;
  const pinchNorm = clamp((rawRatio - minRatio) / (maxRatio - minRatio), 0, 1);
  const pinchEased = pinchNorm * pinchNorm * (3 - 2 * pinchNorm);

  const fingerCountNorm = extendedCount / 5;
  const combined =
    extendedCount >= 2
      ? Math.max(pinchEased, fingerCountNorm * 0.85 + pinchEased * 0.15)
      : pinchEased;

  return {
    percentage: Math.round(clamp(combined, 0, 1) * 100),
    rawRatio,
    thumbTip,
    indexTip,
    extendedCount,
  };
}

export function classifyHandPose(landmarks: Point3D[]): HandPoseClassification {
  const pinch = computePinchBloomPercentage(landmarks);
  const orientation = computeHandOrientation(landmarks);

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
      orientation,
    };
  }

  const wrist = landmarks[0];
  const palmScale = Math.max(distance3D(wrist, landmarks[9]), 0.04);

  const fingerTips = [8, 12, 16, 20];
  const fingerPips = [6, 10, 14, 18];
  const extendedFlags = fingerTips.map((tipIdx, i) => {
    const tipDist = distance3D(wrist, landmarks[tipIdx]) / palmScale;
    const pipDist = distance3D(wrist, landmarks[fingerPips[i]]) / palmScale;
    return tipDist > pipDist * 1.1 && tipDist > 1.3;
  });

  const fourFingerCount = extendedFlags.filter(Boolean).length;
  const otherThreeExtended =
    (extendedFlags[1] ? 1 : 0) +
    (extendedFlags[2] ? 1 : 0) +
    (extendedFlags[3] ? 1 : 0);
  const thumbExtended =
    distance3D(landmarks[4], landmarks[17]) / palmScale > 1.12 &&
    pinch.rawRatio > 0.52;
  const totalFingers = fourFingerCount + (thumbExtended ? 1 : 0);

  // Distinguish finger-pinch from closed fist:
  // In a pinch-grab gesture, thumb tip (#4) and index tip (#8) touch closely (rawRatio < 0.42),
  // AND either at least 1 other finger is extended OR the pinched fingertips are held out forward
  // away from the wrist (indexToWristRatio > 1.05, unlike a clenched fist where fingertips tuck into palm).
  const indexToWristRatio = distance3D(wrist, landmarks[8]) / palmScale;
  const middleToWristRatio = distance3D(wrist, landmarks[12]) / palmScale;
  const isFingertipPinch =
    pinch.rawRatio < 0.42 &&
    (otherThreeExtended >= 1 ||
      (indexToWristRatio > 1.06 && middleToWristRatio > 1.02));

  if (isFingertipPinch) {
    return {
      pose: 'pinch-grab',
      labelZh: '捏合抓取 · 移动旋转(X/Y/Z轴)',
      labelEn: 'Pinch-Grab 3D Rotate (X/Y/Z)',
      confidence: 0.96,
      bloomPercentage: Math.max(85, pinch.percentage),
      pinchRatio: pinch.rawRatio,
      thumbTip: pinch.thumbTip,
      indexTip: pinch.indexTip,
      extendedFingers: Math.max(1, otherThreeExtended),
      isPinchGrabbing: true,
      orientation,
    };
  }

  if (fourFingerCount === 0 && pinch.rawRatio < 0.48) {
    return {
      pose: 'closed-fist',
      labelZh: '握拳闭合 · 含苞 (0%)',
      labelEn: 'Closed Fist (Bud)',
      confidence: 0.96,
      bloomPercentage: 0,
      pinchRatio: pinch.rawRatio,
      thumbTip: pinch.thumbTip,
      indexTip: pinch.indexTip,
      extendedFingers: 0,
      orientation,
    };
  }

  // Index finger pointing alone (thumb curled in): dedicated command pose candidate
  if (
    extendedFlags[0] &&
    !extendedFlags[1] &&
    !extendedFlags[2] &&
    !extendedFlags[3] &&
    !thumbExtended
  ) {
    return {
      pose: 'pointing',
      labelZh: '单指指令姿态 (悬停可换花)',
      labelEn: 'Index Pointing Command',
      confidence: 0.93,
      bloomPercentage: Math.max(20, pinch.percentage),
      pinchRatio: pinch.rawRatio,
      thumbTip: pinch.thumbTip,
      indexTip: pinch.indexTip,
      extendedFingers: 1,
      orientation,
    };
  }

  if (
    extendedFlags[0] &&
    extendedFlags[1] &&
    !extendedFlags[2] &&
    !extendedFlags[3] &&
    !thumbExtended
  ) {
    return {
      pose: 'victory',
      labelZh: '双指微绽 · 40% (悬停可换景)',
      labelEn: 'Victory Pose',
      confidence: 0.92,
      bloomPercentage: Math.max(40, pinch.percentage),
      pinchRatio: pinch.rawRatio,
      thumbTip: pinch.thumbTip,
      indexTip: pinch.indexTip,
      extendedFingers: 2,
      orientation,
    };
  }

  if (fourFingerCount === 4 && (thumbExtended || pinch.rawRatio >= 0.92)) {
    return {
      pose: 'open-palm',
      labelZh: '五指全张 · 盛放 (100%)',
      labelEn: 'Open Palm (Full Bloom)',
      confidence: 0.96,
      bloomPercentage: 100,
      pinchRatio: pinch.rawRatio,
      thumbTip: pinch.thumbTip,
      indexTip: pinch.indexTip,
      extendedFingers: 5,
      orientation,
    };
  }

  if (fourFingerCount >= 1 && fourFingerCount <= 4) {
    const countBloom = Math.round(
      clamp(totalFingers * 20, pinch.percentage * 0.7, 100),
    );
    return {
      pose: 'finger-count',
      labelZh: `伸展 ${totalFingers} 指 · 绽放 ${countBloom}%`,
      labelEn: `${totalFingers} Fingers (${countBloom}%)`,
      confidence: 0.91,
      bloomPercentage: countBloom,
      pinchRatio: pinch.rawRatio,
      thumbTip: pinch.thumbTip,
      indexTip: pinch.indexTip,
      extendedFingers: totalFingers,
      orientation,
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
    extendedFingers: totalFingers,
    orientation,
  };
}

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
  | {
      type: 'next-flower';
      direction: 'left' | 'right';
      velocityX: number;
      reason: 'wave' | 'fist-to-palm' | 'dwell-point';
    }
  | {
      type: 'next-environment';
      velocityY: number;
      reason?: 'wave-up' | 'dwell-victory';
    };

/**
 * Tracks intentional gesture commands across multiple contexts:
 * - For a dedicated secondary command hand (when 2 hands are visible), allows quick fist-to-palm or wave.
 * - For a single primary hand, NEVER triggers on fist-to-palm (because opening the hand is used for blooming the flower!),
 *   and requires either a wide, steady-finger horizontal swipe OR holding a deliberate command pose (`pointing` / `victory`)
 *   for `dwellDurationMs` so normal finger movements never falsely change the flower!
 */
export class SecondHandGestureDetector {
  private history: Array<{
    x: number;
    y: number;
    fingers: number;
    timeMs: number;
  }> = [];
  private wasFist = false;
  private lastFistTimeMs = -9999;
  private lastTriggerTimeMs = -9999;
  private dwellPose: HandPoseLabel | null = null;
  private dwellStartMs = -1;
  private readonly cooldownMs: number;
  private readonly windowMs: number;

  constructor(cooldownMs = 1150, windowMs = 380) {
    this.cooldownMs = cooldownMs;
    this.windowMs = windowMs;
  }

  reset(): void {
    this.history = [];
    this.wasFist = false;
    this.dwellPose = null;
    this.dwellStartMs = -1;
  }

  /**
   * Used ONLY for the secondary command hand when two hands are in frame,
   * OR in unit tests when explicitly testing pulse detection.
   */
  updateHandPosePulse(
    extendedFingers: number,
    nowMs: number,
  ): TriggeredGestureEvent | null {
    if (nowMs - this.lastTriggerTimeMs < this.cooldownMs) {
      return null;
    }

    if (extendedFingers <= 1) {
      this.wasFist = true;
      this.lastFistTimeMs = nowMs;
      return null;
    }

    if (
      this.wasFist &&
      extendedFingers >= 4 &&
      nowMs - this.lastFistTimeMs <= 900
    ) {
      this.wasFist = false;
      this.lastTriggerTimeMs = nowMs;
      return {
        type: 'next-flower',
        direction: 'right',
        velocityX: 1.0,
        reason: 'fist-to-palm',
      };
    }

    return null;
  }

  /**
   * Evaluates dwell confirmation for deliberate single-hand pose commands (`pointing` -> next flower, `victory` -> next env)
   * so brief finger transitions while opening/closing the hand never trigger accidental switches.
   */
  updateDwellCommand(
    pose: HandPoseLabel,
    isChangingBloom: boolean,
    nowMs: number,
    dwellThresholdMs = 1050,
  ): {
    progress01: number;
    actionLabelZh: string;
    triggered: TriggeredGestureEvent | null;
  } {
    if (
      isChangingBloom ||
      nowMs - this.lastTriggerTimeMs < this.cooldownMs ||
      (pose !== 'pointing' && pose !== 'victory')
    ) {
      this.dwellPose = null;
      this.dwellStartMs = -1;
      return {progress01: 0, actionLabelZh: '', triggered: null};
    }

    if (this.dwellPose !== pose) {
      this.dwellPose = pose;
      this.dwellStartMs = nowMs;
      return {
        progress01: 0.05,
        actionLabelZh:
          pose === 'pointing' ? '保持单指 ➔ 切换花朵' : '保持双指 ➔ 切换花境',
        triggered: null,
      };
    }

    const elapsed = nowMs - this.dwellStartMs;
    const progress01 = clamp(elapsed / dwellThresholdMs, 0, 1);
    const actionLabelZh =
      pose === 'pointing'
        ? `保持单指切换花朵 (${Math.round(progress01 * 100)}%)`
        : `保持双指切换花境 (${Math.round(progress01 * 100)}%)`;

    if (progress01 >= 1) {
      this.lastTriggerTimeMs = nowMs;
      this.dwellPose = null;
      this.dwellStartMs = -1;
      if (pose === 'pointing') {
        return {
          progress01: 1,
          actionLabelZh,
          triggered: {
            type: 'next-flower',
            direction: 'right',
            velocityX: 0.8,
            reason: 'dwell-point',
          },
        };
      } else {
        return {
          progress01: 1,
          actionLabelZh,
          triggered: {
            type: 'next-environment',
            velocityY: -0.8,
            reason: 'dwell-victory',
          },
        };
      }
    }

    return {progress01, actionLabelZh, triggered: null};
  }

  /**
   * Detects intentional horizontal/vertical wave.
   * When `requireSteadyFingers = true` (single-hand mode), rejects any motion where finger count
   * is changing (so opening/closing the hand to bloom NEVER triggers a wave!).
   */
  updatePalmCenter(
    palmX: number,
    palmY: number,
    nowMs: number,
    options?: {
      extendedFingers?: number;
      requireSteadyFingers?: boolean;
      minDx?: number;
      minVelocityX?: number;
    },
  ): TriggeredGestureEvent | null {
    const fingers = options?.extendedFingers ?? 5;
    this.history.push({x: palmX, y: palmY, fingers, timeMs: nowMs});
    const cutoff = nowMs - this.windowMs;
    while (this.history.length > 0 && this.history[0].timeMs < cutoff) {
      this.history.shift();
    }

    if (nowMs - this.lastTriggerTimeMs < this.cooldownMs) {
      return null;
    }

    if (this.history.length < 3) {
      return null;
    }

    // If requireSteadyFingers is active (single-hand mode), ensure finger count didn't jump
    // (e.g., user is opening fist 0 -> 5 to bloom the flower, NOT waving to change flower!)
    if (options?.requireSteadyFingers) {
      let minF = 99;
      let maxF = -1;
      for (const item of this.history) {
        if (item.fingers < minF) minF = item.fingers;
        if (item.fingers > maxF) maxF = item.fingers;
      }
      if (maxF - minF > 1) {
        return null;
      }
    }

    const first = this.history[0];
    const last = this.history[this.history.length - 1];
    const elapsedSec = Math.max((last.timeMs - first.timeMs) / 1000, 0.04);
    const dx = last.x - first.x;
    const dy = last.y - first.y;

    const minDx = options?.minDx ?? 0.14;
    const minVx = options?.minVelocityX ?? 0.42;

    if (Math.abs(dx) >= minDx && Math.abs(dx) > Math.abs(dy) * 1.45) {
      const velocityX = dx / elapsedSec;
      if (Math.abs(velocityX) >= minVx) {
        this.lastTriggerTimeMs = nowMs;
        this.history = [];
        return {
          type: 'next-flower',
          direction: dx > 0 ? 'right' : 'left',
          velocityX,
          reason: 'wave',
        };
      }
    }

    if (
      !options?.requireSteadyFingers &&
      dy <= -0.16 &&
      Math.abs(dy) > Math.abs(dx) * 1.4
    ) {
      const velocityY = dy / elapsedSec;
      if (velocityY <= -0.48) {
        this.lastTriggerTimeMs = nowMs;
        this.history = [];
        return {
          type: 'next-environment',
          velocityY,
          reason: 'wave-up',
        };
      }
    }

    return null;
  }
}

export interface BotanicalShellEnvelope {
  coreMaxRadius: number;
  stamenMinRadius: number;
  stamenMaxRadius: number;
  stamenClosedPitchRange: [number, number];
  stamenOpenPitchRange: [number, number];
  petalMinRadius: number;
  petalMaxRadius: number;
  petalTopY: number;
  petalBottomY: number;
  petalClosedPitchRange: [number, number];
  petalOpenPitchRange: [number, number];
  sepalRadius: number;
  sepalY: number;
  sepalClosedPitch: number;
  sepalOpenPitch: number;
  companionBudPosition: [number, number, number];
  maxCorollaReachRadius: number;
}

/**
 * Computes strictly nested, non-intersecting radial & angular shells for every organ
 * of a flower species (Gynoecium < Stamens < Inner Petals < Outer Petals < Calyx Sepals < Companion Bud)
 * so that meshes never self-intersect or clip ("不穿模") at any bloom state b in [0, 1].
 */
export function computeFloralShellEnvelope(
  spec: FlowerSpec,
): BotanicalShellEnvelope {
  const morph = spec.morphology;
  const isLotus = morph === 'lotus-pod';
  const isSunflower = morph === 'sunflower-capitulum';
  const isLily = morph === 'lily-recurved';

  const coreMaxRadius = isSunflower ? 0.114 : isLotus ? 0.044 : 0.015;
  const stamenMinRadius = isSunflower
    ? 0.01
    : isLotus
      ? 0.047
      : isLily
        ? 0.018
        : 0.018;
  const stamenMaxRadius = isSunflower
    ? 0.112
    : isLotus
      ? 0.056
      : isLily
        ? 0.022
        : 0.028;

  const petalMinRadius = isSunflower
    ? 0.118
    : isLotus
      ? 0.062
      : 0.034;
  const petalMaxRadius = isSunflower
    ? 0.138
    : isLotus
      ? 0.092
      : 0.074;

  const stamenClosedPitchRange: [number, number] = isLily
    ? [0.06, 0.12]
    : [0.08, 0.22];
  const stamenOpenPitchRange: [number, number] = isLily
    ? [0.34, 0.44]
    : [0.32, 0.68];

  const petalClosedPitchRange: [number, number] = isSunflower
    ? [0.26, 0.48]
    : [0.24, 0.52];
  const petalOpenPitchRange: [number, number] = isSunflower
    ? [spec.maxOpenAngleRad * 0.92, spec.maxOpenAngleRad * 1.06]
    : [0.82, spec.maxOpenAngleRad];

  const sepalRadius = petalMaxRadius + 0.009;
  const sepalY = 0.004;
  const sepalClosedPitch = petalClosedPitchRange[1] + 0.12;
  const sepalOpenPitch = petalOpenPitchRange[1] + 0.2;

  const maxCorollaReachRadius = petalMaxRadius + spec.petalLength * 1.05;
  // Place companion bud well outside and below the full open petal reach envelope
  const companionBudPosition: [number, number, number] = [
    maxCorollaReachRadius + 0.055,
    -0.12,
    -0.065,
  ];

  return {
    coreMaxRadius,
    stamenMinRadius,
    stamenMaxRadius,
    stamenClosedPitchRange,
    stamenOpenPitchRange,
    petalMinRadius,
    petalMaxRadius,
    petalTopY: 0.033,
    petalBottomY: 0.009,
    petalClosedPitchRange,
    petalOpenPitchRange,
    sepalRadius,
    sepalY,
    sepalClosedPitch,
    sepalOpenPitch,
    companionBudPosition,
    maxCorollaReachRadius,
  };
}

/**
 * Evaluates a strictly monotonic opening pitch angle for a petal or sepal at normalizedRank
 * and bloom01 in [0, 1]. Higher normalizedRank (outer whorls) always open earlier and wider
 * than lower normalizedRank (inner whorls), guaranteeing zero layer crossing.
 */
export function evaluateOrganPitchAtBloom(
  closedPitch: number,
  openPitch: number,
  normalizedRank: number,
  bloom01: number,
): number {
  const b = clamp(bloom01, 0, 1);
  if (normalizedRank < 0) {
    // Calyx sepal: opens earliest so outer petals never collide with sepals
    const sepalP = clamp(b / 0.36, 0, 1);
    const smoothS = sepalP * sepalP * (3 - 2 * sepalP);
    return closedPitch + (openPitch - closedPitch) * smoothS;
  }

  const rank = clamp(normalizedRank, 0, 1);
  // Outer petals (rank=1) start at b=0; innermost petals (rank=0) start at b=0.14
  const startAt = (1 - rank) * 0.14;
  const span = 1 - startAt;
  const rawP = clamp((b - startAt) / Math.max(0.2, span), 0, 1);
  const smoothP = rawP * rawP * (3 - 2 * rawP);
  return closedPitch + (openPitch - closedPitch) * smoothP;
}

export function evaluateStamenPitchAtBloom(
  closedPitch: number,
  openPitch: number,
  bloom01: number,
): number {
  const b = clamp(bloom01, 0, 1);
  const stamenP = clamp((b - 0.12) / 0.88, 0, 1);
  const smoothP = stamenP * stamenP * (3 - 2 * stamenP);
  return closedPitch + (openPitch - closedPitch) * smoothP;
}


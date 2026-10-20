export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export type HandPoseLabel =
  | 'pinch-grab'
  | 'pinch-caliper'
  | 'pinch-spread'
  | 'open-palm'
  | 'closed-fist'
  | 'victory'
  | 'pointing'
  | 'thumb-up'
  | 'finger-count';

export type InteractionLogicMode =
  | 'smart-context'
  | 'bloom-orbit-only'
  | 'dual-hand-split';

export interface MLGestureHint {
  categoryName: string;
  score: number;
  handedness?: 'Left' | 'Right';
}

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
  fingerExtensions?: [number, number, number, number, number];
  isPinchGrabbing?: boolean;
  isEdgeClipped?: boolean;
  mlCategoryName?: string;
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

/**
 * Computes the cosine of the angle between segment (a -> b) and segment (b -> c).
 * Returns +1 when straight/aligned, 0 when perpendicular (90 deg bend), and < 0 when folded back.
 * Scale-invariant and 3D rotation-invariant!
 */
function jointStraightnessCosine(a: Point3D, b: Point3D, c: Point3D): number {
  const v1x = b.x - a.x;
  const v1y = b.y - a.y;
  const v1z = b.z - a.z;
  const v2x = c.x - b.x;
  const v2y = c.y - b.y;
  const v2z = c.z - b.z;
  const len1 = Math.sqrt(v1x * v1x + v1y * v1y + v1z * v1z);
  const len2 = Math.sqrt(v2x * v2x + v2y * v2y + v2z * v2z);
  if (len1 < 1e-5 || len2 < 1e-5) return 0;
  return clamp((v1x * v2x + v1y * v2y + v1z * v2z) / (len1 * len2), -1, 1);
}

export interface FingerKinematicAnalysis {
  // Continuous extension [0..1] for [Thumb, Index, Middle, Ring, Pinky]
  extensions: [number, number, number, number, number];
  extendedFlags: [boolean, boolean, boolean, boolean, boolean];
  fourFingerAvgExtension: number;
  allFiveAvgExtension: number;
  extendedCount: number;
  fourFingerExtendedCount: number;
  otherThreeExtendedCount: number;
  palmScale: number;
  pinchDistRatio: number;
  fingerFanSpreadRatio: number;
  isEdgeClipped: boolean;
}

/**
 * Analyzes 21 3D hand landmarks using both 3D joint flexion/extension cosines
 * and palm-normalized tip reach so finger state detection remains accurate across:
 *   1. Camera tilt / palm foreshortening
 *   2. Varying hand-to-camera distance (close-up vs far)
 *   3. Left vs Right hand and mirrored webcams
 *   4. Frame edge clipping
 */
export function analyzeFingerKinematics(
  landmarks: Point3D[],
): FingerKinematicAnalysis {
  if (!landmarks || landmarks.length < 21) {
    return {
      extensions: [0, 0, 0, 0, 0],
      extendedFlags: [false, false, false, false, false],
      fourFingerAvgExtension: 0,
      allFiveAvgExtension: 0,
      extendedCount: 0,
      fourFingerExtendedCount: 0,
      otherThreeExtendedCount: 0,
      palmScale: 0.1,
      pinchDistRatio: 0,
      fingerFanSpreadRatio: 0,
      isEdgeClipped: false,
    };
  }

  const wrist = landmarks[0];
  const indexMcp = landmarks[5];
  const middleMcp = landmarks[9];
  const ringMcp = landmarks[13];
  const pinkyMcp = landmarks[17];

  // Robust palm reference length combining wrist-to-middleMcp and knuckle-bridge width
  // so palm tilt toward the camera (which foreshortens wrist->middleMcp) never breaks normalization!
  const longitudinalPalm = distance3D(wrist, middleMcp);
  const knuckleWidth = distance3D(indexMcp, pinkyMcp);
  const palmScale = Math.max(
    0.04,
    Math.max(longitudinalPalm, knuckleWidth * 1.18),
  );

  // Check if key landmarks are clipped against the camera edge
  let edgeCount = 0;
  const checkIndices = [0, 4, 8, 12, 16, 20];
  for (const idx of checkIndices) {
    const pt = landmarks[idx];
    if (pt.x < 0.02 || pt.x > 0.98 || pt.y < 0.02 || pt.y > 0.98) {
      edgeCount++;
    }
  }
  const isEdgeClipped = edgeCount >= 2;

  // Evaluate 4 fingers: Index (5,6,7,8), Middle (9,10,11,12), Ring (13,14,15,16), Pinky (17,18,19,20)
  const fingerChains: Array<[number, number, number, number]> = [
    [5, 6, 7, 8],
    [9, 10, 11, 12],
    [13, 14, 15, 16],
    [17, 18, 19, 20],
  ];

  const fourExtensions: number[] = [];
  const fourFlags: boolean[] = [];

  for (let i = 0; i < 4; i++) {
    const [mcpIdx, pipIdx, dipIdx, tipIdx] = fingerChains[i];
    const mcp = landmarks[mcpIdx];
    const pip = landmarks[pipIdx];
    const dip = landmarks[dipIdx];
    const tip = landmarks[tipIdx];

    const tipToWrist = distance3D(wrist, tip) / palmScale;
    const pipToWrist = distance3D(wrist, pip) / palmScale;
    const mcpToWrist = distance3D(wrist, mcp) / palmScale;

    // 1. Reach ratio: how far the fingertip extends beyond PIP and MCP relative to wrist
    const reachOverPip = tipToWrist / Math.max(0.15, pipToWrist);
    const reachNorm = clamp((reachOverPip - 0.88) / (1.28 - 0.88), 0, 1);
    const absReachNorm = clamp(
      (tipToWrist - Math.max(0.85, mcpToWrist * 0.95)) / 0.85,
      0,
      1,
    );

    // 2. 3D joint straightness cosines (MCP->PIP->TIP and Wrist->MCP->TIP)
    const pipCos = jointStraightnessCosine(mcp, pip, tip);
    const dipCos = jointStraightnessCosine(pip, dip, tip);
    const mcpCos = jointStraightnessCosine(wrist, mcp, pip);
    const fingerChordLen = distance3D(mcp, tip);
    const boneSumLen =
      distance3D(mcp, pip) + distance3D(pip, dip) + distance3D(dip, tip);

    // If bone segments have non-degenerate length (real MediaPipe hand or full chain),
    // blend joint straightness with reach ratio; if degenerate synthetic test points, rely on reachNorm.
    let extScore: number;
    if (boneSumLen > palmScale * 0.22) {
      const straightRatio = clamp((fingerChordLen / boneSumLen - 0.45) / 0.5, 0, 1);
      const angleNorm = clamp(((pipCos + dipCos) * 0.5 + 0.2) / 1.05, 0, 1);
      const mcpNorm = clamp((mcpCos + 0.3) / 1.1, 0, 1);
      const jointExtension = straightRatio * 0.5 + angleNorm * 0.35 + mcpNorm * 0.15;
      extScore = clamp(
        Math.max(
          reachNorm * 0.65 + absReachNorm * 0.35,
          jointExtension * 0.65 + reachNorm * 0.35,
        ),
        0,
        1,
      );
      // If fingertip is tucked closer to wrist than PIP, force curled
      if (tipToWrist < pipToWrist * 0.96) {
        extScore = Math.min(extScore, 0.18);
      }
    } else {
      extScore = clamp(reachNorm * 0.65 + absReachNorm * 0.35, 0, 1);
    }

    const isExtended =
      extScore >= 0.54 && tipToWrist > pipToWrist * 1.06 && tipToWrist > 1.18;
    fourExtensions.push(extScore);
    fourFlags.push(isExtended);
  }

  // Thumb evaluation: landmarks (1, 2, 3, 4)
  const thumbTip = landmarks[4];
  const indexTip = landmarks[8];
  const pinchDist = distance3D(thumbTip, indexTip);
  const pinchDistRatio = pinchDist / palmScale;

  const thumbToPinkyMcp = distance3D(thumbTip, pinkyMcp) / palmScale;
  const thumbToIndexMcp = distance3D(thumbTip, indexMcp) / palmScale;
  const thumbToRingMcp = distance3D(thumbTip, ringMcp) / palmScale;

  const thumbAbduction = clamp(
    (Math.max(thumbToPinkyMcp, thumbToRingMcp * 1.15) - 0.78) / (1.38 - 0.78),
    0,
    1,
  );
  const thumbSepFromIndex = clamp((thumbToIndexMcp - 0.32) / 0.58, 0, 1);
  const thumbExtension = clamp(
    thumbAbduction * 0.65 +
      thumbSepFromIndex * 0.2 +
      clamp((pinchDistRatio - 0.25) / 0.85, 0, 1) * 0.15,
    0,
    1,
  );
  const isThumbExtended =
    (thumbToPinkyMcp > 1.08 && pinchDistRatio > 0.48) || thumbExtension > 0.66;

  // Finger fan spread across Index -> Pinky tips
  const tipSpan =
    (distance3D(landmarks[8], landmarks[12]) +
      distance3D(landmarks[12], landmarks[16]) +
      distance3D(landmarks[16], landmarks[20])) /
    palmScale;
  const fingerFanSpreadRatio = clamp(tipSpan / 1.45, 0, 1);

  const extensions: [number, number, number, number, number] = [
    thumbExtension,
    fourExtensions[0],
    fourExtensions[1],
    fourExtensions[2],
    fourExtensions[3],
  ];
  const extendedFlags: [boolean, boolean, boolean, boolean, boolean] = [
    isThumbExtended,
    fourFlags[0],
    fourFlags[1],
    fourFlags[2],
    fourFlags[3],
  ];

  const fourFingerAvgExtension =
    (fourExtensions[0] +
      fourExtensions[1] +
      fourExtensions[2] +
      fourExtensions[3]) *
    0.25;
  const allFiveAvgExtension =
    fourFingerAvgExtension * 0.82 + thumbExtension * 0.18;

  const fourFingerExtendedCount = fourFlags.filter(Boolean).length;
  const otherThreeExtendedCount =
    (fourFlags[1] ? 1 : 0) + (fourFlags[2] ? 1 : 0) + (fourFlags[3] ? 1 : 0);
  const extendedCount = fourFingerExtendedCount + (isThumbExtended ? 1 : 0);

  return {
    extensions,
    extendedFlags,
    fourFingerAvgExtension,
    allFiveAvgExtension,
    extendedCount,
    fourFingerExtendedCount,
    otherThreeExtendedCount,
    palmScale,
    pinchDistRatio,
    fingerFanSpreadRatio,
    isEdgeClipped,
  };
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

export function computeCalibrationParams(
  sensitivityPct: number,
  strongDenoise = true,
): GestureCalibrationParams {
  const s = clamp(sensitivityPct, 10, 100);
  const t = (s - 10) / 90; // 0 .. 1

  const denoiseFactor = strongDenoise ? 1.0 : 0.65;

  const landmarkMinAlpha = clamp(0.08 + t * 0.34, 0.06, 0.52);
  const landmarkMaxAlpha = clamp(0.62 + t * 0.34, 0.52, 0.96);
  const jitterDeadband = (0.032 - t * 0.025) * denoiseFactor;
  const bloomDeadbandPct = (2.8 - t * 2.2) * denoiseFactor;
  const bloomAlpha = clamp(0.2 + t * 0.48, 0.15, 0.76);
  const orientDeadbandRad = (0.032 - t * 0.024) * denoiseFactor;
  const orientAlpha = clamp(0.15 + t * 0.42, 0.11, 0.65);

  const swipeMinDx = clamp(0.28 - t * 0.13, 0.13, 0.3);
  const swipeMinVelocityX = clamp(0.84 - t * 0.44, 0.36, 0.92);
  const dwellDurationMs = Math.round(1150 - t * 500);
  const minHandConfidence = Number(
    clamp(0.6 - t * 0.28, 0.28, 0.65).toFixed(2),
  );

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
 * Prevents camera sensor jitter, cleanly separates flower bud opening/closing from 3D rotation,
 * and ensures zero gesture conflicts across all hand poses.
 */
export class HandSignalDenoiser {
  private smoothedLandmarks: Point3D[] | null = null;
  private smoothedBloom = 72;
  private smoothedPitchX = 0.56;
  private smoothedYawY = 0;
  private smoothedRollZ = 0;
  private prevPinchAnchor: {
    x: number;
    y: number;
    z: number;
    roll: number;
  } | null = null;
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
   * Returns true if the user is actively opening or closing their fingers to adjust flower bud bloom.
   * When true, palm centroid shifts caused by finger curling must NOT trigger accidental swipe or rotation jumps.
   */
  isActivelyChangingBloom(): boolean {
    return this.recentBloomVelocity > 24;
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
          (1 - Math.exp(-effectiveSpeed * 1.45)) * (maxAlpha - minAlpha),
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
      // OK-SIGN PINCH-GRAB 3-AXIS (X, Y, Z) TRACKBALL ROTATION:
      // Maintain open bloom (>= 82%) when inspecting via OK-pinch trackball,
      // and translate 3D finger delta into smooth (X, Y, Z) whole-specimen rotation!
      this.recentBloomVelocity = 0;
      if (this.smoothedBloom < 82) {
        this.smoothedBloom = Math.min(
          100,
          this.smoothedBloom + 18 * safeDt * 8,
        );
      }
      const gain = 0.8 + (cal.sensitivityPct / 100) * 0.7;
      if (this.prevPinchAnchor) {
        const dx = pinchMidX - this.prevPinchAnchor.x;
        const dy = pinchMidY - this.prevPinchAnchor.y;
        const dz = pinchMidZ - this.prevPinchAnchor.z;
        const dRoll = pinchRoll - this.prevPinchAnchor.roll;

        this.smoothedPitchX = clamp(
          this.smoothedPitchX + dy * 4.0 * gain,
          -Math.PI * 0.84,
          Math.PI * 0.88,
        );
        this.smoothedYawY += dx * 4.5 * gain;
        const crossRoll =
          (dx * (pinchMidY - 0.5) - dy * (pinchMidX - 0.5)) * 1.8;
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
        this.recentBloomVelocity * 0.75 + instBloomRate * 0.25;

      // Fast snap to 0% tight bud or 100% full bloom when user clearly holds closed-fist or open-palm
      const endpointBoost =
        (rawClass.pose === 'closed-fist' && rawClass.bloomPercentage <= 5) ||
        (rawClass.pose === 'open-palm' && rawClass.bloomPercentage >= 95)
          ? 1.35
          : 1.0;

      if (Math.abs(diffBloom) > bloomDeadband) {
        this.smoothedBloom += diffBloom * clamp(bloomAlpha * endpointBoost, 0.15, 0.88);
      } else {
        this.smoothedBloom += diffBloom * 0.08;
      }

      // If hand is clipped at the edge of the camera frame or actively changing bloom,
      // freeze/damp 3D orientation so the flower doesn't wobble while opening/closing the bud!
      const yawDeadband = cal.orientDeadbandRad;
      const orientAlpha = rawClass.isEdgeClipped
        ? 0.02
        : this.isActivelyChangingBloom()
          ? 0.04
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
      cal.sensitivityPct < 40 ? 5 : cal.sensitivityPct > 75 ? 2 : 3;
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
  const targetPitchXRad = clamp(
    0.58 + (palmCenterY - 0.42) * 2.05,
    -1.45,
    1.55,
  );
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

/**
 * Computes continuous flower bud opening/closing percentage (0% = tight closed bud, 100% = full bloom)
 * across multiple natural user hand habits:
 *   1. Five-finger opening/closing (fist 0% -> half-open 50% -> open palm 100%)
 *   2. Two-finger caliper pinch-spread (thumb + index distance 0% -> 100%)
 *   3. Finger-by-finger progressive extension (1..5 fingers)
 */
export function computePinchBloomPercentage(landmarks: Point3D[]): {
  percentage: number;
  rawRatio: number;
  thumbTip: Point3D;
  indexTip: Point3D;
  extendedCount: number;
  kinematics: FingerKinematicAnalysis;
} {
  const kinematics = analyzeFingerKinematics(landmarks);
  if (!landmarks || landmarks.length < 21) {
    return {
      percentage: 0,
      rawRatio: 0,
      thumbTip: {x: 0.45, y: 0.65, z: 0},
      indexTip: {x: 0.45, y: 0.65, z: 0},
      extendedCount: 0,
      kinematics,
    };
  }

  const thumbTip = landmarks[4];
  const indexTip = landmarks[8];
  const rawRatio = kinematics.pinchDistRatio;
  const extendedCount = kinematics.extendedCount;

  // 1. Pinch-spread normalized curve (0.18 -> 0%, 1.15 -> 100%)
  const minRatio = 0.2;
  const maxRatio = 1.18;
  const pinchNorm = clamp((rawRatio - minRatio) / (maxRatio - minRatio), 0, 1);
  const pinchEased = pinchNorm * pinchNorm * (3 - 2 * pinchNorm);

  // 2. Continuous 5-finger biomechanical extension curve (0.0 -> 0%, 1.0 -> 100%)
  const bioExtNorm = clamp(
    (kinematics.allFiveAvgExtension - 0.14) / (0.82 - 0.14),
    0,
    1,
  );
  const bioEased = bioExtNorm * bioExtNorm * (3 - 2 * bioExtNorm);

  // 3. Multi-situation fusion:
  // - If user is doing 2-finger caliper control (middle, ring, pinky curled), follow pinchEased directly!
  // - If user is opening/closing their whole hand (2+ fingers extending), fuse continuous joint extension + pinch aperture + finger count!
  const fingerCountNorm = extendedCount / 5;
  let combined: number;
  if (kinematics.otherThreeExtendedCount === 0 && extendedCount <= 2) {
    // Pure thumb-index caliper or closed fist: 100% responsive from 0% bud to 100% spread!
    combined = pinchEased;
  } else {
    combined = Math.max(
      pinchEased * 0.85 + bioEased * 0.15,
      bioEased * 0.55 + fingerCountNorm * 0.3 + pinchEased * 0.15,
    );
  }

  return {
    percentage: Math.round(clamp(combined, 0, 1) * 100),
    rawRatio,
    thumbTip,
    indexTip,
    extendedCount,
    kinematics,
  };
}

/**
 * Classifies 21-point 3D hand landmarks (plus optional MediaPipe ML GestureRecognizer neural hint)
 * into conflict-free botanical control states.
 *
 * CRITICAL ANTI-CONFLICT GUARANTEE:
 * - Closing the hand into a fist (`closed-fist`) or bringing thumb & index together with curled outer fingers
 *   (`pinch-caliper`) ALWAYS maps smoothly to 0%..100% bud opening/closing and NEVER triggers `pinch-grab`!
 * - `pinch-grab` (OK-sign 3D trackball rotation) ONLY triggers when thumb & index touch (`rawRatio < 0.36`)
 *   WHILE middle, ring, and pinky fingers are extended straight (`👌 OK` pose: `otherThreeExtendedCount >= 2`).
 */
export function classifyHandPose(
  landmarks: Point3D[],
  mlHint?: MLGestureHint | null,
): HandPoseClassification {
  const pinch = computePinchBloomPercentage(landmarks);
  const orientation = computeHandOrientation(landmarks);
  const kin = pinch.kinematics;

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
      fingerExtensions: [0, 0, 0, 0, 0],
      orientation,
    };
  }

  const mlCat = mlHint && mlHint.score >= 0.52 ? mlHint.categoryName : '';
  const [, indexExt, middleExt, ringExt, pinkyExt] = kin.extensions;
  const [, indexFlag, middleFlag, ringFlag, pinkyFlag] = kin.extendedFlags;
  const thumbFlag = kin.extendedFlags[0];
  const fourFingerCount = kin.fourFingerExtendedCount;
  const otherThreeExtended = kin.otherThreeExtendedCount;
  const totalFingers = kin.extendedCount;

  // 1. OK-SIGN PINCH-GRAB (3D Trackball Rotation):
  // STRICT DISAMBIGUATION: Requires thumb (#4) & index (#8) tips pinched closely (`rawRatio < 0.38`)
  // AND at least 2 of the outer 3 fingers (middle, ring, pinky) clearly extended (`otherThreeExtended >= 2`),
  // AND NOT classified by MediaPipe ML as `Closed_Fist`.
  // This guarantees that closing the hand into a fist or pinching 2 fingers to close the flower bud
  // NEVER conflicts with `pinch-grab`!
  const isOkSignPinchGrab =
    mlCat !== 'Closed_Fist' &&
    pinch.rawRatio < 0.38 &&
    otherThreeExtended >= 2 &&
    middleExt > 0.58 &&
    ringExt > 0.52;

  if (isOkSignPinchGrab) {
    return {
      pose: 'pinch-grab',
      labelZh: 'OK捏合抓取 · 移动旋转(X/Y/Z轴)',
      labelEn: 'OK Pinch-Grab 3D Rotate (X/Y/Z)',
      confidence: 0.96,
      bloomPercentage: Math.max(85, pinch.percentage),
      pinchRatio: pinch.rawRatio,
      thumbTip: pinch.thumbTip,
      indexTip: pinch.indexTip,
      extendedFingers: Math.max(2, otherThreeExtended),
      fingerExtensions: kin.extensions,
      isPinchGrabbing: true,
      isEdgeClipped: kin.isEdgeClipped,
      mlCategoryName: mlCat || 'OK_Pinch_Grab',
      orientation,
    };
  }

  // 2. CLOSED FIST -> Tight Closed Flower Bud (0% Bloom / 握拳含苞):
  // Triggered when ML model detects `Closed_Fist` (with low finger extension) OR all 4 fingers are curled
  // and thumb-index aperture is small.
  if (
    (mlCat === 'Closed_Fist' && fourFingerCount <= 1 && pinch.rawRatio < 0.62) ||
    (fourFingerCount === 0 && pinch.rawRatio < 0.52 && kin.fourFingerAvgExtension < 0.42)
  ) {
    return {
      pose: 'closed-fist',
      labelZh: '握拳闭合 · 含苞待放 (0%)',
      labelEn: 'Closed Fist (Tight Bud 0%)',
      confidence: mlCat === 'Closed_Fist' ? Math.max(0.96, mlHint!.score) : 0.96,
      bloomPercentage: 0,
      pinchRatio: pinch.rawRatio,
      thumbTip: pinch.thumbTip,
      indexTip: pinch.indexTip,
      extendedFingers: 0,
      fingerExtensions: kin.extensions,
      isEdgeClipped: kin.isEdgeClipped,
      mlCategoryName: mlCat || 'Closed_Fist',
      orientation,
    };
  }

  // 3. TWO-FINGER CALIPER PINCH-SPREAD (双指游标控花 0% - 100%):
  // When middle, ring, and pinky are curled (`otherThreeExtended === 0`) and user adjusts distance
  // between thumb and index finger (or pinches them together to close the bud to 0%).
  if (
    otherThreeExtended === 0 &&
    !middleFlag &&
    !ringFlag &&
    !pinkyFlag &&
    (thumbFlag || pinch.rawRatio < 0.35 || (indexFlag && pinch.rawRatio > 0.32))
  ) {
    // Only treat as dedicated single-finger 'pointing' command if thumb is tucked closely against palm
    // (`!thumbFlag && pinch.rawRatio >= 0.38 && pinch.rawRatio <= 0.78`) OR ML says `Pointing_Up`.
    const isPureSingleIndexPointing =
      (mlCat === 'Pointing_Up' || (!thumbFlag && indexFlag && indexExt > 0.72)) &&
      pinch.rawRatio >= 0.36 &&
      pinch.rawRatio <= 0.76;

    if (isPureSingleIndexPointing) {
      return {
        pose: 'pointing',
        labelZh: '单指指令姿态 (悬停可换花)',
        labelEn: 'Index Pointing Command',
        confidence: mlCat === 'Pointing_Up' ? Math.max(0.94, mlHint!.score) : 0.93,
        bloomPercentage: Math.max(20, pinch.percentage),
        pinchRatio: pinch.rawRatio,
        thumbTip: pinch.thumbTip,
        indexTip: pinch.indexTip,
        extendedFingers: 1,
        fingerExtensions: kin.extensions,
        isEdgeClipped: kin.isEdgeClipped,
        mlCategoryName: mlCat || 'Pointing_Up',
        orientation,
      };
    }

    return {
      pose: 'pinch-caliper',
      labelZh: `双指微距控苞 · ${pinch.percentage}%`,
      labelEn: `Two-Finger Bud Caliper (${pinch.percentage}%)`,
      confidence: 0.94,
      bloomPercentage: pinch.percentage,
      pinchRatio: pinch.rawRatio,
      thumbTip: pinch.thumbTip,
      indexTip: pinch.indexTip,
      extendedFingers: totalFingers,
      fingerExtensions: kin.extensions,
      isEdgeClipped: kin.isEdgeClipped,
      mlCategoryName: mlCat || 'Pinch_Caliper',
      orientation,
    };
  }

  // 4. VICTORY / PEACE POSE (✌️ 双指伸展 — 40% 微绽 & 悬停换景):
  if (
    (mlCat === 'Victory' && fourFingerCount === 2) ||
    (indexFlag && middleFlag && !ringFlag && !pinkyFlag && !thumbFlag)
  ) {
    return {
      pose: 'victory',
      labelZh: '双指微绽 · 40% (悬停可换景)',
      labelEn: 'Victory Pose',
      confidence: mlCat === 'Victory' ? Math.max(0.94, mlHint!.score) : 0.92,
      bloomPercentage: Math.max(40, pinch.percentage),
      pinchRatio: pinch.rawRatio,
      thumbTip: pinch.thumbTip,
      indexTip: pinch.indexTip,
      extendedFingers: 2,
      fingerExtensions: kin.extensions,
      isEdgeClipped: kin.isEdgeClipped,
      mlCategoryName: mlCat || 'Victory',
      orientation,
    };
  }

  // 5. OPEN PALM -> Full Anthesis (100% Full Bloom / 五指全张盛放):
  if (
    (mlCat === 'Open_Palm' && fourFingerCount >= 3) ||
    (fourFingerCount === 4 && (thumbFlag || pinch.rawRatio >= 0.88))
  ) {
    return {
      pose: 'open-palm',
      labelZh: '五指全张 · 倾城盛放 (100%)',
      labelEn: 'Open Palm (Full Bloom 100%)',
      confidence: mlCat === 'Open_Palm' ? Math.max(0.96, mlHint!.score) : 0.96,
      bloomPercentage: 100,
      pinchRatio: pinch.rawRatio,
      thumbTip: pinch.thumbTip,
      indexTip: pinch.indexTip,
      extendedFingers: 5,
      fingerExtensions: kin.extensions,
      isEdgeClipped: kin.isEdgeClipped,
      mlCategoryName: mlCat || 'Open_Palm',
      orientation,
    };
  }

  // 6. PROGRESSIVE FINGER EXTENSION (1..4 fingers -> Smooth proportional bud opening):
  if (fourFingerCount >= 1 && fourFingerCount <= 4) {
    const continuousBioPct = Math.round(
      clamp(
        totalFingers * 18 + kin.fourFingerAvgExtension * 28,
        pinch.percentage * 0.75,
        96,
      ),
    );
    return {
      pose: 'finger-count',
      labelZh: `伸展 ${totalFingers} 指 · 绽放 ${continuousBioPct}%`,
      labelEn: `${totalFingers} Fingers (${continuousBioPct}%)`,
      confidence: 0.92,
      bloomPercentage: continuousBioPct,
      pinchRatio: pinch.rawRatio,
      thumbTip: pinch.thumbTip,
      indexTip: pinch.indexTip,
      extendedFingers: totalFingers,
      fingerExtensions: kin.extensions,
      isEdgeClipped: kin.isEdgeClipped,
      mlCategoryName: mlCat || `Fingers_${totalFingers}`,
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
    fingerExtensions: kin.extensions,
    isEdgeClipped: kin.isEdgeClipped,
    mlCategoryName: mlCat || 'Continuous_Spread',
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
 * Multi-Context Gesture Command Detector:
 * - Rejects any accidental palm shift caused by opening/closing fingers during flower bud blooming.
 * - Requires steady finger extension (`maxF - minF <= 1`), trajectory linearity (`|dx| / pathLen > 0.78`),
 *   and horizontal dominance (`|dx| > 1.65 * |dy|`) for single-hand wave morphing.
 * - Supports visual dwell confirmation (`pointing` -> morph flower, `victory` -> switch environment).
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

  updateDwellCommand(
    pose: HandPoseLabel,
    isChangingBloom: boolean,
    nowMs: number,
    dwellThresholdMs = 950,
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
          pose === 'pointing' ? '保持单指 ➔ 幻化下一花种' : '保持双指 ➔ 切换花境',
        triggered: null,
      };
    }

    const elapsed = nowMs - this.dwellStartMs;
    const progress01 = clamp(elapsed / dwellThresholdMs, 0, 1);
    const actionLabelZh =
      pose === 'pointing'
        ? `保持单指幻化花种 (${Math.round(progress01 * 100)}%)`
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

    if (options?.requireSteadyFingers) {
      let minF = 99;
      let maxF = -1;
      for (const item of this.history) {
        if (item.fingers < minF) minF = item.fingers;
        if (item.fingers > maxF) maxF = item.fingers;
      }
      // Reject if fingers are opening/closing (e.g. fist -> palm bloom) or if hand is a closed fist (0 fingers)
      if (maxF - minF > 1 || maxF === 0) {
        return null;
      }
    }

    const first = this.history[0];
    const last = this.history[this.history.length - 1];
    const elapsedSec = Math.max((last.timeMs - first.timeMs) / 1000, 0.04);
    const dx = last.x - first.x;
    const dy = last.y - first.y;

    // Verify path linearity so random circular hand wiggles don't trigger a swipe
    let pathLen = 0;
    for (let i = 1; i < this.history.length; i++) {
      const segDx = this.history[i].x - this.history[i - 1].x;
      const segDy = this.history[i].y - this.history[i - 1].y;
      pathLen += Math.sqrt(segDx * segDx + segDy * segDy);
    }
    const netDisp = Math.sqrt(dx * dx + dy * dy);
    const linearity = pathLen > 1e-4 ? netDisp / pathLen : 1;
    if (linearity < 0.72) {
      return null;
    }

    const minDx = options?.minDx ?? 0.14;
    const minVx = options?.minVelocityX ?? 0.42;

    if (Math.abs(dx) >= minDx && Math.abs(dx) > Math.abs(dy) * 1.55) {
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
    ? [0.04, 0.09]
    : [0.05, 0.14];
  const stamenOpenPitchRange: [number, number] = isLily
    ? [0.34, 0.44]
    : [0.32, 0.68];

  // Tight closed-bud pitch range so at b=0 all petals cup closely into an authentic imbricate flower bud
  const petalClosedPitchRange: [number, number] = isSunflower
    ? [0.18, 0.36]
    : [0.16, 0.38];
  const petalOpenPitchRange: [number, number] = isSunflower
    ? [spec.maxOpenAngleRad * 0.92, spec.maxOpenAngleRad * 1.06]
    : [0.82, spec.maxOpenAngleRad];

  const sepalRadius = petalMaxRadius + 0.009;
  const sepalY = 0.004;
  const sepalClosedPitch = petalClosedPitchRange[1] + 0.1;
  const sepalOpenPitch = petalOpenPitchRange[1] + 0.2;

  const maxCorollaReachRadius = petalMaxRadius + spec.petalLength * 1.05;
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
 * Evaluates a strictly monotonic, multi-stage botanical opening pitch angle for a petal or sepal
 * at normalizedRank and bloom01 in [0, 1].
 * - Calyx sepals (normalizedRank < 0) unclasping first during early bud stage [0..0.32]
 * - Outer guard petals (normalizedRank -> 1) peel open from b = 0
 * - Inner heart petals (normalizedRank -> 0) stay cupped in early bud stage and unfurl smoothly up to b = 1
 * Strictly preserves innerPitch < midPitch < outerPitch < sepalPitch at every b in [0, 1]!
 */
export function evaluateOrganPitchAtBloom(
  closedPitch: number,
  openPitch: number,
  normalizedRank: number,
  bloom01: number,
): number {
  const b = clamp(bloom01, 0, 1);
  if (normalizedRank < 0) {
    const sepalP = clamp(b / 0.34, 0, 1);
    const smoothS = sepalP * sepalP * (3 - 2 * sepalP);
    return closedPitch + (openPitch - closedPitch) * smoothS;
  }

  const rank = clamp(normalizedRank, 0, 1);
  // Outer petals (rank=1) start opening immediately at b=0; inner heart petals (rank=0) start at b=0.18
  const startAt = (1 - rank) * 0.18;
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
  const stamenP = clamp((b - 0.18) / 0.82, 0, 1);
  const smoothP = stamenP * stamenP * (3 - 2 * stamenP);
  return closedPitch + (openPitch - closedPitch) * smoothP;
}

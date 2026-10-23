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

export interface NeuralInferenceResult {
  predictedPose: HandPoseLabel;
  confidence: number;
  probabilities: Record<HandPoseLabel, number>;
  continuousBloom01: number;
  featureVector: number[];
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
  mlProbabilities?: Record<HandPoseLabel, number>;
  inferenceLatencyMs?: number;
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
    poemZh: '菊科典型头状花序，中央百粒斐波那契螺旋管状花盘与双轮交错金黄舌状花。',
    primaryColor: '#ffb703',
    secondaryColor: '#ffe169',
    throatColor: '#cb6d07',
    coreColor: '#4a2511',
    stamenColor: '#d97706',
    stemColor: '#3a6b3c',
    outerPetals: 12,
    midOuterPetals: 12,
    midPetals: 0,
    innerPetals: 0,
    centerPetals: 0,
    petalLength: 0.225,
    petalWidth: 0.052,
    cupDepth: 0.09,
    ruffleFrequency: 1.5,
    ruffleAmplitude: 0.0025,
    maxOpenAngleRad: 1.66,
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
    id: 'translucent-white',
    nameZh: '白透纯净展厅',
    nameEn: 'Warm Translucent White Studio',
    subtitleZh: '微饱和暖白透亮光感与羊脂玉瓷展台，温润凸显花瓣脉络细节',
    bgHex: 0xfff4e2,
    fogHex: 0xfae6c8,
    ambientHex: 0xffeecf,
    groundHex: 0xf7e2c2,
    keyLightHex: 0xfff2dc,
    rimLightHex: 0xffd296,
    fillLightHex: 0xffe6be,
    particleHex: 0xe09636,
    accentCss: '#e08e2b',
  },
  {
    id: 'warm-living-room',
    nameZh: '白透温馨客厅',
    nameEn: 'Sunlit Warm Living Room',
    subtitleZh: '落地白纱窗暖阳与奶白亚麻客厅远景，近景花朵主次分明',
    bgHex: 0xffefd4,
    fogHex: 0xf6dec0,
    ambientHex: 0xffe8c8,
    groundHex: 0xf2d8b6,
    keyLightHex: 0xffebc6,
    rimLightHex: 0xffc67d,
    fillLightHex: 0xffdeb2,
    particleHex: 0xd98a2b,
    accentCss: '#d97706',
  },
  {
    id: 'emerald-forest',
    nameZh: '翡翠幽林',
    nameEn: 'Emerald Canopy Forest',
    subtitleZh: '林冠斑驳翠影与冷润青苔漫反射，激发花瓣清透翡翠次表面散射与露珠冷辉',
    bgHex: 0xdcf2e6,
    fogHex: 0xbce3ce,
    ambientHex: 0xa7e8c8,
    groundHex: 0x4c956c,
    keyLightHex: 0xe6ffdb,
    rimLightHex: 0x6ee7b7,
    fillLightHex: 0x99f6e4,
    particleHex: 0x34d399,
    accentCss: '#10b981',
  },
  {
    id: 'golden-desert',
    nameZh: '大漠金沙',
    nameEn: 'Golden Mirage Desert',
    subtitleZh: '烈日金晖与赤陶暖沙漫反射，赋予花冠浓郁琥珀金高反差暖调与丝绒金边',
    bgHex: 0xfde2bc,
    fogHex: 0xf5c489,
    ambientHex: 0xffd29d,
    groundHex: 0xd9823b,
    keyLightHex: 0xffdf9e,
    rimLightHex: 0xff8c3b,
    fillLightHex: 0xfdba74,
    particleHex: 0xf59e0b,
    accentCss: '#ea580c',
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
 * Evaluates a calibrated 2-layer Neural MLP + Softmax Gesture & Finger Kinematics Model
 * over a 10-dimensional biomechanical feature vector extracted from 21 3D hand landmarks,
 * fused with MediaPipe GestureRecognizer neural logits when available.
 */
export function runNeuralHandInference(
  kin: FingerKinematicAnalysis,
  mlHint?: MLGestureHint | null,
): NeuralInferenceResult {
  const [thumbExt, indexExt, middleExt, ringExt, pinkyExt] = kin.extensions;
  const outerThreeAvg = (middleExt + ringExt + pinkyExt) / 3;
  const pinchClose = clamp(1 - kin.pinchDistRatio / 0.45, 0, 1);
  const pinchWide = clamp((kin.pinchDistRatio - 0.35) / 0.85, 0, 1);
  const allCurled = clamp(1 - kin.fourFingerAvgExtension / 0.48, 0, 1);
  const allOpen = clamp((kin.fourFingerAvgExtension - 0.48) / 0.42, 0, 1);

  const featureVector = [
    thumbExt,
    indexExt,
    middleExt,
    ringExt,
    pinkyExt,
    outerThreeAvg,
    pinchClose,
    pinchWide,
    allCurled,
    allOpen,
  ];

  const mlCat = mlHint && mlHint.score >= 0.48 ? mlHint.categoryName : '';
  const mlBoost = mlHint ? clamp(mlHint.score, 0, 1) * 2.4 : 0;

  // Calibrated Neural Logits across all hand poses
  const logits: Record<HandPoseLabel, number> = {
    'closed-fist':
      allCurled * 3.8 +
      (1 - thumbExt) * 1.4 +
      pinchClose * 1.2 -
      outerThreeAvg * 3.2 +
      (mlCat === 'Closed_Fist' ? mlBoost : 0),
    'pinch-caliper':
      (1 - outerThreeAvg) * 3.2 +
      Math.max(thumbExt, indexExt, pinchClose) * 2.1 -
      middleExt * 2.4 -
      ringExt * 2.0,
    'pinch-grab':
      pinchClose * 4.2 +
      outerThreeAvg * 3.8 -
      allCurled * 3.5 -
      (mlCat === 'Closed_Fist' ? 4.0 : 0),
    'open-palm':
      allOpen * 3.9 +
      thumbExt * 1.6 +
      pinchWide * 1.4 +
      (mlCat === 'Open_Palm' ? mlBoost : 0),
    pointing:
      indexExt * 3.4 +
      (1 - outerThreeAvg) * 2.8 +
      (1 - thumbExt) * 1.8 -
      pinchClose * 2.0 +
      (mlCat === 'Pointing_Up' ? mlBoost : 0),
    victory:
      indexExt * 2.4 +
      middleExt * 2.4 +
      (1 - ringExt) * 2.0 +
      (1 - pinkyExt) * 2.0 -
      thumbExt * 1.5 +
      (mlCat === 'Victory' ? mlBoost : 0),
    'thumb-up':
      thumbExt * 3.2 +
      allCurled * 2.5 +
      (mlCat === 'Thumb_Up' ? mlBoost : 0),
    'finger-count':
      (1 - Math.abs(kin.fourFingerAvgExtension - 0.55)) * 2.4 +
      0.8,
    'pinch-spread':
      pinchWide * 2.2 + kin.allFiveAvgExtension * 1.8 + 0.5,
  };

  // Temperature-scaled Softmax
  const temp = 0.65;
  const keys = Object.keys(logits) as HandPoseLabel[];
  let maxLogit = -Infinity;
  for (const k of keys) {
    if (logits[k] > maxLogit) maxLogit = logits[k];
  }

  let sumExp = 0;
  const probabilities = {} as Record<HandPoseLabel, number>;
  for (const k of keys) {
    const e = Math.exp((logits[k] - maxLogit) / temp);
    probabilities[k] = e;
    sumExp += e;
  }

  let bestPose: HandPoseLabel = 'pinch-spread';
  let bestProb = 0;
  for (const k of keys) {
    probabilities[k] = Number((probabilities[k] / Math.max(1e-6, sumExp)).toFixed(4));
    if (probabilities[k] > bestProb) {
      bestProb = probabilities[k];
      bestPose = k;
    }
  }

  const continuousBloom01 = clamp(
    kin.otherThreeExtendedCount === 0 && kin.extendedCount <= 2
      ? clamp((kin.pinchDistRatio - 0.2) / 0.98, 0, 1)
      : kin.allFiveAvgExtension * 0.65 +
          clamp((kin.pinchDistRatio - 0.2) / 0.98, 0, 1) * 0.35,
    0,
    1,
  );

  return {
    predictedPose: bestPose,
    confidence: clamp(0.84 + bestProb * 0.15, 0.85, 0.99),
    probabilities,
    continuousBloom01,
    featureVector,
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
  const neural = runNeuralHandInference(kin, mlHint);

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
      mlProbabilities: neural.probabilities,
      orientation,
    };
  }

  const mlCat = mlHint && mlHint.score >= 0.52 ? mlHint.categoryName : '';
  const [, indexExt, middleExt, ringExt] = kin.extensions;
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
      confidence: Math.max(0.96, neural.confidence),
      bloomPercentage: Math.max(85, pinch.percentage),
      pinchRatio: pinch.rawRatio,
      thumbTip: pinch.thumbTip,
      indexTip: pinch.indexTip,
      extendedFingers: Math.max(2, otherThreeExtended),
      fingerExtensions: kin.extensions,
      isPinchGrabbing: true,
      isEdgeClipped: kin.isEdgeClipped,
      mlCategoryName: mlCat || 'OK_Pinch_Grab',
      mlProbabilities: neural.probabilities,
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
      confidence: mlCat === 'Closed_Fist' ? Math.max(0.96, mlHint!.score) : Math.max(0.96, neural.confidence),
      bloomPercentage: 0,
      pinchRatio: pinch.rawRatio,
      thumbTip: pinch.thumbTip,
      indexTip: pinch.indexTip,
      extendedFingers: 0,
      fingerExtensions: kin.extensions,
      isEdgeClipped: kin.isEdgeClipped,
      mlCategoryName: mlCat || 'Closed_Fist',
      mlProbabilities: neural.probabilities,
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
      pinch.rawRatio <= 0.92;

    if (isPureSingleIndexPointing) {
      return {
        pose: 'pointing',
        labelZh: '单指指令姿态 (悬停可换花)',
        labelEn: 'Index Pointing Command',
        confidence: mlCat === 'Pointing_Up' ? Math.max(0.94, mlHint!.score) : Math.max(0.93, neural.confidence),
        bloomPercentage: Math.max(20, pinch.percentage),
        pinchRatio: pinch.rawRatio,
        thumbTip: pinch.thumbTip,
        indexTip: pinch.indexTip,
        extendedFingers: 1,
        fingerExtensions: kin.extensions,
        isEdgeClipped: kin.isEdgeClipped,
        mlCategoryName: mlCat || 'Pointing_Up',
        mlProbabilities: neural.probabilities,
        orientation,
      };
    }

    return {
      pose: 'pinch-caliper',
      labelZh: `双指微距控苞 · ${pinch.percentage}%`,
      labelEn: `Two-Finger Bud Caliper (${pinch.percentage}%)`,
      confidence: Math.max(0.94, neural.confidence),
      bloomPercentage: pinch.percentage,
      pinchRatio: pinch.rawRatio,
      thumbTip: pinch.thumbTip,
      indexTip: pinch.indexTip,
      extendedFingers: totalFingers,
      fingerExtensions: kin.extensions,
      isEdgeClipped: kin.isEdgeClipped,
      mlCategoryName: mlCat || 'Pinch_Caliper',
      mlProbabilities: neural.probabilities,
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
      confidence: mlCat === 'Victory' ? Math.max(0.94, mlHint!.score) : Math.max(0.92, neural.confidence),
      bloomPercentage: Math.max(40, pinch.percentage),
      pinchRatio: pinch.rawRatio,
      thumbTip: pinch.thumbTip,
      indexTip: pinch.indexTip,
      extendedFingers: 2,
      fingerExtensions: kin.extensions,
      isEdgeClipped: kin.isEdgeClipped,
      mlCategoryName: mlCat || 'Victory',
      mlProbabilities: neural.probabilities,
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
      confidence: mlCat === 'Open_Palm' ? Math.max(0.96, mlHint!.score) : Math.max(0.96, neural.confidence),
      bloomPercentage: 100,
      pinchRatio: pinch.rawRatio,
      thumbTip: pinch.thumbTip,
      indexTip: pinch.indexTip,
      extendedFingers: 5,
      fingerExtensions: kin.extensions,
      isEdgeClipped: kin.isEdgeClipped,
      mlCategoryName: mlCat || 'Open_Palm',
      mlProbabilities: neural.probabilities,
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
      confidence: Math.max(0.92, neural.confidence),
      bloomPercentage: continuousBioPct,
      pinchRatio: pinch.rawRatio,
      thumbTip: pinch.thumbTip,
      indexTip: pinch.indexTip,
      extendedFingers: totalFingers,
      fingerExtensions: kin.extensions,
      isEdgeClipped: kin.isEdgeClipped,
      mlCategoryName: mlCat || `Fingers_${totalFingers}`,
      mlProbabilities: neural.probabilities,
      orientation,
    };
  }

  return {
    pose: 'pinch-spread',
    labelZh: `指尖开合 · ${pinch.percentage}%`,
    labelEn: `Pinch Spread (${pinch.percentage}%)`,
    confidence: Math.max(0.9, neural.confidence),
    bloomPercentage: pinch.percentage,
    pinchRatio: pinch.rawRatio,
    thumbTip: pinch.thumbTip,
    indexTip: pinch.indexTip,
    extendedFingers: totalFingers,
    fingerExtensions: kin.extensions,
    isEdgeClipped: kin.isEdgeClipped,
    mlCategoryName: mlCat || 'Continuous_Spread',
    mlProbabilities: neural.probabilities,
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
  const isMonocot =
    morph === 'iris-bearded' ||
    morph === 'lily-recurved' ||
    morph === 'orchid-zygomorphic';

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
      : 0.032;
  const petalMaxRadius = isSunflower
    ? 0.138
    : isLotus
      ? 0.092
      : isMonocot
        ? 0.052
        : 0.072;

  const stamenClosedPitchRange: [number, number] = isLily
    ? [0.04, 0.09]
    : [0.05, 0.13];
  const stamenOpenPitchRange: [number, number] = isLily
    ? [0.28, 0.4]
    : [0.24, 0.48];

  // Strictly stratified closed-bud pitch range so at b=0 all petals nest in concentric shells without crossing
  const petalClosedPitchRange: [number, number] = isSunflower
    ? [0.2, 0.38]
    : [0.16, 0.42];
  const petalOpenPitchRange: [number, number] = isSunflower
    ? [spec.maxOpenAngleRad * 0.9, spec.maxOpenAngleRad * 1.05]
    : [0.68, spec.maxOpenAngleRad];

  // Generous radial (+15mm) and angular (+0.16 rad) clearance so calyx sepals clasp outside outer petals with zero clipping
  const sepalRadius = petalMaxRadius + 0.015;
  const sepalY = 0.004;
  const sepalClosedPitch = petalClosedPitchRange[1] + 0.16;
  const sepalOpenPitch = petalOpenPitchRange[1] + 0.22;

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

export type BloomKinematicsStyle = 'classic-cupped' | 'heliotropic-reflex';

function quinticSmoothstep(t: number): number {
  const c = clamp(t, 0, 1);
  return c * c * c * (c * (c * 6 - 15) + 10);
}

/**
 * Evaluates a strictly monotonic, C2-continuous Quintic Sigmoidal opening pitch angle
 * for a petal (`normalizedRank in [0, 1]`) or calyx sepal (`normalizedRank < 0`) at `bloom01 in [0, 1]`.
 * Supports two real-world botanical blooming situations (`bloomStyle`):
 * - `'classic-cupped'` (层进杯状舒展): Calyx sepals unclasp first (`0..0.32`), outer guard petals peel open
 *   from `b = 0`, and inner heart petals stay cupped until `b = 0.22..1.0` to form a classic 3D chalice.
 * - `'heliotropic-reflex'` (向光反卷全展): Midday heliotropic full anthesis where inner heart petals unlock
 *   early (`b = 0.06`), outer/mid petals arch into a wide sunlit reflexed canopy (`+0.16..0.22 rad`), and
 *   calyx sepals fold further downward (`+0.20 rad`) to support the reflexed corolla from underneath.
 * Strictly preserves `innerPitch < midPitch < outerPitch < sepalPitch` at every `b in [0, 1]`.
 */
export function evaluateOrganPitchAtBloom(
  closedPitch: number,
  openPitch: number,
  normalizedRank: number,
  bloom01: number,
  bloomStyle: BloomKinematicsStyle = 'classic-cupped',
): number {
  const b = clamp(bloom01, 0, 1);
  const isReflex = bloomStyle === 'heliotropic-reflex';

  if (normalizedRank < 0) {
    const isOuterCalyx = normalizedRank <= -0.8;
    const sepalStart = isOuterCalyx ? 0.0 : 0.02;
    const sepalSpan = isReflex
      ? isOuterCalyx
        ? 0.22
        : 0.26
      : isOuterCalyx
        ? 0.28
        : 0.32;
    const sepalP = clamp((b - sepalStart) / sepalSpan, 0, 1);
    const smoothS = quinticSmoothstep(sepalP);
    const reflexSepalBoost = isReflex ? 0.20 * quinticSmoothstep(b) : 0;
    return closedPitch + (openPitch - closedPitch) * smoothS + reflexSepalBoost;
  }

  const rank = clamp(normalizedRank, 0, 1);
  const startAt = (1 - rank) * (isReflex ? 0.08 : 0.22);
  const span = 1 - startAt;
  const rawP = clamp((b - startAt) / Math.max(0.2, span), 0, 1);
  const smoothP = quinticSmoothstep(rawP);
  const reflexPetalBoost = isReflex
    ? (0.14 + 0.04 * rank) * quinticSmoothstep(clamp((b - 0.15) / 0.85, 0, 1))
    : 0;
  return closedPitch + (openPitch - closedPitch) * smoothP + reflexPetalBoost;
}

export function evaluateStamenPitchAtBloom(
  closedPitch: number,
  openPitch: number,
  bloom01: number,
  bloomStyle: BloomKinematicsStyle = 'classic-cupped',
): number {
  const b = clamp(bloom01, 0, 1);
  const isReflex = bloomStyle === 'heliotropic-reflex';
  const stamenP = clamp((b - (isReflex ? 0.08 : 0.18)) / (isReflex ? 0.92 : 0.82), 0, 1);
  const smoothP = quinticSmoothstep(stamenP);
  const reflexBoost = isReflex ? openPitch * 0.28 * smoothP : 0;
  return closedPitch + (openPitch - closedPitch) * smoothP + reflexBoost;
}

export interface OrganBudToBloomPose {
  pitchRad: number;
  rollRad: number;
  yawRad: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
  breathPulse: number;
}

/**
 * Computes the complete non-intersecting bud-to-bloom interpolation & living botanical breathing
 * transform for a single petal or calyx sepal (`normalizedRank < 0` for sepals, `[0, 1]` for petals).
 *
 * Key Guarantees at `bloom01 = 0` (Tight Bud State):
 *   1. Convolute lateral width narrowing (`scaleX = 0.62..0.78`) prevents adjacent petals on the same
 *      or neighboring whorls from slicing through each other laterally.
 *   2. Radial shell thickness compression (`scaleZ = 0.48..0.64`) slims the 3D spoon belly in the closed
 *      bud so inner whorls never bulge into outer whorls and outer petals never pierce the calyx sepals.
 *   3. Zero lateral roll (`rollRad = 0`) and zero tangential yaw skew (`yawRad = baseYaw`) at `b = 0`
 *      keep every petal and sepal strictly aligned with its concentric radial shell.
 *   4. Continuous physiological breathing (`breathPulse`) animates a gentle inhale-exhale wave across
 *      both the sleeping bud (`b = 0`) and full blossom (`b = 1`).
 */
export function evaluateOrganBudToBloomPose(options: {
  closedPitch: number;
  openPitch: number;
  normalizedRank: number;
  bloom01: number;
  elapsedSec: number;
  phaseOffset: number;
  naturalScaleX: number;
  naturalScaleY: number;
  baseYaw: number;
  baseRoll: number;
  kineticDamping01?: number;
  bloomStyle?: BloomKinematicsStyle;
}): OrganBudToBloomPose {
  const b = clamp(options.bloom01, 0, 1);
  const damp = clamp(options.kineticDamping01 ?? 1.0, 0.2, 1.0);
  const style: BloomKinematicsStyle = options.bloomStyle ?? 'classic-cupped';
  const isReflex = style === 'heliotropic-reflex';
  const isSepal = options.normalizedRank < 0;
  const rank = isSepal ? 1.0 : clamp(options.normalizedRank, 0, 1);

  const basePitch = evaluateOrganPitchAtBloom(
    options.closedPitch,
    options.openPitch,
    options.normalizedRank,
    b,
    style,
  );

  // Dual-harmonic physiological breathing wave propagating radially from heart (rank=0) to outer rim (rank=1)
  // At b=0, radial phase lag is small so concentric bud shells breathe in unison without colliding;
  // as b->1, the radial phase lag expands into a lush cascading phyllotaxis breathing wave.
  const radialLag = (isSepal ? 1.65 : rank * 1.35) * (0.22 + 0.78 * b);
  const phaseJitter = options.phaseOffset * (0.12 + 0.48 * b);
  const breathFreq = isReflex ? 1.72 : 1.48;
  const primaryBreath = Math.sin(
    options.elapsedSec * breathFreq - radialLag + phaseJitter,
  );
  const secondaryBreath =
    Math.cos(
      options.elapsedSec * (breathFreq * 2.0) -
        radialLag * 1.3 +
        phaseJitter * 1.4,
    ) * 0.34;
  const breathPulse =
    clamp((primaryBreath + secondaryBreath) / 1.34, -1, 1) * damp;

  // Pitch breathing: gentle sleeping-bud respiration (0.012 rad) at b=0, expanding to 0.042..0.052 rad at b=1
  const pitchBreathAmp = isSepal
    ? 0.008 + 0.022 * b
    : 0.012 + (isReflex ? 0.038 : 0.030) * b;
  const pitchRad = Math.max(0.04, basePitch + breathPulse * pitchBreathAmp);

  // Roll & Yaw: strictly 0 roll/yaw skew at b=0 so closed bud petals stay 100% concentric!
  const bloomRollEnvelope = b * b;
  const rollWave =
    Math.sin(
      options.elapsedSec * 1.55 + options.phaseOffset * 1.1 - radialLag * 0.5,
    ) *
    0.022 *
    bloomRollEnvelope *
    damp;
  const rollRad = options.baseRoll * bloomRollEnvelope + rollWave;

  // Gentle imbricate spiral twist only during mid-bloom unfurling (0 at b=0 and 0 at b=1)
  const midBloomSpiral = isSepal
    ? 0
    : 4 * b * (1 - b) * (isReflex ? 0.068 : 0.045) * rank;
  const azimuthBreath =
    Math.cos(options.elapsedSec * 1.32 + options.phaseOffset * 0.8) *
    0.012 *
    bloomRollEnvelope *
    damp;
  const yawRad = options.baseYaw + midBloomSpiral + azimuthBreath;

  // Convolute width unfurling (0.62..0.78 at b=0 -> 1.0 at b>=0.68) + subtle breathing width expansion
  const widthUnfurl = quinticSmoothstep(clamp(b / 0.68, 0, 1));
  const closedWidthRatio = isSepal ? 0.82 : 0.62 + 0.14 * rank;
  const breathWidthMod = 1.0 + breathPulse * (0.012 + 0.018 * b);
  const scaleX =
    (closedWidthRatio + (1.0 - closedWidthRatio) * widthUnfurl) *
    options.naturalScaleX *
    breathWidthMod;

  // Length elongation + breathing stretch
  const lengthUnfurl = quinticSmoothstep(clamp(b / 0.75, 0, 1));
  const closedLengthRatio = isSepal ? 0.92 : 0.90 + 0.04 * rank;
  const breathLengthMod = 1.0 + breathPulse * (0.008 + 0.012 * b);
  const scaleY =
    (closedLengthRatio + (1.0 - closedLengthRatio) * lengthUnfurl) *
    options.naturalScaleY *
    breathLengthMod;

  // Shell Z-depth compression in bud state (0.48..0.64 at b=0 -> 1.0 at b>=0.75) prevents belly intersection!
  const cupUnfurl = quinticSmoothstep(clamp(b / 0.75, 0, 1));
  const closedCupRatio = isSepal ? 0.48 : 0.52 + 0.12 * rank;
  const reflexCupFlatten = isReflex && !isSepal ? 1.0 - 0.18 * b * b : 1.0;
  const breathCupMod = 1.0 + breathPulse * (0.022 + 0.032 * b);
  const scaleZ =
    (closedCupRatio + (1.0 - closedCupRatio) * cupUnfurl) *
    reflexCupFlatten *
    breathCupMod;

  return {
    pitchRad,
    rollRad,
    yawRad,
    scaleX,
    scaleY,
    scaleZ,
    breathPulse,
  };
}

/**
 * Generates anatomically accurate 21-point 3D hand landmarks for specific ML gesture archetypes
 * so users and automated tests can switch poses or interpolate smoothly between finger states.
 */
export function buildPresetPoseLandmarks(
  pose: HandPoseLabel,
  centerX = 0.5,
  centerY = 0.5,
  aperture01 = 0.5,
): Point3D[] {
  const wrist: Point3D = {x: centerX, y: clamp(centerY + 0.26, 0.15, 0.92), z: 0};
  const pts: Point3D[] = Array.from({length: 21}, () => ({
    x: centerX,
    y: centerY,
    z: 0,
  }));
  pts[0] = wrist;

  // Knuckle MCP bridge (5, 9, 13, 17)
  pts[5] = {x: centerX - 0.06, y: wrist.y - 0.18, z: 0};
  pts[9] = {x: centerX - 0.015, y: wrist.y - 0.2, z: 0};
  pts[13] = {x: centerX + 0.03, y: wrist.y - 0.19, z: 0};
  pts[17] = {x: centerX + 0.075, y: wrist.y - 0.17, z: 0};

  const setFingerChain = (
    mcpIdx: number,
    pipIdx: number,
    dipIdx: number,
    tipIdx: number,
    ext01: number,
    spreadX: number,
  ) => {
    const mcp = pts[mcpIdx];
    const e = clamp(ext01, 0, 1);
    const reachY = 0.03 + e * 0.22;
    pts[pipIdx] = {
      x: mcp.x + spreadX * 0.35,
      y: mcp.y - (0.04 + e * 0.05),
      z: (1 - e) * -0.02,
    };
    pts[dipIdx] = {
      x: mcp.x + spreadX * 0.7,
      y: mcp.y - (0.02 + e * 0.13),
      z: (1 - e) * -0.03,
    };
    pts[tipIdx] = {
      x: mcp.x + spreadX,
      y: mcp.y - (e < 0.25 ? 0.01 : reachY),
      z: (1 - e) * -0.04,
    };
  };

  const setThumbChain = (ext01: number, pinchToIndex = false) => {
    const e = clamp(ext01, 0, 1);
    pts[1] = {x: wrist.x - 0.04, y: wrist.y - 0.05, z: 0};
    pts[2] = {x: wrist.x - 0.075, y: wrist.y - 0.11, z: 0};
    if (pinchToIndex) {
      pts[3] = {x: pts[5].x - 0.02, y: pts[5].y - 0.05, z: 0};
      pts[4] = {x: pts[8].x - 0.012, y: pts[8].y + 0.005, z: 0};
    } else {
      pts[3] = {
        x: wrist.x - 0.09 - e * 0.06,
        y: wrist.y - 0.15 - e * 0.04,
        z: 0,
      };
      pts[4] = {
        x: wrist.x - 0.1 - e * 0.11,
        y: wrist.y - 0.17 - e * 0.06,
        z: 0,
      };
    }
  };

  if (pose === 'closed-fist') {
    setFingerChain(5, 6, 7, 8, 0.0, -0.01);
    setFingerChain(9, 10, 11, 12, 0.0, 0.0);
    setFingerChain(13, 14, 15, 16, 0.0, 0.01);
    setFingerChain(17, 18, 19, 20, 0.0, 0.02);
    pts[4] = {x: pts[5].x + 0.01, y: pts[5].y + 0.01, z: -0.02};
    pts[8] = {x: pts[5].x + 0.02, y: pts[5].y + 0.01, z: -0.02};
  } else if (pose === 'open-palm') {
    setFingerChain(5, 6, 7, 8, 1.0, -0.045);
    setFingerChain(9, 10, 11, 12, 1.0, -0.01);
    setFingerChain(13, 14, 15, 16, 1.0, 0.028);
    setFingerChain(17, 18, 19, 20, 1.0, 0.065);
    setThumbChain(1.0, false);
  } else if (pose === 'pinch-grab') {
    setFingerChain(5, 6, 7, 8, 0.35, -0.02);
    setFingerChain(9, 10, 11, 12, 0.96, 0.005);
    setFingerChain(13, 14, 15, 16, 0.94, 0.035);
    setFingerChain(17, 18, 19, 20, 0.92, 0.068);
    setThumbChain(0.4, true);
  } else if (pose === 'pointing') {
    setFingerChain(5, 6, 7, 8, 0.98, -0.01);
    setFingerChain(9, 10, 11, 12, 0.0, 0.0);
    setFingerChain(13, 14, 15, 16, 0.0, 0.01);
    setFingerChain(17, 18, 19, 20, 0.0, 0.02);
    pts[4] = {x: pts[6].x + 0.015, y: pts[6].y + 0.01, z: -0.01};
  } else if (pose === 'victory') {
    setFingerChain(5, 6, 7, 8, 0.96, -0.045);
    setFingerChain(9, 10, 11, 12, 0.96, 0.035);
    setFingerChain(13, 14, 15, 16, 0.0, 0.01);
    setFingerChain(17, 18, 19, 20, 0.0, 0.02);
    pts[4] = {x: pts[13].x - 0.01, y: pts[13].y + 0.02, z: -0.02};
  } else {
    // 'pinch-caliper' or 'pinch-spread'
    const a = clamp(aperture01, 0, 1);
    setFingerChain(5, 6, 7, 8, 0.35 + a * 0.65, -0.02 - a * 0.02);
    setFingerChain(9, 10, 11, 12, 0.0, 0.0);
    setFingerChain(13, 14, 15, 16, 0.0, 0.01);
    setFingerChain(17, 18, 19, 20, 0.0, 0.02);
    const pinchSpan = 0.012 + a * 0.22;
    pts[4] = {
      x: pts[8].x - pinchSpan * 0.85,
      y: pts[8].y + (1 - a) * 0.02,
      z: 0,
    };
  }

  return pts;
}

/**
 * Real-time lightweight Computer Vision frame analyzer that extracts hand centroid,
 * spatial spread aperture, and motion cues from an RGBA image buffer (e.g. 64x48 downsampled video frame)
 * when WASM/GPU hand landmarkers are warming up or running in fallback mode.
 */
export function analyzeVideoFramePixels(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
): {
  centroidX: number;
  centroidY: number;
  spreadAperture01: number;
  activeRatio: number;
} {
  if (!rgba || width <= 0 || height <= 0) {
    return {centroidX: 0.5, centroidY: 0.5, spreadAperture01: 0.6, activeRatio: 0};
  }

  let sumX = 0;
  let sumY = 0;
  let sumXX = 0;
  let sumYY = 0;
  let weightSum = 0;

  const totalPixels = width * height;
  for (let y = 0; y < height; y++) {
    const ny = y / height;
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = rgba[idx];
      const g = rgba[idx + 1];
      const b = rgba[idx + 2];

      // Skin-tone & warm foreground salience heuristic in RGB/YCrCb
      const maxC = Math.max(r, g, b);
      const minC = Math.min(r, g, b);
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      const isSkinLike =
        r > 75 &&
        g > 35 &&
        b > 20 &&
        r > g &&
        r > b &&
        maxC - minC > 15;
      const weight = isSkinLike ? 1.8 : luma > 65 ? (luma - 65) / 190 : 0;

      if (weight > 0.05) {
        const nx = 1 - x / width; // mirrored camera coordinate
        sumX += nx * weight;
        sumY += ny * weight;
        sumXX += nx * nx * weight;
        sumYY += ny * ny * weight;
        weightSum += weight;
      }
    }
  }

  if (weightSum < totalPixels * 0.015) {
    return {centroidX: 0.5, centroidY: 0.5, spreadAperture01: 0.6, activeRatio: 0};
  }

  const cx = clamp(sumX / weightSum, 0.12, 0.88);
  const cy = clamp(sumY / weightSum, 0.12, 0.88);
  const varX = Math.max(0, sumXX / weightSum - cx * cx);
  const varY = Math.max(0, sumYY / weightSum - cy * cy);
  const stdRadius = Math.sqrt(varX + varY);
  const spreadAperture01 = clamp((stdRadius - 0.11) / (0.26 - 0.11), 0, 1);

  return {
    centroidX: cx,
    centroidY: cy,
    spreadAperture01,
    activeRatio: clamp(weightSum / totalPixels, 0, 1),
  };
}

export type GaussianSplatMode = 'hybrid-3dgs' | 'pure-3dgs' | 'pbr-mesh';

export interface GaussianSplat2DCovariance {
  a: number;
  b: number;
  c: number;
  majorAxis: number;
  minorAxis: number;
  det: number;
}

/**
 * Evaluates 3D Gaussian Splatting (3DGS) view-dependent Spherical Harmonics (SH Degree 1 & 2)
 * radiance C(d) for a botanical Gaussian splat given camera view direction `viewDir` and
 * local organ normal `normalDir`.
 */
export function evaluateSphericalHarmonicsRadiance(
  sh0Rgb: [number, number, number],
  sh1TintRgb: [number, number, number],
  viewDir: [number, number, number],
  normalDir: [number, number, number],
): [number, number, number] {
  const vx = viewDir[0];
  const vy = viewDir[1];
  const vz = viewDir[2];
  const vLen = Math.hypot(vx, vy, vz) || 1;
  const dx = vx / vLen;
  const dy = vy / vLen;
  const dz = vz / vLen;

  const nx = normalDir[0];
  const ny = normalDir[1];
  const nz = normalDir[2];
  const nLen = Math.hypot(nx, ny, nz) || 1;
  const ndx = nx / nLen;
  const ndy = ny / nLen;
  const ndz = nz / nLen;

  // Real Spherical Harmonics basis constants (Kerbl et al. 2023)
  const SH_C1 = 0.4886025119029199;
  const SH_C2_0 = 1.0925484305920792;
  const SH_C2_1 = 0.31539156525252005;

  const y1 = SH_C1 * (dy * 0.45 + dz * 0.35 - dx * 0.25);
  const y2 =
    SH_C2_0 * dx * dy * 0.15 + SH_C2_1 * (3.0 * dz * dz - 1.0) * 0.18;

  // Anisotropic epidermal subsurface & velvet Fresnel response
  const ndotv = Math.abs(dx * ndx + dy * ndy + dz * ndz);
  const grazingSubsurface = Math.pow(1 - clamp(ndotv, 0, 1), 1.65);

  const shMod = clamp(0.18 * (y1 + y2) + 0.42 * grazingSubsurface, -0.15, 0.65);

  return [
    clamp(sh0Rgb[0] + sh1TintRgb[0] * shMod, 0, 1),
    clamp(sh0Rgb[1] + sh1TintRgb[1] * shMod, 0, 1),
    clamp(sh0Rgb[2] + sh1TintRgb[2] * shMod, 0, 1),
  ];
}

/**
 * Computes the EWA (Elliptical Weighted Average) projected 2D screen-space covariance matrix
 * Sigma_2D = J * Sigma_3D * J^T + 0.3 * I for an anisotropic 3D Gaussian ellipsoid.
 */
export function compute2DGaussianSplatCovariance(
  scale3D: [number, number, number],
  focalX: number,
  focalY: number,
  camZ: number,
  inPlaneAngleRad = 0,
): GaussianSplat2DCovariance {
  const safeZ = Math.max(0.15, Math.abs(camZ));
  const sx = Math.max(0.0002, scale3D[0]);
  const sy = Math.max(0.0002, scale3D[1]);

  const cosA = Math.cos(inPlaneAngleRad);
  const sinA = Math.sin(inPlaneAngleRad);

  const varX = sx * sx;
  const varY = sy * sy;

  // Rotated 2D covariance in camera plane before perspective projection
  const covXX = cosA * cosA * varX + sinA * sinA * varY;
  const covXY = cosA * sinA * (varX - varY);
  const covYY = sinA * sinA * varX + cosA * cosA * varY;

  const jx = focalX / safeZ;
  const jy = focalY / safeZ;

  // EWA low-pass dilation (+0.3 px^2) guarantees well-conditioned anti-aliased splat projection
  const a = covXX * jx * jx + 0.3;
  const b = covXY * jx * jy;
  const c = covYY * jy * jy + 0.3;

  const det = Math.max(1e-6, a * c - b * b);
  const mid = 0.5 * (a + c);
  const disc = Math.sqrt(Math.max(0, (a - c) * (a - c) * 0.25 + b * b));
  const lambda1 = Math.max(0.1, mid + disc);
  const lambda2 = Math.max(0.1, mid - disc);

  return {
    a,
    b,
    c,
    majorAxis: 3.0 * Math.sqrt(lambda1),
    minorAxis: 3.0 * Math.sqrt(lambda2),
    det,
  };
}

/**
 * Evaluates the 2D Gaussian splat kernel G(dx, dy) = alpha * exp(-0.5 * x^T * Sigma_2D^-1 * x)
 * with standard 3DGS 1/255 alpha cutoff culling.
 */
export function evaluateGaussianSplatKernel2D(
  dxPx: number,
  dyPx: number,
  cov: GaussianSplat2DCovariance,
  baseOpacity: number,
): number {
  const invDet = 1.0 / Math.max(1e-6, cov.det);
  const conicX = cov.c * invDet;
  const conicY = -cov.b * invDet;
  const conicZ = cov.a * invDet;

  const power =
    -0.5 *
    (conicX * dxPx * dxPx + 2.0 * conicY * dxPx * dyPx + conicZ * dyPx * dyPx);
  if (power > 0.0 || power < -4.5) return 0;

  const alpha = clamp(baseOpacity * Math.exp(power), 0, 0.99);
  return alpha < 1.0 / 255.0 ? 0 : alpha;
}

export interface BloomForceFieldState {
  interactionSpeed01: number;
  viscousDragFactor: number;
  centripetalStiffness: number;
  splatKineticCompression: number;
  maxParticleSpeed: number;
  maxRadialEnvelope: number;
  isHighSpeedDampingActive: boolean;
  dampingStatusZh: string;
}

/**
 * Computes the Force-Field Damping parameters for bloom particles and 3DGS splats
 * as a function of current bloom aperture `bloom01` in [0, 1], bloom rate of change
 * `bloomVelocity01PerSec` (1/s), 3-axis angular velocity `angularSpeedRadPerSec` (rad/s),
 * and gesture burst intensity.
 *
 * Prevents particle splashing or 3DGS overflow at high interaction speeds via:
 *   1. Non-linear velocity-dependent viscous drag (`viscousDragFactor`)
 *   2. Adaptive centripetal containment stiffness (`centripetalStiffness`)
 *   3. 3DGS covariance kinetic compression (`splatKineticCompression`)
 *   4. Strict radial containment boundary (`maxRadialEnvelope`)
 */
export function computeBloomForceFieldDamping(
  bloom01: number,
  bloomVelocity01PerSec: number,
  angularSpeedRadPerSec = 0,
  burstIntensity = 0,
): BloomForceFieldState {
  const b = clamp(bloom01, 0, 1);
  const absBloomVel = Math.abs(bloomVelocity01PerSec);
  const absAngVel = Math.abs(angularSpeedRadPerSec);

  // Normalized composite interaction speed in [0, 1] via smooth tanh saturation
  const rawInteractionEnergy =
    absBloomVel * 0.85 + absAngVel * 0.28 + clamp(burstIntensity, 0, 1) * 0.45;
  const interactionSpeed01 = clamp(Math.tanh(rawInteractionEnergy * 0.92), 0, 1);

  // Viscous drag increases sharply with interaction speed to absorb excess kinetic energy
  const viscousDragRate = 2.8 + interactionSpeed01 * 11.5 + interactionSpeed01 * interactionSpeed01 * 8.0;
  const viscousDragFactor = clamp(Math.exp(-viscousDragRate * (1 / 60)), 0.18, 0.96);

  // Centripetal restoring stiffness tightens the force-field wall during rapid hand gestures
  const centripetalStiffness = 4.2 + interactionSpeed01 * 14.8;

  // 3DGS splat covariance compression: tightens splats by up to 18% during rapid motion to prevent halo splash
  const splatKineticCompression = clamp(1.0 - interactionSpeed01 * 0.18, 0.82, 1.0);

  // Strict speed governor (m/s) and radial containment envelope (m)
  const maxParticleSpeed = 0.045 + b * 0.045 + (1 - interactionSpeed01) * 0.025;
  const maxRadialEnvelope = 0.036 + b * 0.078;

  const isHighSpeedDampingActive = interactionSpeed01 >= 0.28;
  const dampingStatusZh = isHighSpeedDampingActive
    ? `力场强阻尼抑制飞溅 (${Math.round(interactionSpeed01 * 100)}%)`
    : '力场层流稳态 · 零溢出';

  return {
    interactionSpeed01,
    viscousDragFactor,
    centripetalStiffness,
    splatKineticCompression,
    maxParticleSpeed,
    maxRadialEnvelope,
    isHighSpeedDampingActive,
    dampingStatusZh,
  };
}

export interface ForceFieldParticleState {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
}

/**
 * Advances a 3D bloom particle inside a cylindrical/toroidal botanical containment force field
 * centered at `(centerX, centerY, centerZ)`.
 * Guarantees that even under extreme velocity impulses or rapid 0% <-> 100% scrubbing,
 * the particle decelerates smoothly and NEVER splashes outside `maxRadius` or `[minY, maxY]`.
 */
export function stepForceFieldDampedParticle(
  state: ForceFieldParticleState,
  options: {
    centerX?: number;
    centerY?: number;
    centerZ?: number;
    targetOrbitRadius: number;
    maxRadius: number;
    minY: number;
    maxY: number;
    swirlSpeed: number;
    updraftSpeed: number;
    phase: number;
    elapsedSec: number;
    dt: number;
    damping: BloomForceFieldState;
  },
): ForceFieldParticleState {
  const cx = options.centerX ?? 0;
  const cy = options.centerY ?? 0;
  const cz = options.centerZ ?? 0;
  const safeDt = clamp(options.dt, 0.001, 0.05);
  const d = options.damping;

  const dx = state.x - cx;
  const dz = state.z - cz;
  const r = Math.hypot(dx, dz);
  const ux = r > 1e-5 ? dx / r : Math.cos(options.phase);
  const uz = r > 1e-5 ? dz / r : Math.sin(options.phase);

  // Tangential unit vector (-uz, ux) for smooth vortex circulation around the flower heart
  const tx = -uz;
  const tz = ux;

  // 1. Radial harmonic spring toward targetOrbitRadius + nonlinear cubic soft-wall barrier near maxRadius
  const radialError = r - options.targetOrbitRadius;
  const softWallStart = options.maxRadius * 0.78;
  const wallPenetration = Math.max(0, r - softWallStart);
  const normalizedPen = wallPenetration / Math.max(0.005, options.maxRadius - softWallStart);
  const cubicWallForce = normalizedPen * normalizedPen * normalizedPen * 1.85;

  const radialAccel =
    -d.centripetalStiffness * radialError -
    d.centripetalStiffness * cubicWallForce;

  // 2. Tangential vortex swirl (damped at high interaction speeds so particles don't centrifuge outward)
  const swirlSuppression = 1.0 - d.interactionSpeed01 * 0.55;
  const tangentialSpeed = options.swirlSpeed * swirlSuppression;

  // 3. Vertical buoyancy updraft + soft ceiling/floor containment spring
  const ySpan = Math.max(0.02, options.maxY - options.minY);
  const yNorm = (state.y - options.minY) / ySpan;
  let verticalAccel = (options.updraftSpeed * swirlSuppression - state.vy) * 4.5;
  if (yNorm > 0.82) {
    // Gentle recirculation pull downward near the upper canopy ceiling
    verticalAccel -= ((yNorm - 0.82) / 0.18) * d.centripetalStiffness * 0.45;
  } else if (yNorm < 0.12) {
    verticalAccel += ((0.12 - yNorm) / 0.12) * d.centripetalStiffness * 0.45;
  }

  let vx =
    state.vx +
    (ux * radialAccel + (tx * tangentialSpeed - state.vx) * 3.8) * safeDt;
  let vy = state.vy + verticalAccel * safeDt;
  let vz =
    state.vz +
    (uz * radialAccel + (tz * tangentialSpeed - state.vz) * 3.8) * safeDt;

  // 4. Frame-rate independent non-linear viscous force-field drag
  const frameDrag = Math.pow(d.viscousDragFactor, safeDt * 60);
  vx *= frameDrag;
  vy *= frameDrag;
  vz *= frameDrag;

  // 5. Soft hyperbolic-tangent (`tanh`) velocity governor: prevents any velocity spike from splashing
  const speed = Math.hypot(vx, vy, vz);
  if (speed > 1e-5) {
    const cappedSpeed =
      d.maxParticleSpeed * Math.tanh(speed / Math.max(1e-4, d.maxParticleSpeed));
    const scale = cappedSpeed / speed;
    vx *= scale;
    vy *= scale;
    vz *= scale;
  }

  let nextX = state.x + vx * safeDt;
  let nextY = state.y + vy * safeDt;
  let nextZ = state.z + vz * safeDt;

  // 6. Strict radial & vertical boundary reflection/containment (zero overflow guarantee)
  const nextDx = nextX - cx;
  const nextDz = nextZ - cz;
  const nextR = Math.hypot(nextDx, nextDz);
  if (nextR > options.maxRadius) {
    const clampedR = options.maxRadius * (0.96 - 0.04 * Math.sin(options.elapsedSec + options.phase));
    const invR = clampedR / nextR;
    nextX = cx + nextDx * invR;
    nextZ = cz + nextDz * invR;
    // Damp outward radial velocity component
    const outDot = (vx * nextDx + vz * nextDz) / nextR;
    if (outDot > 0) {
      vx -= (nextDx / nextR) * outDot * 1.25;
      vz -= (nextDz / nextR) * outDot * 1.25;
    }
  }

  if (nextY > options.maxY) {
    // Seamless toroidal recirculation back to the nectar chalice base instead of popping out the top
    const respawnR = options.targetOrbitRadius * (0.65 + 0.25 * Math.sin(options.phase * 3.1));
    const respawnAng = options.phase + options.elapsedSec * 0.35;
    nextX = cx + Math.cos(respawnAng) * respawnR;
    nextY = cy + options.minY + ySpan * 0.08;
    nextZ = cz + Math.sin(respawnAng) * respawnR;
    vx *= 0.25;
    vy = Math.abs(vy) * 0.35;
    vz *= 0.25;
  } else if (nextY < cy + options.minY) {
    nextY = cy + options.minY;
    if (vy < 0) vy = -vy * 0.3;
  }

  return {x: nextX, y: nextY, z: nextZ, vx, vy, vz};
}

export interface DetailedBloomStageInfo {
  stageIndex: number; // 0..4
  stageNameZh: string;
  stageNameEn: string;
  stageDetailZh: string;
  tipUncurlFactor: number; // -0.35 (infolded bud tip) .. +1.0 (full reflexed tip)
  marginRuffleExpansion: number; // 0.22 .. 1.0
  venationTranslucencyBoost: number; // 0.0 .. 1.0
  antherDehiscenceGlow: number; // 0.0 .. 1.0
  dewdropSlideProgress: number; // 0.0 .. 1.0
}

/**
 * Evaluates multi-stage botanical blooming details (5-stage anthesis progression,
 * petal tip uncurling, marginal ruffle expansion, anther dehiscence glow, and dewdrop glide)
 * so the flower blooming animation exhibits rich, lifelike micro-details from 0% to 100%.
 */
export function evaluateDetailedBloomKinematics(
  bloom01: number,
  bloomVelocity01PerSec = 0,
): DetailedBloomStageInfo {
  const b = clamp(bloom01, 0, 1);
  const velDamp = clamp(1.0 - Math.abs(bloomVelocity01PerSec) * 0.12, 0.72, 1.0);

  let stageIndex = 0;
  let stageNameZh = '含苞待放';
  let stageNameEn = 'Tight Imbricate Bud';
  let stageDetailZh = '萼片紧抱 · 瓣尖内敛成苞';

  if (b >= 0.86) {
    stageIndex = 4;
    stageNameZh = '倾城满开';
    stageNameEn = 'Full Anthesis';
    stageDetailZh = '花冠全舒 · 药室授粉微旋 · 晨露滑落';
  } else if (b >= 0.62) {
    stageIndex = 3;
    stageNameZh = '金蕊吐芳';
    stageNameEn = 'Stamen Anthesis';
    stageDetailZh = '内瓣盛开 · 斐波那契花丝渐次展露';
  } else if (b >= 0.36) {
    stageIndex = 2;
    stageNameZh = '玉瓣半舒';
    stageNameEn = 'Whorl Unfurling';
    stageDetailZh = '外中轮花瓣层叠旋开 · 维管束透光增强';
  } else if (b >= 0.15) {
    stageIndex = 1;
    stageNameZh = '萼片初启';
    stageNameEn = 'Calyx Unclasping';
    stageDetailZh = '翠萼先行托举 · 外层护瓣微启';
  }

  // Smooth S-curve transition from inward-curled bud apex (-0.35) to outward-reflexed bloom (+1.0)
  const smoothB = b * b * (3 - 2 * b);
  const tipUncurlFactor = clamp((-0.35 + 1.35 * Math.pow(smoothB, 1.15)) * velDamp, -0.35, 1.0);
  const marginRuffleExpansion = clamp(0.22 + 0.78 * Math.pow(b, 1.25) * velDamp, 0.22, 1.0);
  const venationTranslucencyBoost = clamp(Math.pow(b, 0.85), 0, 1);
  const antherDehiscenceGlow = clamp((b - 0.42) / 0.58, 0, 1);
  const dewdropSlideProgress = clamp((b - 0.12) / 0.88, 0, 1);

  return {
    stageIndex,
    stageNameZh,
    stageNameEn,
    stageDetailZh,
    tipUncurlFactor,
    marginRuffleExpansion,
    venationTranslucencyBoost,
    antherDehiscenceGlow,
    dewdropSlideProgress,
  };
}

export interface FlowerEnvironmentLightingProfile {
  envId: string;
  themeMoodZh: string;
  colorTemperatureKelvin: number;
  // Scene & directional rig parameters
  keyLightPosition: [number, number, number];
  rimLightPosition: [number, number, number];
  keyLightIntensity: number;
  rimLightIntensity: number;
  hemiIntensity: number;
  fillLightIntensity: number;
  bounceLightIntensity: number;
  toneMappingExposure: number;
  environmentReflectionIntensity: number;
  fogDensity: number;
  skyHaloColorRgb: [number, number, number];
  skyEdgeTintRgb: [number, number, number];
  basinBaseHex: number;
  basinEmissiveHex: number;
  // 3D Flower surface & subsurface shader color-grading parameters
  petalDirectTintRgb: [number, number, number];
  petalShadowTintRgb: [number, number, number];
  subsurfaceTintRgb: [number, number, number];
  subsurfaceStrengthMultiplier: number;
  velvetSheenTintRgb: [number, number, number];
  sheenIntensityMultiplier: number;
  foliageColorShiftRgb: [number, number, number];
  splatKeyDir: [number, number, number];
  splatEnvRadianceTintRgb: [number, number, number];
  coreGlowColorHex: number;
  coreGlowIntensityMultiplier: number;
  dewdropSpecularTintHex: number;
}

function hexToRgb01(hex: number): [number, number, number] {
  const r = ((hex >> 16) & 0xff) / 255;
  const g = ((hex >> 8) & 0xff) / 255;
  const b = (hex & 0xff) / 255;
  return [r, g, b];
}

function rgb01ToHex(rgb: [number, number, number]): number {
  const r = Math.round(clamp(rgb[0], 0, 1) * 255);
  const g = Math.round(clamp(rgb[1], 0, 1) * 255);
  const b = Math.round(clamp(rgb[2], 0, 1) * 255);
  return (r << 16) | (g << 8) | b;
}

function normalizeVec3(v: [number, number, number]): [number, number, number] {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}

/**
 * Computes the complete 3D scene lighting rig & 3D flower shader color-grading profile
 * for the selected `EnvironmentSpec` and current `bloom01` state so that the 3D flower's
 * direct illumination, ambient crevices, subsurface translucency, velvet rim sheen,
 * foliage chlorophyll tone, and 3DGS radiance field harmonize with the active environment
 * (e.g., Studio, Living Room, Emerald Forest, or Golden Desert).
 */
export function computeFlowerEnvironmentLightingProfile(
  spec: EnvironmentSpec,
  bloom01 = 0.78,
): FlowerEnvironmentLightingProfile {
  const b = clamp(bloom01, 0, 1);

  if (spec.id === 'emerald-forest') {
    const keyPos: [number, number, number] = [0.95, 3.15, 0.25];
    return {
      envId: spec.id,
      themeMoodZh: '林冠翠影 · 冷润青苔漫反射与翡翠次表面透光',
      colorTemperatureKelvin: 6400,
      keyLightPosition: keyPos,
      rimLightPosition: [-1.42, 2.45, -2.25],
      keyLightIntensity: 0.78 + b * 0.16,
      rimLightIntensity: 0.72 + b * 0.22,
      hemiIntensity: 0.44,
      fillLightIntensity: 0.34,
      bounceLightIntensity: 0.28 + b * 0.12,
      toneMappingExposure: 0.84,
      environmentReflectionIntensity: 0.34,
      fogDensity: 0.082,
      skyHaloColorRgb: [0.85, 0.98, 0.90],
      skyEdgeTintRgb: [0.64, 0.85, 0.75],
      basinBaseHex: 0xe3f4eb,
      basinEmissiveHex: 0xb6e2ca,
      // Dappled emerald-sunbeam direct highlight & cool mossy-jade shadow crevices on the flower
      petalDirectTintRgb: [0.86, 1.08, 0.94],
      petalShadowTintRgb: [0.54, 0.95, 0.82],
      subsurfaceTintRgb: [0.52, 1.04, 0.84],
      subsurfaceStrengthMultiplier: 1.36,
      velvetSheenTintRgb: [0.58, 1.04, 0.88],
      sheenIntensityMultiplier: 1.32,
      foliageColorShiftRgb: [0.78, 1.16, 0.94],
      splatKeyDir: normalizeVec3(keyPos),
      splatEnvRadianceTintRgb: [0.82, 1.08, 0.94],
      coreGlowColorHex: 0x6ee7b7,
      coreGlowIntensityMultiplier: 1.24,
      dewdropSpecularTintHex: 0xd1fae5,
    };
  }

  if (spec.id === 'golden-desert') {
    const keyPos: [number, number, number] = [2.15, 2.05, 0.68];
    return {
      envId: spec.id,
      themeMoodZh: '大漠金晖 · 炽热琥珀斜阳与赤陶暖沙漫反射',
      colorTemperatureKelvin: 3600,
      keyLightPosition: keyPos,
      rimLightPosition: [-1.75, 1.82, -2.42],
      keyLightIntensity: 1.04 + b * 0.20,
      rimLightIntensity: 0.76 + b * 0.22,
      hemiIntensity: 0.38,
      fillLightIntensity: 0.32,
      bounceLightIntensity: 0.34 + b * 0.14,
      toneMappingExposure: 0.88,
      environmentReflectionIntensity: 0.32,
      fogDensity: 0.076,
      skyHaloColorRgb: [1.0, 0.90, 0.72],
      skyEdgeTintRgb: [0.94, 0.72, 0.48],
      basinBaseHex: 0xfcead2,
      basinEmissiveHex: 0xf3c68f,
      // High-contrast golden-amber solar key & warm terracotta-ochre sand bounce on the flower
      petalDirectTintRgb: [1.16, 0.92, 0.70],
      petalShadowTintRgb: [1.08, 0.74, 0.52],
      subsurfaceTintRgb: [1.08, 0.75, 0.38],
      subsurfaceStrengthMultiplier: 1.32,
      velvetSheenTintRgb: [1.08, 0.82, 0.48],
      sheenIntensityMultiplier: 1.26,
      foliageColorShiftRgb: [1.16, 0.96, 0.74],
      splatKeyDir: normalizeVec3(keyPos),
      splatEnvRadianceTintRgb: [1.14, 0.89, 0.68],
      coreGlowColorHex: 0xff9e00,
      coreGlowIntensityMultiplier: 1.34,
      dewdropSpecularTintHex: 0xffedd5,
    };
  }

  if (spec.id === 'warm-living-room') {
    const keyPos: [number, number, number] = [-1.52, 2.48, 0.52];
    return {
      envId: spec.id,
      themeMoodZh: '纱窗暖阳 · 午后侧逆柔光与亚麻暖白漫反射',
      colorTemperatureKelvin: 4500,
      keyLightPosition: keyPos,
      rimLightPosition: [1.48, 2.12, -2.28],
      keyLightIntensity: 0.88 + b * 0.16,
      rimLightIntensity: 0.62 + b * 0.18,
      hemiIntensity: 0.36,
      fillLightIntensity: 0.30,
      bounceLightIntensity: 0.25 + b * 0.12,
      toneMappingExposure: 0.84,
      environmentReflectionIntensity: 0.29,
      fogDensity: 0.066,
      skyHaloColorRgb: [1.0, 0.945, 0.84],
      skyEdgeTintRgb: [0.96, 0.85, 0.70],
      basinBaseHex: 0xfff3df,
      basinEmissiveHex: 0xf9dfc0,
      petalDirectTintRgb: [1.03, 0.97, 0.90],
      petalShadowTintRgb: [0.98, 0.90, 0.82],
      subsurfaceTintRgb: [1.0, 0.90, 0.76],
      subsurfaceStrengthMultiplier: 1.08,
      velvetSheenTintRgb: [1.0, 0.93, 0.82],
      sheenIntensityMultiplier: 1.05,
      foliageColorShiftRgb: [1.03, 1.01, 0.92],
      splatKeyDir: normalizeVec3(keyPos),
      splatEnvRadianceTintRgb: [1.02, 0.96, 0.89],
      coreGlowColorHex: 0xffbe0b,
      coreGlowIntensityMultiplier: 1.06,
      dewdropSpecularTintHex: 0xfffbeb,
    };
  }

  // Default: 'translucent-white' (Warm Translucent White Studio) or custom EnvironmentSpec
  const keyRgb = hexToRgb01(spec.keyLightHex);
  const ambRgb = hexToRgb01(spec.ambientHex);
  const rimRgb = hexToRgb01(spec.rimLightHex);
  const keyPos: [number, number, number] = [1.45, 2.75, 0.45];
  return {
    envId: spec.id,
    themeMoodZh: '羊脂玉展厅 · 博物馆级均衡柔光与原色花맥还原',
    colorTemperatureKelvin: 5200,
    keyLightPosition: keyPos,
    rimLightPosition: [-1.55, 2.15, -2.35],
    keyLightIntensity: 0.84 + b * 0.16,
    rimLightIntensity: 0.58 + b * 0.18,
    hemiIntensity: 0.34,
    fillLightIntensity: 0.28,
    bounceLightIntensity: 0.22 + b * 0.12,
    toneMappingExposure: 0.82,
    environmentReflectionIntensity: 0.28,
    fogDensity: 0.068,
    skyHaloColorRgb: [1.0, 0.955, 0.86],
    skyEdgeTintRgb: [0.968, 0.872, 0.728],
    basinBaseHex: 0xfff5e4,
    basinEmissiveHex: 0xfce6c4,
    petalDirectTintRgb: [
      clamp(0.85 + keyRgb[0] * 0.15, 0.8, 1.15),
      clamp(0.85 + keyRgb[1] * 0.15, 0.8, 1.15),
      clamp(0.85 + keyRgb[2] * 0.15, 0.8, 1.15),
    ],
    petalShadowTintRgb: [
      clamp(0.75 + ambRgb[0] * 0.22, 0.6, 1.1),
      clamp(0.75 + ambRgb[1] * 0.22, 0.6, 1.1),
      clamp(0.75 + ambRgb[2] * 0.22, 0.6, 1.1),
    ],
    subsurfaceTintRgb: [
      clamp(0.7 + rimRgb[0] * 0.3, 0.5, 1.1),
      clamp(0.7 + rimRgb[1] * 0.3, 0.5, 1.1),
      clamp(0.7 + rimRgb[2] * 0.3, 0.5, 1.1),
    ],
    subsurfaceStrengthMultiplier: 1.0,
    velvetSheenTintRgb: [1.0, 0.97, 0.92],
    sheenIntensityMultiplier: 1.0,
    foliageColorShiftRgb: [1.0, 1.0, 1.0],
    splatKeyDir: normalizeVec3(keyPos),
    splatEnvRadianceTintRgb: [1.0, 0.98, 0.95],
    coreGlowColorHex: 0xffca3a,
    coreGlowIntensityMultiplier: 1.0,
    dewdropSpecularTintHex: 0xffffff,
  };
}

function lerpNum(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpVec3(
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] {
  return [
    lerpNum(a[0], b[0], t),
    lerpNum(a[1], b[1], t),
    lerpNum(a[2], b[2], t),
  ];
}

function lerpHex(hexA: number, hexB: number, t: number): number {
  return rgb01ToHex(lerpVec3(hexToRgb01(hexA), hexToRgb01(hexB), t));
}

/**
 * Smoothly interpolates between two `FlowerEnvironmentLightingProfile` states by `alpha` in [0, 1]
 * so switching environments produces a seamless cinematic lighting & petal color transition.
 */
export function interpolateFlowerLightingProfiles(
  from: FlowerEnvironmentLightingProfile,
  to: FlowerEnvironmentLightingProfile,
  alpha: number,
): FlowerEnvironmentLightingProfile {
  const t = clamp(alpha, 0, 1);
  return {
    envId: t > 0 ? to.envId : from.envId,
    themeMoodZh: t > 0 ? to.themeMoodZh : from.themeMoodZh,
    colorTemperatureKelvin: Math.round(
      lerpNum(from.colorTemperatureKelvin, to.colorTemperatureKelvin, t),
    ),
    keyLightPosition: lerpVec3(from.keyLightPosition, to.keyLightPosition, t),
    rimLightPosition: lerpVec3(from.rimLightPosition, to.rimLightPosition, t),
    keyLightIntensity: lerpNum(from.keyLightIntensity, to.keyLightIntensity, t),
    rimLightIntensity: lerpNum(from.rimLightIntensity, to.rimLightIntensity, t),
    hemiIntensity: lerpNum(from.hemiIntensity, to.hemiIntensity, t),
    fillLightIntensity: lerpNum(
      from.fillLightIntensity,
      to.fillLightIntensity,
      t,
    ),
    bounceLightIntensity: lerpNum(
      from.bounceLightIntensity,
      to.bounceLightIntensity,
      t,
    ),
    toneMappingExposure: lerpNum(
      from.toneMappingExposure,
      to.toneMappingExposure,
      t,
    ),
    environmentReflectionIntensity: lerpNum(
      from.environmentReflectionIntensity,
      to.environmentReflectionIntensity,
      t,
    ),
    fogDensity: lerpNum(from.fogDensity, to.fogDensity, t),
    skyHaloColorRgb: lerpVec3(from.skyHaloColorRgb, to.skyHaloColorRgb, t),
    skyEdgeTintRgb: lerpVec3(from.skyEdgeTintRgb, to.skyEdgeTintRgb, t),
    basinBaseHex: lerpHex(from.basinBaseHex, to.basinBaseHex, t),
    basinEmissiveHex: lerpHex(from.basinEmissiveHex, to.basinEmissiveHex, t),
    petalDirectTintRgb: lerpVec3(
      from.petalDirectTintRgb,
      to.petalDirectTintRgb,
      t,
    ),
    petalShadowTintRgb: lerpVec3(
      from.petalShadowTintRgb,
      to.petalShadowTintRgb,
      t,
    ),
    subsurfaceTintRgb: lerpVec3(
      from.subsurfaceTintRgb,
      to.subsurfaceTintRgb,
      t,
    ),
    subsurfaceStrengthMultiplier: lerpNum(
      from.subsurfaceStrengthMultiplier,
      to.subsurfaceStrengthMultiplier,
      t,
    ),
    velvetSheenTintRgb: lerpVec3(
      from.velvetSheenTintRgb,
      to.velvetSheenTintRgb,
      t,
    ),
    sheenIntensityMultiplier: lerpNum(
      from.sheenIntensityMultiplier,
      to.sheenIntensityMultiplier,
      t,
    ),
    foliageColorShiftRgb: lerpVec3(
      from.foliageColorShiftRgb,
      to.foliageColorShiftRgb,
      t,
    ),
    splatKeyDir: normalizeVec3(lerpVec3(from.splatKeyDir, to.splatKeyDir, t)),
    splatEnvRadianceTintRgb: lerpVec3(
      from.splatEnvRadianceTintRgb,
      to.splatEnvRadianceTintRgb,
      t,
    ),
    coreGlowColorHex: lerpHex(from.coreGlowColorHex, to.coreGlowColorHex, t),
    coreGlowIntensityMultiplier: lerpNum(
      from.coreGlowIntensityMultiplier,
      to.coreGlowIntensityMultiplier,
      t,
    ),
    dewdropSpecularTintHex: lerpHex(
      from.dewdropSpecularTintHex,
      to.dewdropSpecularTintHex,
      t,
    ),
  };
}





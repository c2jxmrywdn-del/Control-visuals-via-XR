import * as THREE from 'three';
import {
  FLOWER_LIBRARY,
  type FlowerSpec,
  clamp,
  computeFloralShellEnvelope,
  evaluateOrganPitchAtBloom,
  evaluateStamenPitchAtBloom,
} from './gestureMath';

interface PetalPivotData {
  pivot: THREE.Group;
  mesh: THREE.Mesh;
  normalizedRank: number; // 0 = innermost heart, 1 = outermost guard petal, -1 = calyx sepal
  closedPitch: number;
  openPitch: number;
  baseYaw: number;
  phaseOffset: number;
}

interface StamenPivotData {
  pivot: THREE.Group;
  closedPitch: number;
  openPitch: number;
  phaseOffset: number;
}

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5)); // ~2.3999632 rad (137.508 deg)
const IS_HEADLESS =
  typeof navigator !== 'undefined' &&
  (navigator.webdriver || /HeadlessChrome/i.test(navigator.userAgent));
const textureCache = new Map<string, THREE.CanvasTexture>();

/**
 * Injects an Unreal Engine 5 "Two-Sided Foliage / Subsurface Profile" shader term into
 * MeshPhysicalMaterial so thin petal margins transmit warm backlit radiance while the
 * thicker basal claw and vascular veins retain deep velvet cavity shading without overexposure.
 */
function applyUE5FoliageSubsurfaceShader(
  material: THREE.MeshPhysicalMaterial,
  subsurfaceColorHex: string,
  sssStrength = 0.16,
): void {
  const sssColor = new THREE.Color(subsurfaceColorHex);
  material.customProgramCacheKey = () =>
    `ue5_foliage_sss_v7_${subsurfaceColorHex}_${sssStrength.toFixed(2)}`;

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uSubsurfaceColor = {value: sssColor};
    shader.uniforms.uSubsurfaceStrength = {value: sssStrength};

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>
      uniform vec3 uSubsurfaceColor;
      uniform float uSubsurfaceStrength;`,
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `#if defined( USE_COLOR_ALPHA )
        diffuseColor *= vec4( vec3( vColor.r ), vColor.a );
      #elif defined( USE_COLOR )
        diffuseColor.rgb *= vec3( vColor.r );
      #endif`,
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <lights_fragment_end>',
      `#include <lights_fragment_end>
      #if defined( USE_COLOR )
        float ue5Translucency = clamp( vColor.g, 0.0, 1.0 );
        vec3 ue5ViewDir = normalize( vViewPosition );
        float ue5RimScatter = pow( 1.0 - abs( dot( normal, ue5ViewDir ) ), 2.0 );
        vec3 ue5LightAccum = clamp( reflectedLight.directDiffuse + reflectedLight.indirectDiffuse, vec3(0.0), vec3(1.1) );
        reflectedLight.indirectDiffuse += uSubsurfaceColor * ue5LightAccum * ue5Translucency * ( 0.3 + 0.7 * ue5RimScatter ) * uSubsurfaceStrength;
      #endif`,
    );
  };
}

/**
 * Generates a 1024x1024 UE5 Megascans-grade tangent-space normal map with a sculpted
 * primary midrib, dichotomous secondary veins, and delicate tertiary anastomosing venation.
 */
function getBotanicalNormalTexture(): THREE.CanvasTexture {
  const size = IS_HEADLESS ? 256 : 1024;
  const key = `ue5_botanical_normal_${size}_v7`;
  if (textureCache.has(key)) return textureCache.get(key)!;

  const scale = size / 1024;
  const hCanvas = document.createElement('canvas');
  hCanvas.width = size;
  hCanvas.height = size;
  const hCtx = hCanvas.getContext('2d')!;
  hCtx.save();
  hCtx.scale(scale, scale);

  hCtx.fillStyle = '#808080';
  hCtx.fillRect(0, 0, 1024, 1024);

  const midGrad = hCtx.createLinearGradient(448, 0, 576, 0);
  midGrad.addColorStop(0, 'rgba(128,128,128,0)');
  midGrad.addColorStop(0.35, 'rgba(190,190,190,0.32)');
  midGrad.addColorStop(0.5, 'rgba(248,248,248,0.58)');
  midGrad.addColorStop(0.65, 'rgba(190,190,190,0.32)');
  midGrad.addColorStop(1, 'rgba(128,128,128,0)');
  hCtx.fillStyle = midGrad;
  hCtx.fillRect(448, 0, 128, 1024);

  for (let i = 0; i < 56; i++) {
    const u = i / 55;
    const spreadX = (u - 0.5) * 960;
    hCtx.beginPath();
    hCtx.moveTo(512 + (u - 0.5) * 68, 1024);
    hCtx.bezierCurveTo(
      512 + spreadX * 0.28,
      720,
      512 + spreadX * 0.72,
      340,
      512 + spreadX,
      14,
    );
    hCtx.strokeStyle =
      i % 2 === 0 ? 'rgba(230,230,230,0.26)' : 'rgba(205,205,205,0.15)';
    hCtx.lineWidth = i % 2 === 0 ? 3.4 : 1.8;
    hCtx.stroke();
  }
  hCtx.restore();

  const srcData = hCtx.getImageData(0, 0, size, size).data;
  const nCanvas = document.createElement('canvas');
  nCanvas.width = size;
  nCanvas.height = size;
  const nCtx = nCanvas.getContext('2d')!;
  const outImg = nCtx.createImageData(size, size);
  const dst = outImg.data;
  const strength = 0.92;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const xm = Math.max(0, x - 1);
      const xp = Math.min(size - 1, x + 1);
      const ym = Math.max(0, y - 1);
      const yp = Math.min(size - 1, y + 1);

      const hL = srcData[(y * size + xm) * 4] / 255;
      const hR = srcData[(y * size + xp) * 4] / 255;
      const hU = srcData[(ym * size + x) * 4] / 255;
      const hD = srcData[(yp * size + x) * 4] / 255;

      const dx = (hL - hR) * strength;
      const dy = (hU - hD) * strength;
      const dz = 1.0;
      const invLen = 1 / Math.sqrt(dx * dx + dy * dy + dz * dz);

      const idx = (y * size + x) * 4;
      dst[idx] = Math.round((dx * invLen * 0.5 + 0.5) * 255);
      dst[idx + 1] = Math.round((dy * invLen * 0.5 + 0.5) * 255);
      dst[idx + 2] = Math.round((dz * invLen * 0.5 + 0.5) * 255);
      dst[idx + 3] = 255;
    }
  }
  nCtx.putImageData(outImg, 0, 0);

  const tex = new THREE.CanvasTexture(nCanvas);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  textureCache.set(key, tex);
  return tex;
}

function getBotanicalRoughnessTexture(): THREE.CanvasTexture {
  const key = 'ue5_botanical_roughness_512_v7';
  if (textureCache.has(key)) return textureCache.get(key)!;

  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, size, 0, 0);
  grad.addColorStop(0.0, '#4c4c4c');
  grad.addColorStop(0.35, '#6a6a6a');
  grad.addColorStop(0.85, '#7c7c7c');
  grad.addColorStop(1.0, '#606060');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 36; i++) {
    const u = i / 35;
    const spreadX = (u - 0.5) * 480;
    ctx.beginPath();
    ctx.moveTo(256 + (u - 0.5) * 36, size);
    ctx.quadraticCurveTo(256 + spreadX * 0.5, 256, 256 + spreadX, 8);
    ctx.strokeStyle = 'rgba(42,42,42,0.38)';
    ctx.lineWidth = 1.8;
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  textureCache.set(key, tex);
  return tex;
}

function getSpeciesPetalTexture(spec: FlowerSpec): THREE.CanvasTexture {
  const key = `ue5_albedo_1024_v7_${spec.id}`;
  if (textureCache.has(key)) return textureCache.get(key)!;

  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    const grad = ctx.createLinearGradient(0, size, 0, 0);
    if (spec.morphology === 'lotus-pod') {
      grad.addColorStop(0.0, '#b58428');
      grad.addColorStop(0.18, '#f3b8cc');
      grad.addColorStop(0.56, '#e64980');
      grad.addColorStop(0.86, '#c2255c');
      grad.addColorStop(1.0, '#9c1444');
    } else if (spec.morphology === 'lily-recurved') {
      grad.addColorStop(0.0, '#6a8e22');
      grad.addColorStop(0.16, '#c9184a');
      grad.addColorStop(0.8, '#d81159');
      grad.addColorStop(1.0, '#ffdde6');
    } else if (spec.morphology === 'peony-ruffled') {
      grad.addColorStop(0.0, '#3c0919');
      grad.addColorStop(0.26, '#8f1034');
      grad.addColorStop(0.68, '#d62452');
      grad.addColorStop(0.92, '#f26482');
      grad.addColorStop(1.0, '#ff9ebb');
    } else if (spec.morphology === 'sunflower-capitulum') {
      grad.addColorStop(0.0, '#9a3412');
      grad.addColorStop(0.22, '#ea580c');
      grad.addColorStop(0.55, '#f59e0b');
      grad.addColorStop(0.88, '#fbbf24');
      grad.addColorStop(1.0, '#fde047');
    } else if (spec.morphology === 'camellia-fibonacci') {
      grad.addColorStop(0.0, '#9e3f56');
      grad.addColorStop(0.35, '#d97288');
      grad.addColorStop(0.8, '#f2aebc');
      grad.addColorStop(1.0, '#fbd6de');
    } else {
      grad.addColorStop(0.0, spec.throatColor);
      grad.addColorStop(0.42, spec.primaryColor);
      grad.addColorStop(1.0, spec.secondaryColor);
    }

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    // Deep basal throat shading so the flower core & stamens stand out in crisp relief
    const radialGlow = ctx.createRadialGradient(512, 960, 16, 512, 820, 420);
    radialGlow.addColorStop(0, 'rgba(35, 12, 22, 0.55)');
    radialGlow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = radialGlow;
    ctx.fillRect(0, 0, size, size);

    if (spec.morphology === 'lily-recurved') {
      const edgeLeft = ctx.createLinearGradient(0, 0, 175, 0);
      edgeLeft.addColorStop(0, '#ffeef3');
      edgeLeft.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = edgeLeft;
      ctx.fillRect(0, 0, 175, size);

      const edgeRight = ctx.createLinearGradient(size, 0, size - 175, 0);
      edgeRight.addColorStop(0, '#ffeef3');
      edgeRight.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = edgeRight;
      ctx.fillRect(size - 175, 0, 175, size);

      const furrow = ctx.createLinearGradient(470, 400, 554, 400);
      furrow.addColorStop(0, 'rgba(138,180,46,0)');
      furrow.addColorStop(0.5, 'rgba(138,180,46,0.72)');
      furrow.addColorStop(1, 'rgba(138,180,46,0)');
      ctx.fillStyle = furrow;
      ctx.fillRect(470, 340, 84, 684);

      // Authentic Stargazer Lily crimson-burgundy raised papillae spots (百合花瓣内侧星点乳突纹理)
      ctx.fillStyle = 'rgba(110, 8, 38, 0.68)';
      for (let s = 0; s < 42; s++) {
        const uSpot = ((s * 37) % 100) / 100;
        const vSpot = 0.25 + ((s * 53) % 55) / 100;
        const sx = 220 + uSpot * 584;
        const sy = vSpot * size;
        const sr = 3.5 + (s % 4) * 1.6;
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Fine anatomical vascular bundles with clear contrast
    for (let i = 0; i < 52; i++) {
      const u = i / 51;
      const spreadX = (u - 0.5) * 950;
      ctx.beginPath();
      ctx.moveTo(512 + (u - 0.5) * 76, size);
      ctx.quadraticCurveTo(512 + spreadX * 0.52, 512, 512 + spreadX, 16);
      ctx.strokeStyle =
        spec.morphology === 'waterlily-stellate'
          ? 'rgba(128, 255, 219, 0.28)'
          : spec.morphology === 'lotus-pod'
            ? 'rgba(145, 14, 62, 0.26)'
            : spec.morphology === 'peony-ruffled'
              ? 'rgba(95, 8, 32, 0.24)'
              : 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = i % 3 === 0 ? 2.8 : 1.5;
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  textureCache.set(key, tex);
  return tex;
}

function samplePetalSurfacePointAndNormal(
  geometry: THREE.BufferGeometry,
  uNorm: number,
  vNorm: number,
  segU = IS_HEADLESS ? 20 : 44,
  segV = IS_HEADLESS ? 24 : 52,
): {position: THREE.Vector3; normal: THREE.Vector3} {
  const col = clamp(Math.round(((uNorm + 1) * 0.5) * segU), 0, segU);
  const row = clamp(Math.round((1 - vNorm) * segV), 0, segV);
  const vertIdx = row * (segU + 1) + col;

  const posAttr = geometry.attributes.position;
  const normAttr = geometry.attributes.normal;
  const position = new THREE.Vector3(
    posAttr.getX(vertIdx),
    posAttr.getY(vertIdx),
    posAttr.getZ(vertIdx),
  );
  const normal = new THREE.Vector3(
    normAttr.getX(vertIdx),
    normAttr.getY(vertIdx),
    normAttr.getZ(vertIdx),
  ).normalize();
  if (normal.z < 0) normal.negate();
  return {position, normal};
}

/**
 * High-poly UE5 sculpted petal/leaf geometry (44 x 52 = 4,576 triangles per mesh on GPU,
 * 20 x 24 in headless software WebGL) with authentic botanical tip roundness and margin serration.
 */
function createSculptedPetalGeometry(
  length: number,
  width: number,
  cupDepth: number,
  ruffleFreq: number,
  ruffleAmp: number,
  tipNotchDepth: number,
  widthTipBias = 0.62,
  aoDarkenFactor = 0.48,
  recurvedFactor = 0.2,
  tipRoundness = 0.65,
  serrationAmp = 0.0,
): THREE.BufferGeometry {
  const segU = IS_HEADLESS ? 20 : 44;
  const segV = IS_HEADLESS ? 24 : 52;
  const geometry = new THREE.PlaneGeometry(1, 1, segU, segV);
  const pos = geometry.attributes.position;
  const colors = new Float32Array(pos.count * 3);

  const safeCup = clamp(cupDepth, 0.04, 0.26);
  const safeRuffle = clamp(ruffleAmp, 0, 0.0085);
  const safeRecurve = clamp(recurvedFactor, -0.1, 0.24);

  for (let i = 0; i < pos.count; i++) {
    const rawX = pos.getX(i);
    const rawY = pos.getY(i);

    const u = rawX * 2; // -1 .. +1
    const v = rawY + 0.5; // 0 .. 1

    const peakV = clamp(widthTipBias, 0.45, 0.76);
    let widthProfile: number;
    if (v <= peakV) {
      const t = v / peakV;
      widthProfile =
        0.14 + 0.86 * Math.sin(Math.pow(t, 0.78) * (Math.PI * 0.5));
    } else {
      const t = clamp((v - peakV) / Math.max(0.05, 1 - peakV), 0, 1);
      const acuteArch = Math.cos(t * (Math.PI * 0.5));
      const obovateDome = Math.sqrt(Math.max(0, 1 - Math.pow(t, 2.35)));
      widthProfile =
        0.06 +
        0.94 * (acuteArch * (1 - tipRoundness) + obovateDome * tipRoundness);
    }

    const frillEdge =
      tipNotchDepth > 0.004
        ? 1 +
          Math.cos(u * Math.PI * 3.5) * tipNotchDepth * 0.14 * Math.pow(v, 2)
        : 1;
    // Botanical leaf margin serrations (叶片边缘细密锯齿)
    const serration =
      serrationAmp > 0.0005 && v > 0.12 && v < 0.94
        ? (0.5 - 0.5 * Math.cos(v * Math.PI * 22)) *
          serrationAmp *
          Math.pow(Math.abs(u), 2)
        : 0;
    const x =
      u * (width * 0.5) * widthProfile * frillEdge +
      Math.sign(u) * serration;

    const edgeArcDrop =
      tipRoundness > 0.45
        ? Math.pow(Math.abs(u), 2.4) * length * 0.065 * Math.pow(v, 2)
        : 0;
    const smoothCleft = (1 - Math.cos(u * Math.PI * 2.5)) * 0.5;
    const tipNotch =
      tipNotchDepth > 0.004 && v > 0.74
        ? smoothCleft *
          tipNotchDepth *
          length *
          Math.pow((v - 0.74) / 0.26, 1.5)
        : 0;
    const y = v * length - tipNotch - edgeArcDrop;

    const cupZ = +(u * u) * width * safeCup * Math.sin(v * Math.PI) * 0.5;
    const bellyZ = -Math.sin(v * Math.PI) * length * safeCup * 0.14;
    const tipReflexZ =
      -Math.pow(Math.max(0, v - 0.56) / 0.44, 1.85) * length * safeRecurve;
    const keelZ =
      -Math.exp(-Math.abs(u) * 8.5) * 0.0042 * Math.sin(v * Math.PI);
    const microVeinRelief =
      Math.cos((Math.abs(u) * 14 - v * 6) * Math.PI) *
      0.00048 *
      Math.sin(v * Math.PI) *
      (1 - Math.exp(-Math.abs(u) * 5));
    const ruffleZ =
      Math.sin(u * Math.PI * ruffleFreq) *
      safeRuffle *
      Math.pow(v, 1.75) *
      Math.pow(Math.abs(u), 1.4);

    const z =
      cupZ + bellyZ + tipReflexZ + keelZ + microVeinRelief + ruffleZ;
    pos.setXYZ(i, x, y, z);

    // Channel R: Deep Cavity AO so inner flower heart & stamen zone has high-contrast shadow depth
    const ao = clamp(1 - Math.pow(1 - v, 1.3) * aoDarkenFactor, 0.32, 0.96);
    const edgeRim = Math.pow(Math.abs(u), 2.4) * 0.04 * v;
    const rAO = clamp(ao + edgeRim, 0.32, 0.98);

    const midribThickness = Math.exp(-Math.abs(u) * 6.0) * 0.35;
    const gTranslucency = clamp(
      0.1 +
        Math.pow(v, 0.9) * 0.58 +
        Math.pow(Math.abs(u), 1.6) * 0.22 -
        midribThickness,
      0.06,
      0.88,
    );

    colors[i * 3] = rAO;
    colors[i * 3 + 1] = gTranslucency;
    colors[i * 3 + 2] = rAO;
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Builds a true 3D Bilobed Anther Geometry (双药室纵裂花药，带药隔凹槽) by merging
 * left pollen theca, right pollen theca, and central connective tissue ridge.
 */
function createBilobedAntherGeometry(
  lobeRadius: number,
  lobeLength: number,
  isVersatileLily: boolean,
  filamentTipY: number,
  filamentTipZ: number,
): THREE.BufferGeometry {
  const segR = 8;
  const segH = 10;
  const baseCapsule = new THREE.CapsuleGeometry(
    lobeRadius,
    lobeLength,
    segR,
    segH,
  );
  const pos = baseCapsule.attributes.position;

  // Sculpt a deep longitudinal stomium/connective furrow along x = 0 so the two pollen sacs
  // (left and right thecae) are distinctly separated in 3D relief
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const absX = Math.abs(x) / Math.max(0.0001, lobeRadius);
    const groovePinch = 0.55 + 0.45 * Math.sin(Math.min(1, absX) * (Math.PI / 2));
    const wideX = x * 1.48 + Math.sign(x || 1) * lobeRadius * 0.22;
    pos.setXYZ(i, wideX, y, z * groovePinch);
  }
  baseCapsule.computeVertexNormals();

  if (isVersatileLily) {
    baseCapsule.rotateZ(1.18);
  }
  baseCapsule.translate(0, filamentTipY + lobeLength * 0.22, filamentTipZ);
  return baseCapsule;
}

export class ProceduralFlowerModel extends THREE.Group {
  readonly spec: FlowerSpec;
  private readonly flowerHeadGroup = new THREE.Group();
  private readonly companionBudGroup = new THREE.Group();
  private readonly petalPivots: PetalPivotData[] = [];
  private readonly companionBudPivots: PetalPivotData[] = [];
  private readonly stamenPivots: StamenPivotData[] = [];
  private readonly materialsToDispose: THREE.Material[] = [];
  private readonly geometriesToDispose: THREE.BufferGeometry[] = [];
  private mainStemCurve!: THREE.CatmullRomCurve3;
  private coreGlowLight: THREE.PointLight;
  private currentBloom01 = 0.78;
  private userHeadPitchRad = 0.58;
  private userHeadRollRad = 0;

  constructor(spec: FlowerSpec) {
    super();
    this.spec = spec;
    this.name = `Flower_${spec.id}`;

    this.scale.setScalar(1.38);

    // Flower head is permanently spliced to the stem apex at (0, 0.045, 0) with a natural
    // botanical inclination so the flower bud, stem, branches, and leaves ALWAYS rotate together!
    this.flowerHeadGroup.position.set(0, 0.045, 0);
    this.flowerHeadGroup.rotation.set(0.16, 0, 0);
    this.add(this.flowerHeadGroup);

    // Subtle warm nectar fill light (kept low so stamens and seeds never wash out or overexpose!)
    this.coreGlowLight = new THREE.PointLight(spec.coreColor, 0.08, 0.45, 2.0);
    this.coreGlowLight.position.set(0, 0.085, 0);
    this.flowerHeadGroup.add(this.coreGlowLight);

    this.buildSeamlessStemNodesLeavesAndBase();
    this.buildSpeciesCoreAndReproductiveOrgans();
    this.buildSepalsAndMorphologyCorolla();
    this.buildCrystalDewdrops();
    this.setBloom(0.78, 0);
  }

  /**
   * Stores user pitch/roll telemetry while keeping the flower head unified with its stem and leaves
   * (whole-plant 3-axis rotation is applied to flowerPivotGroup so branches, leaves, and buds rotate in unison).
   */
  setHeadOrientation(pitchXRad: number, rollZRad: number): void {
    this.userHeadPitchRad = pitchXRad;
    this.userHeadRollRad = rollZRad;
  }

  /**
   * Builds a 100% watertight, interconnected botanical stem hierarchy:
   *   Bottom Ikebana Kenzan Base & Root-Collar -> Main Curved Stem ->
   *   Swollen Nodal Pulvinus Rings & Stipules -> Curved Petioles -> 3D Midrib Leaf Blades ->
   *   Branch Fork Collar -> Side Pedicel -> Companion Bud Receptacle ->
   *   Spherical Peduncle-Receptacle Ball Joint & Subtending Bracteoles.
   */
  private buildSeamlessStemNodesLeavesAndBase(): void {
    const normalTex = getBotanicalNormalTexture();
    const roughTex = getBotanicalRoughnessTexture();
    const envelope = computeFloralShellEnvelope(this.spec);

    // 1. Main Botanical Stem Spine from the bottom sanctuary base (y = -0.305) up to the flower head joint (y = +0.045)
    this.mainStemCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.308, 0.0),
      new THREE.Vector3(-0.008, -0.21, -0.005),
      new THREE.Vector3(0.006, -0.1, 0.004),
      new THREE.Vector3(0, 0.045, 0),
    ]);
    const stemGeo = new THREE.TubeGeometry(
      this.mainStemCurve,
      48,
      0.0138,
      20,
      false,
    );
    const stemMat = new THREE.MeshPhysicalMaterial({
      color: this.spec.stemColor,
      roughness: 0.42,
      roughnessMap: roughTex,
      metalness: 0.02,
      clearcoat: 0.34,
      clearcoatRoughness: 0.28,
      sheen: 0.35,
      sheenColor: new THREE.Color('#74c69d'),
    });
    const stemMesh = new THREE.Mesh(stemGeo, stemMat);
    stemMesh.castShadow = true;
    stemMesh.receiveShadow = true;
    this.add(stemMesh);
    this.geometriesToDispose.push(stemGeo);
    this.materialsToDispose.push(stemMat);

    // 2. BOTTOM BASE CONNECTION: Woody Root-Collar + Attached Bronze-Jade Ikebana Kenzan Pod at (0, -0.312, 0)
    // Seamlessly splices the bottom of the stem into a watertight botanical kenzan holder that rotates with the plant!
    const rootCollarPoints = [
      new THREE.Vector2(0.0, -0.322),
      new THREE.Vector2(0.038, -0.322),
      new THREE.Vector2(0.036, -0.312),
      new THREE.Vector2(0.032, -0.298),
      new THREE.Vector2(0.021, -0.282),
      new THREE.Vector2(0.0155, -0.262),
      new THREE.Vector2(0.0138, -0.245),
    ];
    const rootCollarGeo = new THREE.LatheGeometry(rootCollarPoints, 32);
    const rootCollarMesh = new THREE.Mesh(rootCollarGeo, stemMat);
    rootCollarMesh.castShadow = true;
    rootCollarMesh.receiveShadow = true;
    this.add(rootCollarMesh);
    this.geometriesToDispose.push(rootCollarGeo);

    // Sculpted Champagne-Gold & Dark-Jade Ikebana Kenzan Socket Ring clasping the root collar
    const kenzanPodProfile = [
      new THREE.Vector2(0.0, -0.332),
      new THREE.Vector2(0.052, -0.332),
      new THREE.Vector2(0.058, -0.318),
      new THREE.Vector2(0.048, -0.304),
      new THREE.Vector2(0.034, -0.304),
    ];
    const kenzanPodGeo = new THREE.LatheGeometry(kenzanPodProfile, 36);
    const kenzanPodMat = new THREE.MeshPhysicalMaterial({
      color: 0xb89635,
      roughness: 0.28,
      metalness: 0.78,
      clearcoat: 0.5,
    });
    const kenzanPodMesh = new THREE.Mesh(kenzanPodGeo, kenzanPodMat);
    kenzanPodMesh.castShadow = true;
    kenzanPodMesh.receiveShadow = true;
    this.add(kenzanPodMesh);
    this.geometriesToDispose.push(kenzanPodGeo);
    this.materialsToDispose.push(kenzanPodMat);

    // Basal whorl of 3 clasping scale leaves (底部抱茎鳞片叶，严密包裹茎基与底座交界)
    const basalScaleGeo = createSculptedPetalGeometry(
      0.072,
      0.038,
      0.24,
      1.0,
      0.001,
      0,
      0.5,
      0.4,
      0.16,
      0.3,
    );
    this.geometriesToDispose.push(basalScaleGeo);

    // 3. TOP NECK CONNECTION: Spherical Peduncle Apex Ball + 4 Subtending Bracteoles + Articulated Receptacle Cup
    const neckBallGeo = new THREE.SphereGeometry(0.0175, 24, 24);
    const neckBallMesh = new THREE.Mesh(neckBallGeo, stemMat);
    neckBallMesh.position.set(0, 0.045, 0);
    this.add(neckBallMesh);
    this.geometriesToDispose.push(neckBallGeo);

    // Sculpted Lathe Hypanthium & Receptacle Torus (挂载在 flowerHeadGroup 内部，底部球窝严密包裹花梗顶端球节)
    const outerRimR = Math.min(0.088, envelope.sepalRadius + 0.005);
    const recepPoints = [
      new THREE.Vector2(0.015, -0.008),
      new THREE.Vector2(0.022, 0.0),
      new THREE.Vector2(outerRimR * 0.72, 0.006),
      new THREE.Vector2(outerRimR + 0.002, 0.014),
      new THREE.Vector2(outerRimR * 0.9, 0.022),
      new THREE.Vector2(0.012, 0.02),
    ];
    const recepGeo = new THREE.LatheGeometry(recepPoints, 40);
    const recepMesh = new THREE.Mesh(recepGeo, stemMat);
    recepMesh.castShadow = true;
    recepMesh.receiveShadow = true;
    this.flowerHeadGroup.add(recepMesh);
    this.geometriesToDispose.push(recepGeo);

    // Golden-Green Nectary Disc (花托蜜盘环) inside the receptacle rim
    const nectaryGeo = new THREE.TorusGeometry(
      envelope.stamenMinRadius * 0.92,
      0.0032,
      12,
      32,
    );
    nectaryGeo.rotateX(Math.PI / 2);
    const nectaryMat = new THREE.MeshPhysicalMaterial({
      color: '#8ac926',
      roughness: 0.22,
      clearcoat: 0.85,
    });
    const nectaryMesh = new THREE.Mesh(nectaryGeo, nectaryMat);
    nectaryMesh.position.y = 0.021;
    this.flowerHeadGroup.add(nectaryMesh);
    this.geometriesToDispose.push(nectaryGeo);
    this.materialsToDispose.push(nectaryMat);

    // 4. INTERCONNECTED STEM LEAVES: Sampled at exact 3D points along mainStemCurve
    //    Stem -> Swollen Nodal Sheath Ring -> Paired Stipules & Axillary Bud -> Curved Petiole -> 3D Midrib + Serrated Leaf Blade
    const leafGeo = createSculptedPetalGeometry(
      0.19,
      0.092,
      0.16,
      2.5,
      0.004,
      0.02,
      0.54,
      0.38,
      0.2,
      0.24,
      0.0032, // fine botanical leaf margin serrations
    );
    const stipuleGeo = createSculptedPetalGeometry(
      0.038,
      0.016,
      0.22,
      1.0,
      0.001,
      0,
      0.48,
      0.35,
      0.15,
      0.15,
    );
    const leafMat = new THREE.MeshPhysicalMaterial({
      color: '#2f6f4e',
      vertexColors: true,
      roughness: 0.34,
      roughnessMap: roughTex,
      metalness: 0.02,
      clearcoat: 0.42,
      clearcoatRoughness: 0.26,
      sheen: 0.42,
      sheenColor: new THREE.Color('#95d5b2'),
      normalMap: normalTex,
      normalScale: new THREE.Vector2(0.52, 0.52),
      side: THREE.DoubleSide,
    });
    applyUE5FoliageSubsurfaceShader(leafMat, '#52b788', 0.16);
    this.geometriesToDispose.push(leafGeo, stipuleGeo);
    this.materialsToDispose.push(leafMat);

    // Attach 3 basal clasping scale leaves around the bottom root-collar
    for (let bIdx = 0; bIdx < 3; bIdx++) {
      const bYaw = (bIdx / 3) * Math.PI * 2 + 0.4;
      const bPivot = new THREE.Group();
      bPivot.position.set(
        Math.cos(bYaw) * 0.018,
        -0.292,
        Math.sin(bYaw) * 0.018,
      );
      bPivot.rotation.y = -bYaw - Math.PI / 2;
      const bMesh = new THREE.Mesh(basalScaleGeo, leafMat);
      bMesh.rotation.x = -0.42;
      bPivot.add(bMesh);
      this.add(bPivot);
    }

    // Sculpted Nodal Pulvinus Collar Ring (抱茎节环，紧箍在主茎节点上)
    const nodalRingGeo = new THREE.TorusGeometry(0.0145, 0.0034, 12, 24);
    nodalRingGeo.rotateX(Math.PI / 2);

    // Curved Petiole Tube that seamlessly connects the nodal ring (z=0.012) to the leaf blade base (z=0.044, y=-0.006)
    const petioleCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.002, 0.011),
      new THREE.Vector3(0, 0.0, 0.028),
      new THREE.Vector3(0, -0.005, 0.045),
    ]);
    const petioleGeo = new THREE.TubeGeometry(petioleCurve, 14, 0.0036, 10, false);

    // Prominent 3D Abaxial Leaf Midrib Spine (贯穿叶片背面的立体主脉管，与叶柄末端直接相连)
    const midribCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, -0.001),
      new THREE.Vector3(0, 0.08, -0.005),
      new THREE.Vector3(0, 0.155, -0.012),
    ]);
    const midribGeo = new THREE.TubeGeometry(midribCurve, 14, 0.0022, 8, false);

    // Axillary Bud (叶腋新生幼芽)
    const axilBudGeo = new THREE.ConeGeometry(0.0045, 0.016, 10);
    axilBudGeo.translate(0, 0.008, 0);

    this.geometriesToDispose.push(
      nodalRingGeo,
      petioleGeo,
      midribGeo,
      axilBudGeo,
    );

    const leafNodeConfigs = [
      {tStem: 0.72, yaw: 0.65, pitch: -1.24, scale: 0.94},
      {tStem: 0.54, yaw: -2.1, pitch: -1.28, scale: 1.06},
      {tStem: 0.34, yaw: 2.3, pitch: -1.26, scale: 0.96},
      {tStem: 0.18, yaw: -0.85, pitch: -1.32, scale: 0.86},
    ];

    for (const cfg of leafNodeConfigs) {
      // Sample EXACT 3D point on the curved stem spine so the node ring wraps the stem with zero offset!
      const stemPoint = this.mainStemCurve.getPointAt(cfg.tStem);

      const collarMesh = new THREE.Mesh(nodalRingGeo, stemMat);
      collarMesh.position.copy(stemPoint);
      this.add(collarMesh);

      const nodeGroup = new THREE.Group();
      nodeGroup.position.copy(stemPoint);
      nodeGroup.rotation.y = -cfg.yaw - Math.PI / 2;

      // Petiole emerging from the nodal collar
      const petiole = new THREE.Mesh(petioleGeo, stemMat);
      petiole.castShadow = true;
      nodeGroup.add(petiole);

      // Axillary bud nestled in the upper angle between stem and petiole
      const axilBud = new THREE.Mesh(axilBudGeo, leafMat);
      axilBud.position.set(0, 0.004, 0.016);
      axilBud.rotation.x = 0.42;
      nodeGroup.add(axilBud);

      // Paired Stipules (双托叶) clasping the base of the petiole
      for (const side of [-1, 1]) {
        const stip = new THREE.Mesh(stipuleGeo, leafMat);
        stip.position.set(side * 0.008, 0.001, 0.015);
        stip.rotation.set(-0.55, side * 0.45, side * -0.35);
        nodeGroup.add(stip);
      }

      // Leaf blade + 3D midrib anchored at the exact endpoint of petioleCurve (0, -0.005, 0.045)
      const bladePivot = new THREE.Group();
      bladePivot.position.set(0, -0.005, 0.044);
      bladePivot.scale.setScalar(cfg.scale);

      const leaf = new THREE.Mesh(leafGeo, leafMat);
      leaf.rotation.x = cfg.pitch;
      leaf.castShadow = true;
      leaf.receiveShadow = true;

      const midrib = new THREE.Mesh(midribGeo, stemMat);
      leaf.add(midrib);

      bladePivot.add(leaf);
      nodeGroup.add(bladePivot);
      this.add(nodeGroup);
    }

    // 5. SEAMLESS COMPANION BUD SIDE BRANCH:
    //    Starts at exact stem node t=0.44 with a Branch Fork Collar + Bract, curves out to budPos,
    //    and aligns companionBudGroup's receptacle socket along the exact branch end tangent!
    const forkOrigin = this.mainStemCurve.getPointAt(0.44);
    const forkCollar = new THREE.Mesh(nodalRingGeo, stemMat);
    forkCollar.position.copy(forkOrigin);
    this.add(forkCollar);

    const [budX, budY, budZ] = envelope.companionBudPosition;
    const budTargetPos = new THREE.Vector3(budX, budY, budZ);
    const sideBranchCurve = new THREE.CatmullRomCurve3([
      forkOrigin.clone().add(new THREE.Vector3(0.006, 0, 0)),
      new THREE.Vector3(budX * 0.46, forkOrigin.y - 0.01, budZ * 0.48),
      new THREE.Vector3(budX * 0.84, budY - 0.048, budZ * 0.86),
      budTargetPos,
    ]);
    const sideStemGeo = new THREE.TubeGeometry(
      sideBranchCurve,
      28,
      0.0058,
      14,
      false,
    );
    const sideStemMesh = new THREE.Mesh(sideStemGeo, stemMat);
    sideStemMesh.castShadow = true;
    this.add(sideStemMesh);
    this.geometriesToDispose.push(sideStemGeo);

    // Subtending bract leaf at the branch fork
    const forkBractPivot = new THREE.Group();
    forkBractPivot.position.copy(forkOrigin).add(new THREE.Vector3(0.014, -0.004, 0));
    forkBractPivot.rotation.y = -Math.PI / 2;
    const forkBract = new THREE.Mesh(basalScaleGeo, leafMat);
    forkBract.rotation.x = -0.95;
    forkBractPivot.add(forkBract);
    this.add(forkBractPivot);

    // Align companionBudGroup with the exact endpoint and tangent of sideBranchCurve!
    const endTangent = sideBranchCurve.getTangentAt(1.0).normalize();
    this.companionBudGroup.position.copy(budTargetPos);
    this.companionBudGroup.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      endTangent,
    );

    const budReceptacleGeo = new THREE.LatheGeometry(
      [
        new THREE.Vector2(0.0058, -0.004), // matches sideStemGeo radius 0.0058 with 4mm overlap socket!
        new THREE.Vector2(0.011, 0.006),
        new THREE.Vector2(0.019, 0.016),
        new THREE.Vector2(0.016, 0.024),
      ],
      24,
    );
    const budReceptacle = new THREE.Mesh(budReceptacleGeo, stemMat);
    this.companionBudGroup.add(budReceptacle);
    this.geometriesToDispose.push(budReceptacleGeo);

    // 3 Calyx Sepals clasping the companion bud base
    for (let s = 0; s < 3; s++) {
      const sYaw = (s / 3) * Math.PI * 2;
      const sPiv = new THREE.Group();
      sPiv.position.set(
        Math.cos(sYaw) * 0.017,
        0.014,
        Math.sin(sYaw) * 0.017,
      );
      sPiv.rotation.y = -sYaw - Math.PI / 2;
      const sMesh = new THREE.Mesh(stipuleGeo, leafMat);
      sMesh.scale.setScalar(1.85);
      sMesh.rotation.x = -0.28;
      sPiv.add(sMesh);
      this.companionBudGroup.add(sPiv);
    }

    const budPetalGeo = createSculptedPetalGeometry(
      0.088,
      0.052,
      0.24,
      1.5,
      0.002,
      0,
      0.58,
      0.38,
      0.02,
      0.75,
    );
    const budPetalMat = new THREE.MeshPhysicalMaterial({
      map: getSpeciesPetalTexture(this.spec),
      vertexColors: true,
      roughness: 0.34,
      roughnessMap: roughTex,
      sheen: 0.75,
      sheenColor: new THREE.Color(this.spec.secondaryColor),
      clearcoat: 0.16,
      normalMap: normalTex,
      normalScale: new THREE.Vector2(0.35, 0.35),
      side: THREE.DoubleSide,
    });
    applyUE5FoliageSubsurfaceShader(budPetalMat, this.spec.primaryColor, 0.15);
    this.geometriesToDispose.push(budPetalGeo);
    this.materialsToDispose.push(budPetalMat);

    for (let i = 0; i < 9; i++) {
      const rank = i / 8;
      const yaw = i * GOLDEN_ANGLE;
      const r = 0.008 + rank * 0.008;
      const p = new THREE.Group();
      p.position.set(
        Math.cos(yaw) * r,
        0.02 - rank * 0.004,
        Math.sin(yaw) * r,
      );
      const baseYaw = -yaw - Math.PI / 2;
      p.rotation.y = baseYaw;
      const m = new THREE.Mesh(budPetalGeo, budPetalMat);
      const closedPitch = 0.08 + rank * 0.18;
      const openPitch = 0.34 + rank * 0.56;
      m.rotation.x = -closedPitch;
      m.castShadow = true;
      p.add(m);
      this.companionBudGroup.add(p);
      this.companionBudPivots.push({
        pivot: p,
        mesh: m,
        normalizedRank: rank,
        closedPitch,
        openPitch,
        baseYaw,
        phaseOffset: i * 0.5,
      });
    }
    this.add(this.companionBudGroup);
  }

  private buildSpeciesCoreAndReproductiveOrgans(): void {
    const morph = this.spec.morphology;
    const envelope = computeFloralShellEnvelope(this.spec);

    if (morph === 'lotus-pod') {
      // Sculpted Obconical Spongy Lotus Receptacle (莲蓬) with high-contrast olive-gold PBR shading
      const podPoints = [
        new THREE.Vector2(0.012, 0.002),
        new THREE.Vector2(0.024, 0.018),
        new THREE.Vector2(0.036, 0.038),
        new THREE.Vector2(envelope.coreMaxRadius, 0.056),
        new THREE.Vector2(envelope.coreMaxRadius * 0.94, 0.06),
        new THREE.Vector2(0.0, 0.058),
      ];
      const podGeo = new THREE.LatheGeometry(podPoints, 44);
      const podMat = new THREE.MeshPhysicalMaterial({
        color: '#a38b2c',
        roughness: 0.52,
        clearcoat: 0.14,
        sheen: 0.4,
        sheenColor: new THREE.Color('#e9d8a6'),
      });
      const podMesh = new THREE.Mesh(podGeo, podMat);
      podMesh.castShadow = true;
      podMesh.receiveShadow = true;
      this.flowerHeadGroup.add(podMesh);
      this.geometriesToDispose.push(podGeo);
      this.materialsToDispose.push(podMat);

      // Deep dark-amber alveolar socket rings so each lotus seed hole is sharply defined
      const socketRingGeo = new THREE.TorusGeometry(0.0056, 0.0014, 10, 24);
      socketRingGeo.rotateX(Math.PI / 2);
      const socketMat = new THREE.MeshStandardMaterial({
        color: '#4a370d',
        roughness: 0.72,
      });

      const seedGeo = new THREE.SphereGeometry(0.0046, 16, 16);
      seedGeo.scale(1, 1.35, 1);
      const seedMat = new THREE.MeshPhysicalMaterial({
        color: '#4f772d',
        roughness: 0.26,
        clearcoat: 0.55,
      });

      const tipGeo = new THREE.CylinderGeometry(0.0008, 0.0014, 0.0045, 8);
      tipGeo.translate(0, 0.0062, 0);
      const tipMat = new THREE.MeshStandardMaterial({
        color: '#d9ed92',
        roughness: 0.35,
      });

      this.geometriesToDispose.push(socketRingGeo, seedGeo, tipGeo);
      this.materialsToDispose.push(socketMat, seedMat, tipMat);

      const seedCoords = [
        [0, 0],
        ...Array.from({length: 5}, (_, i) => [
          Math.cos((i * Math.PI * 2) / 5) * 0.015,
          Math.sin((i * Math.PI * 2) / 5) * 0.015,
        ]),
        ...Array.from({length: 10}, (_, i) => [
          Math.cos((i * Math.PI * 2) / 10 + 0.3) * 0.031,
          Math.sin((i * Math.PI * 2) / 10 + 0.3) * 0.031,
        ]),
      ];
      for (const [sx, sz] of seedCoords) {
        const socket = new THREE.Mesh(socketRingGeo, socketMat);
        socket.position.set(sx, 0.0592, sz);
        const sMesh = new THREE.Mesh(seedGeo, seedMat);
        sMesh.position.set(sx, 0.0596, sz);
        sMesh.castShadow = true;
        const tMesh = new THREE.Mesh(tipGeo, tipMat);
        tMesh.position.set(sx, 0.0596, sz);
        this.flowerHeadGroup.add(socket, sMesh, tMesh);
      }
    } else if (morph === 'sunflower-capitulum') {
      const discGeo = new THREE.CylinderGeometry(
        envelope.coreMaxRadius,
        envelope.coreMaxRadius * 0.82,
        0.036,
        48,
      );
      const discMat = new THREE.MeshStandardMaterial({
        color: '#281305',
        roughness: 0.72,
      });
      const discMesh = new THREE.Mesh(discGeo, discMat);
      discMesh.position.y = 0.022;
      discMesh.receiveShadow = true;
      this.flowerHeadGroup.add(discMesh);
      this.geometriesToDispose.push(discGeo);
      this.materialsToDispose.push(discMat);

      const outerFloretCount = 135;
      const innerBudCount = 135;
      const totalFlorets = outerFloretCount + innerBudCount;

      const openFloretGeo = new THREE.CylinderGeometry(
        0.0045,
        0.0022,
        0.015,
        6,
      );
      const openFloretMat = new THREE.MeshPhysicalMaterial({
        color: '#d97706',
        roughness: 0.44,
      });
      const budFloretGeo = new THREE.SphereGeometry(0.0044, 8, 8);
      budFloretGeo.scale(1, 1.4, 1);
      const budFloretMat = new THREE.MeshPhysicalMaterial({
        color: '#4a2208',
        roughness: 0.48,
        clearcoat: 0.2,
      });

      const openInst = new THREE.InstancedMesh(
        openFloretGeo,
        openFloretMat,
        outerFloretCount,
      );
      const budInst = new THREE.InstancedMesh(
        budFloretGeo,
        budFloretMat,
        innerBudCount,
      );
      const dummy = new THREE.Object3D();
      let openIdx = 0;
      let budIdx = 0;

      for (let i = 0; i < totalFlorets; i++) {
        const norm = i / totalFlorets;
        const r = Math.sqrt(norm) * (envelope.coreMaxRadius - 0.005);
        const theta = i * GOLDEN_ANGLE;
        const domeY =
          0.04 + (1 - Math.pow(r / envelope.coreMaxRadius, 2)) * 0.022;
        dummy.position.set(Math.cos(theta) * r, domeY, Math.sin(theta) * r);
        dummy.rotation.set(
          Math.sin(theta) * norm * 0.28,
          0,
          -Math.cos(theta) * norm * 0.28,
        );
        dummy.scale.setScalar(0.82 + norm * 0.32);
        dummy.updateMatrix();
        if (i < innerBudCount) {
          budInst.setMatrixAt(budIdx++, dummy.matrix);
        } else {
          openInst.setMatrixAt(openIdx++, dummy.matrix);
        }
      }
      openInst.instanceMatrix.needsUpdate = true;
      budInst.instanceMatrix.needsUpdate = true;
      this.flowerHeadGroup.add(openInst, budInst);
      this.geometriesToDispose.push(openFloretGeo, budFloretGeo);
      this.materialsToDispose.push(openFloretMat, budFloretMat);
      return;
    } else if (morph === 'orchid-zygomorphic') {
      const colGeo = new THREE.CapsuleGeometry(0.013, 0.032, 10, 20);
      const colMat = new THREE.MeshPhysicalMaterial({
        color: '#f8dce8',
        roughness: 0.24,
        clearcoat: 0.55,
        sheen: 0.5,
      });
      const colMesh = new THREE.Mesh(colGeo, colMat);
      colMesh.position.set(0, 0.046, 0.008);
      colMesh.rotation.x = 0.42;

      const antherCapGeo = new THREE.SphereGeometry(0.0105, 14, 14);
      antherCapGeo.scale(1.05, 0.85, 1.15);
      const antherCapMat = new THREE.MeshPhysicalMaterial({
        color: '#e09f3e',
        roughness: 0.26,
        clearcoat: 0.7,
      });
      const capMesh = new THREE.Mesh(antherCapGeo, antherCapMat);
      capMesh.position.set(0, 0.06, 0.016);

      this.flowerHeadGroup.add(colMesh, capMesh);
      this.geometriesToDispose.push(colGeo, antherCapGeo);
      this.materialsToDispose.push(colMat, antherCapMat);
      return;
    }

    const isLily = morph === 'lily-recurved';
    const stamenCount = isLily ? 6 : 68;
    const filLen = isLily ? 0.165 : morph === 'lotus-pod' ? 0.042 : 0.058;

    // Arched S-curve filament geometry
    const filCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, filLen * 0.36, -0.0025),
      new THREE.Vector3(0, filLen * 0.74, 0.0035),
      new THREE.Vector3(0, filLen, 0.007),
    ]);
    const filamentGeo = new THREE.TubeGeometry(
      filCurve,
      14,
      isLily ? 0.0025 : 0.00135,
      8,
      false,
    );

    // True Bilobed 2-Thecae Anther Geometry (双药室带纵沟花药)
    const antherGeo = createBilobedAntherGeometry(
      isLily ? 0.0044 : 0.0022,
      isLily ? 0.02 : 0.0055,
      isLily,
      filLen,
      0.007,
    );

    // High-contrast, non-overexposed PBR materials for filaments & pollen anthers
    const filamentMat = new THREE.MeshPhysicalMaterial({
      color: isLily ? '#7cb518' : '#b45309',
      roughness: 0.36,
      metalness: 0.02,
      clearcoat: 0.35,
    });
    const antherMat = new THREE.MeshPhysicalMaterial({
      color: isLily ? '#8c2f27' : '#d97706',
      roughness: 0.54,
      metalness: 0.02,
      sheen: 0.65,
      sheenColor: new THREE.Color('#f59e0b'),
    });
    this.geometriesToDispose.push(filamentGeo, antherGeo);
    this.materialsToDispose.push(filamentMat, antherMat);

    if (isLily) {
      const styleCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0.01, 0),
        new THREE.Vector3(0, 0.1, 0.005),
        new THREE.Vector3(0, 0.195, 0.015),
      ]);
      const styleGeo = new THREE.TubeGeometry(styleCurve, 20, 0.0036, 10, false);
      const styleMesh = new THREE.Mesh(styleGeo, filamentMat);
      this.flowerHeadGroup.add(styleMesh);
      this.geometriesToDispose.push(styleGeo);

      const stigmaMat = new THREE.MeshPhysicalMaterial({
        color: '#6a1b29',
        roughness: 0.24,
        clearcoat: 0.85,
      });
      this.materialsToDispose.push(stigmaMat);

      for (let k = 0; k < 3; k++) {
        const ang = (k / 3) * Math.PI * 2;
        const lobeGeo = new THREE.CapsuleGeometry(0.0052, 0.0075, 6, 10);
        const lobe = new THREE.Mesh(lobeGeo, stigmaMat);
        lobe.position.set(
          Math.cos(ang) * 0.006,
          0.198,
          0.015 + Math.sin(ang) * 0.006,
        );
        lobe.rotation.z = Math.cos(ang) * 0.6;
        lobe.rotation.x = Math.sin(ang) * 0.6;
        this.flowerHeadGroup.add(lobe);
        this.geometriesToDispose.push(lobeGeo);
      }
    } else if (morph !== 'lotus-pod') {
      // Sculpted 5-Carpel Gynoecium (五心皮离生雌蕊群与深红柱头冠，与金黄雄蕊形成鲜明对比)
      const carpelMat = new THREE.MeshPhysicalMaterial({
        color: '#588157',
        roughness: 0.38,
        clearcoat: 0.35,
      });
      const stigmaCrestMat = new THREE.MeshPhysicalMaterial({
        color: '#800f2f',
        roughness: 0.22,
        clearcoat: 0.85,
      });
      this.materialsToDispose.push(carpelMat, stigmaCrestMat);

      const singleCarpelGeo = new THREE.ConeGeometry(0.0062, 0.042, 10);
      singleCarpelGeo.translate(0, 0.028, 0);
      const singleStigmaGeo = new THREE.SphereGeometry(0.0036, 10, 10);
      singleStigmaGeo.scale(1.2, 0.7, 1.4);
      singleStigmaGeo.translate(0, 0.049, 0.0015);
      this.geometriesToDispose.push(singleCarpelGeo, singleStigmaGeo);

      for (let c = 0; c < 5; c++) {
        const cAng = (c / 5) * Math.PI * 2;
        const cGroup = new THREE.Group();
        cGroup.position.set(
          Math.cos(cAng) * 0.0058,
          0.004,
          Math.sin(cAng) * 0.0058,
        );
        cGroup.rotation.y = -cAng - Math.PI / 2;
        cGroup.rotation.x = -0.14;
        const cMesh = new THREE.Mesh(singleCarpelGeo, carpelMat);
        const stMesh = new THREE.Mesh(singleStigmaGeo, stigmaCrestMat);
        cMesh.castShadow = true;
        cGroup.add(cMesh, stMesh);
        this.flowerHeadGroup.add(cGroup);
      }
    }

    // Place stamens strictly inside [stamenMinRadius, stamenMaxRadius] (< petalMinRadius!)
    for (let i = 0; i < stamenCount; i++) {
      const t = i / Math.max(1, stamenCount - 1);
      const yaw = isLily ? (i / 6) * Math.PI * 2 + Math.PI / 6 : i * GOLDEN_ANGLE;
      const radius =
        envelope.stamenMinRadius +
        (envelope.stamenMaxRadius - envelope.stamenMinRadius) * t;

      const pivot = new THREE.Group();
      pivot.position.set(
        Math.cos(yaw) * radius,
        morph === 'lotus-pod' ? 0.016 : 0.022 - t * 0.003,
        Math.sin(yaw) * radius,
      );
      pivot.rotation.y = -yaw - Math.PI / 2;

      const fMesh = new THREE.Mesh(filamentGeo, filamentMat);
      const aMesh = new THREE.Mesh(antherGeo, antherMat);
      fMesh.castShadow = true;
      aMesh.castShadow = true;
      pivot.add(fMesh, aMesh);
      this.flowerHeadGroup.add(pivot);

      const closedPitch =
        envelope.stamenClosedPitchRange[0] +
        (envelope.stamenClosedPitchRange[1] -
          envelope.stamenClosedPitchRange[0]) *
          t;
      const openPitch =
        envelope.stamenOpenPitchRange[0] +
        (envelope.stamenOpenPitchRange[1] - envelope.stamenOpenPitchRange[0]) *
          t;

      this.stamenPivots.push({
        pivot,
        closedPitch,
        openPitch,
        phaseOffset: i * 0.37,
      });
    }
  }

  private buildSepalsAndMorphologyCorolla(): void {
    const normalTex = getBotanicalNormalTexture();
    const roughTex = getBotanicalRoughnessTexture();
    const albedoTex = getSpeciesPetalTexture(this.spec);
    const morph = this.spec.morphology;
    const envelope = computeFloralShellEnvelope(this.spec);

    const sepalCount = morph === 'sunflower-capitulum' ? 24 : 6;
    const sepalGeo = createSculptedPetalGeometry(
      0.13,
      0.056,
      0.16,
      1.0,
      0.002,
      0,
      0.5,
      0.38,
      0.18,
      0.2,
    );
    const sepalMat = new THREE.MeshPhysicalMaterial({
      color: '#2d6a4f',
      vertexColors: true,
      roughness: 0.4,
      roughnessMap: roughTex,
      metalness: 0.02,
      clearcoat: 0.28,
      sheen: 0.4,
      sheenColor: new THREE.Color('#95d5b2'),
      normalMap: normalTex,
      normalScale: new THREE.Vector2(0.38, 0.38),
      side: THREE.DoubleSide,
    });
    applyUE5FoliageSubsurfaceShader(sepalMat, '#52b788', 0.14);
    this.geometriesToDispose.push(sepalGeo);
    this.materialsToDispose.push(sepalMat);

    for (let i = 0; i < sepalCount; i++) {
      const yaw = (i / sepalCount) * Math.PI * 2 + (i % 2) * 0.06;
      const rad = envelope.sepalRadius + (i % 2) * 0.003;
      const pivot = new THREE.Group();
      pivot.position.set(
        Math.cos(yaw) * rad,
        envelope.sepalY - (i % 2) * 0.002,
        Math.sin(yaw) * rad,
      );
      const baseYaw = -yaw - Math.PI / 2;
      pivot.rotation.y = baseYaw;

      const mesh = new THREE.Mesh(sepalGeo, sepalMat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      pivot.add(mesh);
      this.flowerHeadGroup.add(pivot);

      this.petalPivots.push({
        pivot,
        mesh,
        normalizedRank: -1,
        closedPitch: envelope.sepalClosedPitch + (i % 2) * 0.04,
        openPitch: envelope.sepalOpenPitch + (i % 2) * 0.05,
        baseYaw,
        phaseOffset: i * 0.7,
      });
    }

    const isBioluminescent = morph === 'waterlily-stellate';
    const petalMaterial = new THREE.MeshPhysicalMaterial({
      map: albedoTex,
      vertexColors: true,
      roughness: 0.38,
      roughnessMap: roughTex,
      metalness: 0.01,
      transmission: 0.03,
      thickness: 0.08,
      ior: 1.38,
      sheen: 0.78,
      sheenRoughness: 0.32,
      sheenColor: new THREE.Color(this.spec.secondaryColor),
      clearcoat: 0.14,
      clearcoatRoughness: 0.36,
      normalMap: normalTex,
      normalScale: new THREE.Vector2(0.32, 0.32),
      emissive: new THREE.Color(
        isBioluminescent ? this.spec.primaryColor : this.spec.throatColor,
      ),
      emissiveIntensity: isBioluminescent ? 0.22 : 0.01,
      side: THREE.DoubleSide,
    });
    applyUE5FoliageSubsurfaceShader(
      petalMaterial,
      isBioluminescent ? '#80ffdb' : this.spec.primaryColor,
      isBioluminescent ? 0.28 : 0.14,
    );
    this.materialsToDispose.push(petalMaterial);

    if (morph === 'orchid-zygomorphic') {
      this.buildOrchidCorolla(petalMaterial, normalTex, roughTex);
      return;
    }

    if (morph === 'iris-bearded') {
      this.buildIrisCorolla(petalMaterial);
      return;
    }

    if (morph === 'lily-recurved') {
      this.buildLilyWhorls(petalMaterial);
      return;
    }

    const totalPetals =
      this.spec.outerPetals +
      this.spec.midOuterPetals +
      this.spec.midPetals +
      this.spec.innerPetals +
      this.spec.centerPetals;

    const widthBias =
      morph === 'waterlily-stellate' || morph === 'sunflower-capitulum'
        ? 0.48
        : morph === 'peony-ruffled' || morph === 'camellia-fibonacci'
          ? 0.68
          : 0.62;
    const tipRoundness =
      morph === 'peony-ruffled' || morph === 'camellia-fibonacci'
        ? 0.94
        : morph === 'lotus-pod'
          ? 0.62
          : morph === 'sunflower-capitulum'
            ? 0.38
            : 0.18;
    const recurve = morph === 'peony-ruffled' ? 0.2 : 0.16;

    const tierSamples = [0.12, 0.24, 0.38, 0.52, 0.66, 0.78, 0.9, 1.0];
    const tierGeometries = tierSamples.map((tierT) => {
      const lenScale =
        0.58 + 0.46 * Math.sin(Math.pow(tierT, 0.68) * (Math.PI / 2));
      const widScale = 0.72 + 0.34 * tierT;
      const aoFactor = 0.58 - tierT * 0.18;
      const geo = createSculptedPetalGeometry(
        this.spec.petalLength * lenScale,
        this.spec.petalWidth * widScale,
        this.spec.cupDepth * (0.95 - tierT * 0.25),
        this.spec.ruffleFrequency,
        this.spec.ruffleAmplitude * (0.65 + 0.35 * tierT),
        this.spec.tipNotchDepth,
        widthBias,
        aoFactor,
        recurve * tierT,
        tipRoundness,
      );
      this.geometriesToDispose.push(geo);
      return geo;
    });

    const minR = envelope.petalMinRadius;
    const maxR = envelope.petalMaxRadius;

    for (let i = 0; i < totalPetals; i++) {
      const rank01 = i / Math.max(1, totalPetals - 1);
      const yaw = i * GOLDEN_ANGLE;
      const r = minR + (maxR - minR) * Math.pow(rank01, 0.88);
      const yOffset =
        envelope.petalTopY -
        (envelope.petalTopY - envelope.petalBottomY) * rank01;

      const tierIdx = Math.min(
        tierGeometries.length - 1,
        Math.floor(rank01 * tierGeometries.length),
      );
      const geo = tierGeometries[tierIdx];

      const pivot = new THREE.Group();
      pivot.position.set(Math.cos(yaw) * r, yOffset, Math.sin(yaw) * r);
      const baseYaw = -yaw - Math.PI / 2;
      pivot.rotation.y = baseYaw;

      const mesh = new THREE.Mesh(geo, petalMaterial);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      pivot.add(mesh);
      this.flowerHeadGroup.add(pivot);

      const closedPitch =
        envelope.petalClosedPitchRange[0] +
        (envelope.petalClosedPitchRange[1] -
          envelope.petalClosedPitchRange[0]) *
          rank01;
      const openPitch =
        envelope.petalOpenPitchRange[0] +
        (envelope.petalOpenPitchRange[1] - envelope.petalOpenPitchRange[0]) *
          Math.pow(rank01, 0.72);

      this.petalPivots.push({
        pivot,
        mesh,
        normalizedRank: rank01,
        closedPitch,
        openPitch,
        baseYaw,
        phaseOffset: i * 0.43,
      });
    }
  }

  private buildLilyWhorls(petalMaterial: THREE.MeshPhysicalMaterial): void {
    const geoInner = createSculptedPetalGeometry(
      this.spec.petalLength * 0.96,
      this.spec.petalWidth * 1.12,
      0.16,
      this.spec.ruffleFrequency,
      this.spec.ruffleAmplitude,
      0,
      0.54,
      0.42,
      0.22,
      0.45,
    );
    const geoOuter = createSculptedPetalGeometry(
      this.spec.petalLength * 1.04,
      this.spec.petalWidth * 0.98,
      0.14,
      this.spec.ruffleFrequency,
      this.spec.ruffleAmplitude * 0.8,
      0,
      0.52,
      0.36,
      0.24,
      0.42,
    );
    this.geometriesToDispose.push(geoInner, geoOuter);

    for (let ring = 0; ring < 2; ring++) {
      const count = 3;
      const isOuter = ring === 1;
      for (let i = 0; i < count; i++) {
        const yaw = (i / count) * Math.PI * 2 + ring * (Math.PI / 3);
        const r = isOuter ? 0.044 : 0.032;
        const y = isOuter ? 0.018 : 0.028;
        const pivot = new THREE.Group();
        pivot.position.set(Math.cos(yaw) * r, y, Math.sin(yaw) * r);
        const baseYaw = -yaw - Math.PI / 2;
        pivot.rotation.y = baseYaw;

        const mesh = new THREE.Mesh(
          isOuter ? geoOuter : geoInner,
          petalMaterial,
        );
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        pivot.add(mesh);
        this.flowerHeadGroup.add(pivot);

        this.petalPivots.push({
          pivot,
          mesh,
          normalizedRank: isOuter ? 0.88 : 0.38,
          closedPitch: isOuter ? 0.3 : 0.16,
          openPitch: this.spec.maxOpenAngleRad * (isOuter ? 1.02 : 0.86),
          baseYaw,
          phaseOffset: i * 0.7 + ring,
        });
      }
    }
  }

  private buildOrchidCorolla(
    petalMaterial: THREE.MeshPhysicalMaterial,
    normalTex: THREE.CanvasTexture,
    roughTex: THREE.CanvasTexture,
  ): void {
    const sepalGeo = createSculptedPetalGeometry(
      0.25,
      0.13,
      0.14,
      1.5,
      0.004,
      0,
      0.62,
      0.36,
      0.14,
      0.72,
    );
    const wingGeo = createSculptedPetalGeometry(
      0.27,
      0.22,
      0.18,
      2.5,
      0.007,
      0.02,
      0.7,
      0.32,
      0.12,
      0.92,
    );
    const lipGeo = createSculptedPetalGeometry(
      0.195,
      0.15,
      0.26,
      3.5,
      0.008,
      0.12,
      0.72,
      0.28,
      0.1,
      0.85,
    );
    const lipMat = new THREE.MeshPhysicalMaterial({
      color: '#e61972',
      vertexColors: true,
      roughness: 0.28,
      roughnessMap: roughTex,
      sheen: 0.9,
      sheenColor: new THREE.Color('#ffd166'),
      clearcoat: 0.3,
      normalMap: normalTex,
      normalScale: new THREE.Vector2(0.45, 0.45),
      side: THREE.DoubleSide,
    });
    applyUE5FoliageSubsurfaceShader(lipMat, '#ff9e00', 0.16);

    const callusGeo = new THREE.CapsuleGeometry(0.0055, 0.018, 6, 12);
    const callusMat = new THREE.MeshPhysicalMaterial({
      color: '#d97706',
      roughness: 0.32,
    });

    this.geometriesToDispose.push(sepalGeo, wingGeo, lipGeo, callusGeo);
    this.materialsToDispose.push(lipMat, callusMat);

    const sepalAngles = [Math.PI * 0.5, Math.PI * 1.2, Math.PI * 1.8];
    sepalAngles.forEach((yaw, i) => {
      const pivot = new THREE.Group();
      pivot.position.set(Math.cos(yaw) * 0.042, 0.014, Math.sin(yaw) * 0.042);
      const baseYaw = -yaw - Math.PI / 2;
      pivot.rotation.y = baseYaw;
      const mesh = new THREE.Mesh(sepalGeo, petalMaterial);
      mesh.castShadow = true;
      pivot.add(mesh);
      this.flowerHeadGroup.add(pivot);
      this.petalPivots.push({
        pivot,
        mesh,
        normalizedRank: 0.9,
        closedPitch: 0.34,
        openPitch: 1.54,
        baseYaw,
        phaseOffset: i,
      });
    });

    const wingAngles = [0.1, Math.PI - 0.1];
    wingAngles.forEach((yaw, i) => {
      const pivot = new THREE.Group();
      pivot.position.set(Math.cos(yaw) * 0.032, 0.024, Math.sin(yaw) * 0.032);
      const baseYaw = -yaw - Math.PI / 2;
      pivot.rotation.y = baseYaw;
      const mesh = new THREE.Mesh(wingGeo, petalMaterial);
      mesh.castShadow = true;
      pivot.add(mesh);
      this.flowerHeadGroup.add(pivot);
      this.petalPivots.push({
        pivot,
        mesh,
        normalizedRank: 0.55,
        closedPitch: 0.22,
        openPitch: 1.34,
        baseYaw,
        phaseOffset: i + 2,
      });
    });

    const lipPivot = new THREE.Group();
    lipPivot.position.set(0, 0.02, 0.034);
    const lipBaseYaw = 0;
    lipPivot.rotation.y = lipBaseYaw;
    const lipMesh = new THREE.Mesh(lipGeo, lipMat);
    lipMesh.castShadow = true;

    const {position: cPos, normal: cNorm} = samplePetalSurfacePointAndNormal(
      lipGeo,
      0,
      0.24,
    );
    for (const side of [-1, 1]) {
      const callus = new THREE.Mesh(callusGeo, callusMat);
      callus.position
        .copy(cPos)
        .addScaledVector(cNorm, 0.0055)
        .add(new THREE.Vector3(side * 0.008, 0, 0));
      lipMesh.add(callus);
    }

    lipPivot.add(lipMesh);
    this.flowerHeadGroup.add(lipPivot);
    this.petalPivots.push({
      pivot: lipPivot,
      mesh: lipMesh,
      normalizedRank: 0.28,
      closedPitch: 0.16,
      openPitch: 1.24,
      baseYaw: lipBaseYaw,
      phaseOffset: 4,
    });
  }

  private buildIrisCorolla(petalMaterial: THREE.MeshPhysicalMaterial): void {
    const fallGeo = createSculptedPetalGeometry(
      0.27,
      0.165,
      0.22,
      4.5,
      0.008,
      0.03,
      0.68,
      0.38,
      0.24,
      0.88,
    );
    const standardGeo = createSculptedPetalGeometry(
      0.245,
      0.155,
      0.24,
      4.0,
      0.007,
      0.025,
      0.66,
      0.36,
      -0.06,
      0.88,
    );
    const styleArmGeo = createSculptedPetalGeometry(
      0.135,
      0.048,
      0.2,
      1.0,
      0.002,
      0.06,
      0.55,
      0.32,
      0.18,
      0.65,
    );

    const beardTuftGeo = new THREE.ConeGeometry(0.0038, 0.011, 7);
    beardTuftGeo.rotateX(Math.PI / 2);
    const beardMat = new THREE.MeshStandardMaterial({
      color: '#d97706',
      roughness: 0.48,
    });
    this.geometriesToDispose.push(
      fallGeo,
      standardGeo,
      styleArmGeo,
      beardTuftGeo,
    );
    this.materialsToDispose.push(beardMat);

    for (let i = 0; i < 3; i++) {
      const yaw = (i / 3) * Math.PI * 2;
      const pivot = new THREE.Group();
      pivot.position.set(Math.cos(yaw) * 0.046, 0.016, Math.sin(yaw) * 0.046);
      const baseYaw = -yaw - Math.PI / 2;
      pivot.rotation.y = baseYaw;

      const mesh = new THREE.Mesh(fallGeo, petalMaterial);
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      for (let tIdx = 0; tIdx < 18; tIdx++) {
        const vNorm = 0.1 + (tIdx / 17) * 0.34;
        const uNorm = ((tIdx % 3) - 1) * 0.045;
        const {position, normal} = samplePetalSurfacePointAndNormal(
          fallGeo,
          uNorm,
          vNorm,
        );
        const tuft = new THREE.Mesh(beardTuftGeo, beardMat);
        tuft.position.copy(position).addScaledVector(normal, 0.0035);
        mesh.add(tuft);
      }

      pivot.add(mesh);
      this.flowerHeadGroup.add(pivot);

      this.petalPivots.push({
        pivot,
        mesh,
        normalizedRank: 0.88,
        closedPitch: 0.34,
        openPitch: 1.56,
        baseYaw,
        phaseOffset: i,
      });

      const stylePivot = new THREE.Group();
      stylePivot.position.set(
        Math.cos(yaw) * 0.026,
        0.032,
        Math.sin(yaw) * 0.026,
      );
      stylePivot.rotation.y = baseYaw;
      const styleMesh = new THREE.Mesh(styleArmGeo, petalMaterial);
      stylePivot.add(styleMesh);
      this.flowerHeadGroup.add(stylePivot);
      this.petalPivots.push({
        pivot: stylePivot,
        mesh: styleMesh,
        normalizedRank: 0.52,
        closedPitch: 0.22,
        openPitch: 1.02,
        baseYaw,
        phaseOffset: i + 6,
      });
    }

    for (let i = 0; i < 3; i++) {
      const yaw = (i / 3) * Math.PI * 2 + Math.PI / 3;
      const pivot = new THREE.Group();
      pivot.position.set(Math.cos(yaw) * 0.034, 0.028, Math.sin(yaw) * 0.034);
      const baseYaw = -yaw - Math.PI / 2;
      pivot.rotation.y = baseYaw;

      const mesh = new THREE.Mesh(standardGeo, petalMaterial);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      pivot.add(mesh);
      this.flowerHeadGroup.add(pivot);

      this.petalPivots.push({
        pivot,
        mesh,
        normalizedRank: 0.25,
        closedPitch: 0.14,
        openPitch: 0.68,
        baseYaw,
        phaseOffset: i + 3,
      });
    }
  }

  private buildCrystalDewdrops(): void {
    const dropRadius = 0.0052;
    const dropGeo = new THREE.SphereGeometry(dropRadius, 16, 16);
    dropGeo.scale(1, 0.72, 1);
    const dropMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.015,
      metalness: 0.0,
      transmission: 0.96,
      ior: 1.333,
      thickness: 0.025,
      clearcoat: 1.0,
      clearcoatRoughness: 0.02,
    });
    this.geometriesToDispose.push(dropGeo);
    this.materialsToDispose.push(dropMat);

    const outerPetals = this.petalPivots.filter((p) => p.normalizedRank >= 0.55);
    for (let i = 0; i < Math.min(10, outerPetals.length); i += 2) {
      const targetPetal = outerPetals[i];
      const uNorm = (i % 4 === 0 ? 1 : -1) * 0.28;
      const vNorm = 0.48 + (i % 3) * 0.12;
      const {position, normal} = samplePetalSurfacePointAndNormal(
        targetPetal.mesh.geometry,
        uNorm,
        vNorm,
      );

      const drop = new THREE.Mesh(dropGeo, dropMat);
      drop.position.copy(position).addScaledVector(normal, dropRadius * 0.62);
      targetPetal.mesh.add(drop);
    }
  }

  setBloom(bloom01: number, elapsedSec: number): void {
    this.currentBloom01 = clamp(bloom01, 0, 1);
    const b = this.currentBloom01;

    // Keep the flowerHeadGroup organically locked to the stem apex at (0, 0.045, 0)
    // with only a subtle natural breeze micro-sway so the flower head, stem, leaves,
    // and companion bud ALWAYS rotate together as one unified botanical specimen!
    this.flowerHeadGroup.position.set(0, 0.045, 0);
    this.flowerHeadGroup.rotation.x = 0.16 + Math.cos(elapsedSec * 0.85) * 0.006;
    this.flowerHeadGroup.rotation.z = Math.sin(elapsedSec * 0.9) * 0.006;

    this.coreGlowLight.intensity = 0.04 + Math.pow(b, 1.2) * 0.08;

    // 1. Main Corolla Petals & Calyx Sepals: Multi-stage bud-to-full-anthesis kinematics
    for (const item of this.petalPivots) {
      const basePitch = evaluateOrganPitchAtBloom(
        item.closedPitch,
        item.openPitch,
        item.normalizedRank,
        b,
      );
      const flutter =
        Math.sin(elapsedSec * 2.0 + item.phaseOffset) *
        0.006 *
        (0.2 + 0.8 * b);

      item.mesh.rotation.x = -(basePitch + flutter);

      // In tight bud state (b -> 0), enhance inward cupping and imbricate spiral wrap
      if (item.normalizedRank >= 0) {
        const budCupScaleZ = 1.24 - 0.24 * b;
        const budWidthScaleX = 0.88 + 0.12 * b;
        item.mesh.scale.set(budWidthScaleX, 1.0, budCupScaleZ);
      }

      const spiralTwist =
        item.normalizedRank >= 0 ? (1 - b) * 0.22 * item.normalizedRank : 0;
      item.pivot.rotation.y = item.baseYaw + spiralTwist;
    }

    // 2. Companion Side Bud Petals: Synchronously opens from tight side bud into graceful side blossom
    for (const budItem of this.companionBudPivots) {
      const budPitch = evaluateOrganPitchAtBloom(
        budItem.closedPitch,
        budItem.openPitch,
        budItem.normalizedRank,
        b * 0.85,
      );
      const flutter =
        Math.sin(elapsedSec * 2.1 + budItem.phaseOffset) * 0.005 * (0.2 + 0.8 * b);
      budItem.mesh.rotation.x = -(budPitch + flutter);
      const twist = (1 - b) * 0.18 * budItem.normalizedRank;
      budItem.pivot.rotation.y = budItem.baseYaw + twist;
    }

    // 3. Stamens: Fan outward as corolla opens
    for (const st of this.stamenPivots) {
      const baseStamenPitch = evaluateStamenPitchAtBloom(
        st.closedPitch,
        st.openPitch,
        b,
      );
      const sway =
        Math.sin(elapsedSec * 2.4 + st.phaseOffset) * 0.014 * b;
      st.pivot.rotation.x = -(baseStamenPitch + sway);
    }
  }

  getBloom(): number {
    return this.currentBloom01;
  }

  dispose(): void {
    for (const geo of this.geometriesToDispose) geo.dispose();
    for (const mat of this.materialsToDispose) mat.dispose();
  }
}

export function createFlowerById(id: string): ProceduralFlowerModel {
  const spec =
    FLOWER_LIBRARY.find((f) => f.id === id) || FLOWER_LIBRARY[0];
  return new ProceduralFlowerModel(spec);
}

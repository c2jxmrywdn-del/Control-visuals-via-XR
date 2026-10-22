import * as THREE from 'three';
import {
  FLOWER_LIBRARY,
  type FlowerSpec,
  type GaussianSplatMode,
  type BloomForceFieldState,
  type ForceFieldParticleState,
  clamp,
  computeFloralShellEnvelope,
  evaluateOrganPitchAtBloom,
  evaluateStamenPitchAtBloom,
  computeBloomForceFieldDamping,
  stepForceFieldDampedParticle,
  evaluateDetailedBloomKinematics,
} from './gestureMath';

interface PetalPivotData {
  pivot: THREE.Group;
  mesh: THREE.Mesh;
  normalizedRank: number; // 0 = innermost heart, 1 = outermost guard petal, -1 = calyx sepal
  closedPitch: number;
  openPitch: number;
  baseYaw: number;
  baseRoll: number;
  naturalScaleX: number;
  naturalScaleY: number;
  phaseOffset: number;
}

interface StamenPivotData {
  pivot: THREE.Group;
  closedPitch: number;
  openPitch: number;
  baseRoll: number;
  phaseOffset: number;
  normalizedRank?: number;
}

interface LeafPivotData {
  bladePivot: THREE.Group;
  leafMesh: THREE.Mesh;
  basePitch: number;
  baseRoll: number;
  phaseOffset: number;
}

interface DewdropItemData {
  mesh: THREE.Mesh;
  targetGeometry: THREE.BufferGeometry;
  uNorm: number;
  baseVNorm: number;
  dropRadius: number;
}

interface PollenMoteData {
  mesh: THREE.Mesh;
  state: ForceFieldParticleState;
  baseRadius: number;
  baseY: number;
  baseScale: number;
  speed: number;
  phase: number;
}

interface AnimatedShaderUniforms {
  uTime: {value: number};
  uBloom: {value: number};
  uTipUncurl: {value: number};
  uKineticContainment: {value: number};
}

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5)); // ~2.3999632 rad (137.508 deg)
const IS_HEADLESS =
  typeof navigator !== 'undefined' &&
  (navigator.webdriver || /HeadlessChrome/i.test(navigator.userAgent));
const textureCache = new Map<string, THREE.CanvasTexture>();

/**
 * Deterministic pseudo-random helper in [-1, 1] for organic per-petal and per-splat variation
 */
function organicNoise(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453123;
  return (x - Math.floor(x)) * 2 - 1;
}

/**
 * Samples the exact botanical pigment RGB and Spherical Harmonics (SH1/SH2) view-dependent
 * subsurface tint at normalized petal coordinates (uNorm in [-1,1], vNorm in [0,1]).
 */
function sampleSpeciesPetalPigment(
  spec: FlowerSpec,
  uNorm: number,
  vNorm: number,
  normalizedRank: number,
): {sh0: [number, number, number]; sh1: [number, number, number]} {
  const cThroat = new THREE.Color(spec.throatColor);
  const cPrimary = new THREE.Color(spec.primaryColor);
  const cSecondary = new THREE.Color(spec.secondaryColor);
  const cCore = new THREE.Color(spec.coreColor);

  const v = clamp(vNorm, 0, 1);
  const absU = clamp(Math.abs(uNorm), 0, 1);

  const out = new THREE.Color();
  if (spec.morphology === 'lotus-pod') {
    if (v < 0.22) {
      out.lerpColors(
        new THREE.Color('#d4b86a'),
        new THREE.Color('#f6cddb'),
        v / 0.22,
      );
    } else if (v < 0.64) {
      out.lerpColors(
        new THREE.Color('#f6cddb'),
        new THREE.Color('#df4d82'),
        (v - 0.22) / 0.42,
      );
    } else {
      out.lerpColors(
        new THREE.Color('#df4d82'),
        new THREE.Color('#ad144b'),
        (v - 0.64) / 0.36,
      );
    }
  } else if (spec.morphology === 'peony-ruffled') {
    if (v < 0.28) {
      out.lerpColors(
        new THREE.Color('#59081f'),
        new THREE.Color('#b51247'),
        v / 0.28,
      );
    } else if (v < 0.74) {
      out.lerpColors(
        new THREE.Color('#b51247'),
        new THREE.Color('#e84a78'),
        (v - 0.28) / 0.46,
      );
    } else {
      out.lerpColors(
        new THREE.Color('#e84a78'),
        new THREE.Color('#f9b4c9'),
        (v - 0.74) / 0.26,
      );
    }
  } else if (spec.morphology === 'orchid-zygomorphic') {
    if (v < 0.24) {
      out.lerpColors(
        new THREE.Color('#d946ef'),
        new THREE.Color('#f3e8ff'),
        v / 0.24,
      );
    } else if (v < 0.72) {
      out.lerpColors(
        new THREE.Color('#f3e8ff'),
        new THREE.Color('#c084fc'),
        (v - 0.24) / 0.48,
      );
    } else {
      out.lerpColors(
        new THREE.Color('#c084fc'),
        new THREE.Color('#9333ea'),
        (v - 0.72) / 0.28,
      );
    }
  } else if (spec.morphology === 'lily-recurved') {
    if (v < 0.18) {
      out.lerpColors(
        new THREE.Color('#7fa332'),
        new THREE.Color('#ba1448'),
        v / 0.18,
      );
    } else {
      out.lerpColors(
        new THREE.Color('#ba1448'),
        new THREE.Color('#f7cad8'),
        Math.pow((v - 0.18) / 0.82, 1.35),
      );
    }
    if (absU > 0.68) {
      out.lerp(new THREE.Color('#fae3eb'), (absU - 0.68) / 0.32);
    }
  } else if (spec.morphology === 'sunflower-capitulum') {
    if (v < 0.22) {
      out.lerpColors(
        new THREE.Color('#b45309'),
        new THREE.Color('#f59e0b'),
        v / 0.22,
      );
    } else if (v < 0.75) {
      out.lerpColors(
        new THREE.Color('#f59e0b'),
        new THREE.Color('#fbbf24'),
        (v - 0.22) / 0.53,
      );
    } else {
      out.lerpColors(
        new THREE.Color('#fbbf24'),
        new THREE.Color('#fde047'),
        (v - 0.75) / 0.25,
      );
    }
  } else if (spec.morphology === 'iris-bearded') {
    if (v < 0.28) {
      out.lerpColors(
        new THREE.Color('#fef08a'),
        new THREE.Color('#818cf8'),
        v / 0.28,
      );
    } else if (v < 0.72) {
      out.lerpColors(
        new THREE.Color('#818cf8'),
        new THREE.Color('#4361ee'),
        (v - 0.28) / 0.44,
      );
    } else {
      out.lerpColors(
        new THREE.Color('#4361ee'),
        new THREE.Color('#1e1b4b'),
        (v - 0.72) / 0.28,
      );
    }
  } else if (spec.morphology === 'camellia-fibonacci') {
    if (v < 0.3) {
      out.lerpColors(
        new THREE.Color('#be3455'),
        new THREE.Color('#ec7a95'),
        v / 0.3,
      );
    } else if (v < 0.76) {
      out.lerpColors(
        new THREE.Color('#ec7a95'),
        new THREE.Color('#f6b8c8'),
        (v - 0.3) / 0.46,
      );
    } else {
      out.lerpColors(
        new THREE.Color('#f6b8c8'),
        new THREE.Color('#fce8ee'),
        (v - 0.76) / 0.24,
      );
    }
  } else if (spec.morphology === 'waterlily-stellate') {
    if (v < 0.22) {
      out.lerpColors(
        new THREE.Color('#f59e0b'),
        new THREE.Color('#7dd3fc'),
        v / 0.22,
      );
    } else if (v < 0.68) {
      out.lerpColors(
        new THREE.Color('#7dd3fc'),
        new THREE.Color('#0284c7'),
        (v - 0.22) / 0.46,
      );
    } else {
      out.lerpColors(
        new THREE.Color('#0284c7'),
        new THREE.Color('#1e3a8a'),
        (v - 0.68) / 0.32,
      );
    }
  } else {
    if (v < 0.38) {
      out.lerpColors(cThroat, cPrimary, v / 0.38);
    } else {
      out.lerpColors(cPrimary, cSecondary, (v - 0.38) / 0.62);
    }
  }

  // Subtle vascular vein modulation across uNorm so 3DGS splats also carry vein striation detail
  const veinPattern = 0.92 + 0.08 * Math.cos((absU * 18.0 - v * 5.0) * Math.PI);
  const cavityDepth =
    0.66 +
    0.34 * Math.pow(v, 0.58) * (0.72 + 0.28 * Math.max(0, normalizedRank));
  out.multiplyScalar(cavityDepth * veinPattern);

  const sh1Color = cPrimary.clone().lerp(cCore, 0.28);
  return {
    sh0: [clamp(out.r, 0, 1), clamp(out.g, 0, 1), clamp(out.b, 0, 1)],
    sh1: [
      clamp(sh1Color.r * 0.34, 0, 1),
      clamp(sh1Color.g * 0.34, 0, 1),
      clamp(sh1Color.b * 0.34, 0, 1),
    ],
  };
}

/**
 * Injects a Continuous 3D Gaussian Splatting (3DGS) Spherical Harmonics + Silk-Velvet
 * Subsurface Translucency + Living GPU Wind Wave shader into MeshPhysicalMaterial:
 * 1. Vertex Shader: Applies a continuous travelling breeze wave & tip curl weighted by
 *    `color.b` (longitudinal distance from petal claw `0` to tip `1`). Because displacement is
 *    strictly 0 at `color.b == 0`, the petal/leaf base stays 100% watertight in its receptacle/petiole
 *    socket while the upper blade and ruffled edges undulate like a living flower!
 * 2. Fragment Shader:
 *    - Preserves crisp directional light-to-shadow contrast and vascular vein normal relief
 *      (gently compressing highlight hotspots so petals NEVER blow out or lose detail!).
 *    - Deepens inner-chalice cavity shading (`vColor.r`) with warm saturated botanical pigment
 *      so overlapping petal tiers have clear 3D separation.
 *    - Evaluates Continuous Anisotropic 3D Gaussian Splatting Spherical Harmonics (SH Degree 2)
 *      and grazing subsurface scatter without washing out midtones.
 */
function applyUE5FoliageSubsurfaceShader(
  material: THREE.MeshPhysicalMaterial,
  subsurfaceColorHex: string,
  sssStrength = 0.24,
  uniformRegistry?: AnimatedShaderUniforms[],
  windAmplitude = 0.0105,
): void {
  const sssColor = new THREE.Color(subsurfaceColorHex);
  const sharedUniforms: AnimatedShaderUniforms = {
    uTime: {value: 0},
    uBloom: {value: 0.78},
    uTipUncurl: {value: 0.56},
    uKineticContainment: {value: 1.0},
  };
  if (uniformRegistry) {
    uniformRegistry.push(sharedUniforms);
  }

  material.customProgramCacheKey = () =>
    `ue5_3dgs_velvet_sss_v16_${subsurfaceColorHex}_${sssStrength.toFixed(2)}_${windAmplitude.toFixed(4)}`;

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uSubsurfaceColor = {value: sssColor};
    shader.uniforms.uSubsurfaceStrength = {value: sssStrength};
    shader.uniforms.uTime = sharedUniforms.uTime;
    shader.uniforms.uBloom = sharedUniforms.uBloom;
    shader.uniforms.uTipUncurl = sharedUniforms.uTipUncurl;
    shader.uniforms.uKineticContainment = sharedUniforms.uKineticContainment;
    shader.uniforms.uWindAmp = {value: windAmplitude};

    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `#include <common>
      uniform float uTime;
      uniform float uBloom;
      uniform float uTipUncurl;
      uniform float uKineticContainment;
      uniform float uWindAmp;`,
    );

    // Living GPU vertex undulation + Multi-stage petal tip uncurling & marginal ruffle awakening:
    // Flexes petal blade & ruffled margins while keeping base (color.b == 0) 100% locked in receptacle socket!
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      #if defined( USE_COLOR )
        float vTipDist = clamp( color.b, 0.0, 1.0 );
        float flexWeight = vTipDist * vTipDist * ( 0.38 + 0.62 * uBloom ) * uKineticContainment;
        float worldPhase = position.x * 22.0 + position.y * 14.0 + position.z * 18.0;
        float primaryWave = sin( uTime * 2.25 + worldPhase + vTipDist * 4.2 );
        float secondaryRipple = cos( uTime * 3.6 - position.x * 32.0 + vTipDist * 6.8 ) * 0.48;
        float marginWeight = clamp( abs( position.x ) * 11.0, 0.3, 1.0 );

        // Progressive tip uncurl as bloom increases:
        // At b=0 (closed bud), tips stay naturally cupped; as b->1 (full bloom), tips gently unroll outward (-z)
        float tipZone = smoothstep( 0.48, 1.0, vTipDist );
        float uncurlArchZ = -tipZone * tipZone * uTipUncurl * 0.014;
        // Progressive marginal ruffle awakening as petals spread open
        float marginalAwakeningZ = sin( position.x * 42.0 + vTipDist * 5.5 ) * ( 0.0024 * uBloom ) * marginWeight * tipZone;

        transformed.z += ( primaryWave + secondaryRipple ) * uWindAmp * flexWeight * marginWeight + uncurlArchZ + marginalAwakeningZ;
        transformed.x += sin( uTime * 1.85 + worldPhase * 0.75 ) * ( uWindAmp * 0.36 ) * flexWeight;
      #endif`,
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>
      uniform vec3 uSubsurfaceColor;
      uniform float uSubsurfaceStrength;
      uniform float uBloom;`,
    );

    // Rich inner-chalice pigment depth (gives unmistakable 3D separation between petal tiers without mud)
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `#if defined( USE_COLOR_ALPHA ) || defined( USE_COLOR )
        float cavityAO = clamp( vColor.r, 0.42, 1.0 );
        vec3 deepChaliceTint = mix( uSubsurfaceColor * 0.48 + diffuseColor.rgb * 0.26, vec3( 1.0 ), cavityAO );
        diffuseColor.rgb *= deepChaliceTint;
      #endif`,
    );

    // Continuous 3DGS Spherical Harmonics (SH Degree 2) + Highlight-Protected Subsurface Velvet
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <lights_fragment_end>',
      `#include <lights_fragment_end>
      #if defined( USE_COLOR )
        float ue5Translucency = clamp( vColor.g, 0.15, 0.95 );
        float ue5TipProgress = clamp( vColor.b, 0.0, 1.0 );
        vec3 ue5ViewDir = normalize( vViewPosition );
        float ndotv = clamp( abs( dot( normal, ue5ViewDir ) ), 0.0, 1.0 );

        // 1. Softly compress intense direct highlights so fine vascular veins & normal relief NEVER wash out
        reflectedLight.directDiffuse = reflectedLight.directDiffuse / ( vec3( 1.0 ) + reflectedLight.directDiffuse * 0.36 );

        // 2. Lift only the deepest unlit shadow crevices with rich, saturated subsurface pigment (no flat wash!)
        float directLum = dot( reflectedLight.directDiffuse, vec3( 0.299, 0.587, 0.114 ) );
        float shadowMask = clamp( 1.0 - directLum * 1.65, 0.0, 1.0 );
        vec3 shadowSubsurfaceWarmth = diffuseColor.rgb * uSubsurfaceColor * ( 0.22 * shadowMask * ue5Translucency );

        // 3. 3D Gaussian Splatting Spherical Harmonics (SH Degree 1 & 2) grazing translucency
        float shY1 = 0.4886 * ( ue5ViewDir.y * 0.45 + ue5ViewDir.z * 0.35 - ue5ViewDir.x * 0.25 );
        float shY2 = 0.3154 * ( 3.0 * ue5ViewDir.z * ue5ViewDir.z - 1.0 ) * 0.22;
        float ue5RimScatter = pow( 1.0 - ndotv, 1.85 );
        float ue5VelvetGrazing = pow( 1.0 - ndotv, 2.75 );

        vec3 sssContribution = mix( diffuseColor.rgb, uSubsurfaceColor, 0.42 ) * ue5Translucency * ( 0.18 * shadowMask + 0.42 * ue5RimScatter + 0.12 * ( shY1 + shY2 ) ) * uSubsurfaceStrength;

        // 4. Delicate silk-velvet contour rim along curved 3D petal edges
        vec3 velvetSheen = mix( diffuseColor.rgb, uSubsurfaceColor, 0.35 ) * ue5VelvetGrazing * 0.14 * ( 0.3 + 0.7 * ue5TipProgress );
        reflectedLight.indirectDiffuse += shadowSubsurfaceWarmth + sssContribution + velvetSheen;

        // 5. Suppress plastic specular hotspots while keeping subtle micro-vein normal glint
        reflectedLight.directSpecular *= 0.06;
        reflectedLight.indirectSpecular *= 0.10;
      #endif`,
    );
  };
}

/**
 * Generates a high-relief tangent-space normal map combining primary midrib,
 * branching secondary vascular venation, and microscopic epidermal papillae grain.
 */
function getBotanicalNormalTexture(): THREE.CanvasTexture {
  const size = IS_HEADLESS ? 256 : 1024;
  const key = `ue5_botanical_normal_${size}_v14`;
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

  const midGrad = hCtx.createLinearGradient(456, 0, 568, 0);
  midGrad.addColorStop(0, 'rgba(128,128,128,0)');
  midGrad.addColorStop(0.32, 'rgba(188,188,188,0.34)');
  midGrad.addColorStop(0.5, 'rgba(242,242,242,0.58)');
  midGrad.addColorStop(0.68, 'rgba(188,188,188,0.34)');
  midGrad.addColorStop(1, 'rgba(128,128,128,0)');
  hCtx.fillStyle = midGrad;
  hCtx.fillRect(456, 0, 112, 1024);

  for (let i = 0; i < 76; i++) {
    const u = i / 75;
    const spreadX = (u - 0.5) * 990;
    const waveOffset = Math.sin(i * 1.7) * 20;
    const startX = 512 + (u - 0.5) * 66;
    const cp1X = 512 + spreadX * 0.26 + waveOffset;
    const cp1Y = 740 + Math.cos(i * 1.3) * 28;
    const cp2X = 512 + spreadX * 0.74 - waveOffset * 0.7;
    const cp2Y = 320 + Math.sin(i * 2.1) * 32;
    const endX = 512 + spreadX;
    const endY = 10 + (i % 5) * 6;

    // Dark furrow alongside bright vein ridge for crisp 3D relief
    hCtx.beginPath();
    hCtx.moveTo(startX + 2.5, 1024);
    hCtx.bezierCurveTo(cp1X + 3, cp1Y, cp2X + 3, cp2Y, endX + 2.5, endY);
    hCtx.strokeStyle = 'rgba(72,72,72,0.28)';
    hCtx.lineWidth = i % 2 === 0 ? 3.2 : 1.8;
    hCtx.stroke();

    hCtx.beginPath();
    hCtx.moveTo(startX, 1024);
    hCtx.bezierCurveTo(cp1X, cp1Y, cp2X, cp2Y, endX, endY);
    hCtx.strokeStyle =
      i % 2 === 0 ? 'rgba(235,235,235,0.36)' : 'rgba(205,205,205,0.24)';
    hCtx.lineWidth = i % 2 === 0 ? 3.0 : 1.6;
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
  const strength = 1.18;

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

      const cellGrainX =
        Math.sin(x * 0.65 + y * 0.25) * Math.cos(y * 0.58) * 0.036;
      const cellGrainY =
        Math.cos(x * 0.52 - y * 0.62) * Math.sin(x * 0.48) * 0.036;

      const dx = (hL - hR) * strength + cellGrainX;
      const dy = (hU - hD) * strength + cellGrainY;
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

/**
 * Generates a high-roughness velvety epidermal map (PBR roughness 0.72..0.88)
 * so flower petals scatter light like natural silk/velvet instead of shiny plastic.
 */
function getBotanicalRoughnessTexture(): THREE.CanvasTexture {
  const size = IS_HEADLESS ? 256 : 512;
  const key = `ue5_botanical_roughness_${size}_v14`;
  if (textureCache.has(key)) return textureCache.get(key)!;

  const scale = size / 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.save();
  ctx.scale(scale, scale);

  const grad = ctx.createLinearGradient(0, 512, 0, 0);
  grad.addColorStop(0.0, '#b0b0b0');
  grad.addColorStop(0.3, '#c8c8c8');
  grad.addColorStop(0.75, '#dedede');
  grad.addColorStop(1.0, '#d2d2d2');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 44; i++) {
    const u = i / 43;
    const spreadX = (u - 0.5) * 490;
    ctx.beginPath();
    ctx.moveTo(256 + (u - 0.5) * 36, 512);
    ctx.quadraticCurveTo(256 + spreadX * 0.5, 256, 256 + spreadX, 8);
    ctx.strokeStyle = 'rgba(165,165,165,0.22)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  textureCache.set(key, tex);
  return tex;
}

/**
 * Synthesizes a richly detailed botanical albedo texture with natural pigment depth,
 * clearly visible primary + secondary branching vascular venation (脉络细节),
 * delicate petal-tip blushing, and zero whitewash overexposure.
 */
function getSpeciesPetalTexture(spec: FlowerSpec): THREE.CanvasTexture {
  const size = IS_HEADLESS ? 256 : 1024;
  const key = `ue5_albedo_${size}_v15_${spec.id}`;
  if (textureCache.has(key)) return textureCache.get(key)!;

  const scale = size / 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    ctx.save();
    ctx.scale(scale, scale);
    const vSize = 1024;
    const grad = ctx.createLinearGradient(0, vSize, 0, 0);
    if (spec.morphology === 'lotus-pod') {
      grad.addColorStop(0.0, '#c8a654');
      grad.addColorStop(0.14, '#f2cad8');
      grad.addColorStop(0.44, '#ee9ab9');
      grad.addColorStop(0.74, '#de4b82');
      grad.addColorStop(0.92, '#c2185b');
      grad.addColorStop(1.0, '#8c0d3f');
    } else if (spec.morphology === 'lily-recurved') {
      grad.addColorStop(0.0, '#789e2e');
      grad.addColorStop(0.16, '#bd154b');
      grad.addColorStop(0.62, '#d83164');
      grad.addColorStop(0.86, '#f294b0');
      grad.addColorStop(1.0, '#fae1e9');
    } else if (spec.morphology === 'peony-ruffled') {
      grad.addColorStop(0.0, '#4f061b');
      grad.addColorStop(0.24, '#980f38');
      grad.addColorStop(0.56, '#d12358');
      grad.addColorStop(0.82, '#ee6b92');
      grad.addColorStop(1.0, '#f8bfd0');
    } else if (spec.morphology === 'orchid-zygomorphic') {
      // Royal Phalaenopsis: warm rose-gold claw -> luminous pearl-lavender -> rich amethyst-orchid margin
      grad.addColorStop(0.0, '#be185d');
      grad.addColorStop(0.18, '#f5d0fe');
      grad.addColorStop(0.52, '#e9d5ff');
      grad.addColorStop(0.82, '#c084fc');
      grad.addColorStop(1.0, '#9333ea');
    } else if (spec.morphology === 'sunflower-capitulum') {
      grad.addColorStop(0.0, '#9a3412');
      grad.addColorStop(0.18, '#d97706');
      grad.addColorStop(0.52, '#f59e0b');
      grad.addColorStop(0.84, '#fbbf24');
      grad.addColorStop(1.0, '#fde047');
    } else if (spec.morphology === 'iris-bearded') {
      // Sapphire Bearded Iris: luminous white-gold signal throat -> vivid cobalt-sapphire -> deep royal indigo tip
      grad.addColorStop(0.0, '#fef08a');
      grad.addColorStop(0.18, '#e0e7ff');
      grad.addColorStop(0.46, '#6366f1');
      grad.addColorStop(0.78, '#3b82f6');
      grad.addColorStop(0.92, '#2563eb');
      grad.addColorStop(1.0, '#1e1b4b');
    } else if (spec.morphology === 'camellia-fibonacci') {
      grad.addColorStop(0.0, '#9e2a47');
      grad.addColorStop(0.36, '#d45d79');
      grad.addColorStop(0.74, '#ea9ab0');
      grad.addColorStop(1.0, '#f7d1dc');
    } else if (spec.morphology === 'waterlily-stellate') {
      // Celestial Blue Star Waterlily: glowing golden-amber nectar base -> sky-aqua -> cerulean -> deep cobalt-indigo tip
      grad.addColorStop(0.0, '#f59e0b');
      grad.addColorStop(0.14, '#fef08a');
      grad.addColorStop(0.32, '#bae6fd');
      grad.addColorStop(0.64, '#0284c7');
      grad.addColorStop(0.88, '#1d4ed8');
      grad.addColorStop(1.0, '#172554');
    } else {
      const darkThroat = new THREE.Color(spec.throatColor).multiplyScalar(0.78);
      const midPrimary = new THREE.Color(spec.primaryColor).multiplyScalar(0.86);
      const tipSecondary = new THREE.Color(spec.secondaryColor).multiplyScalar(0.9);
      grad.addColorStop(0.0, `#${darkThroat.getHexString()}`);
      grad.addColorStop(0.38, `#${midPrimary.getHexString()}`);
      grad.addColorStop(0.82, `#${tipSecondary.getHexString()}`);
      grad.addColorStop(1.0, `#${midPrimary.getHexString()}`);
    }

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, vSize, vSize);

    // Species-matched tip & upper-margin blush (NEVER puts red on blue/yellow species!)
    const tipRimGrad = ctx.createRadialGradient(512, 30, 20, 512, 160, 480);
    tipRimGrad.addColorStop(
      0,
      spec.morphology === 'lotus-pod'
        ? 'rgba(156, 14, 68, 0.42)'
        : spec.morphology === 'peony-ruffled'
          ? 'rgba(128, 12, 48, 0.28)'
          : spec.morphology === 'iris-bearded'
            ? 'rgba(30, 27, 75, 0.38)'
            : spec.morphology === 'waterlily-stellate'
              ? 'rgba(23, 37, 84, 0.42)'
              : spec.morphology === 'sunflower-capitulum'
                ? 'rgba(234, 88, 12, 0.22)'
                : spec.morphology === 'orchid-zygomorphic'
                  ? 'rgba(126, 34, 206, 0.32)'
                  : 'rgba(140, 20, 65, 0.22)',
    );
    tipRimGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = tipRimGrad;
    ctx.fillRect(0, 0, vSize, vSize);

    // Species-matched central midrib structural shading
    const midribColor =
      spec.morphology === 'iris-bearded'
        ? 'rgba(30, 27, 75, 0.16)'
        : spec.morphology === 'waterlily-stellate'
          ? 'rgba(12, 74, 110, 0.16)'
          : spec.morphology === 'sunflower-capitulum'
            ? 'rgba(180, 83, 9, 0.18)'
            : spec.morphology === 'orchid-zygomorphic'
              ? 'rgba(107, 33, 168, 0.14)'
              : 'rgba(120, 18, 54, 0.12)';
    const midribShade = ctx.createLinearGradient(452, 0, 572, 0);
    midribShade.addColorStop(0, 'rgba(0,0,0,0)');
    midribShade.addColorStop(0.35, midribColor);
    midribShade.addColorStop(0.5, 'rgba(255, 250, 245, 0.18)');
    midribShade.addColorStop(0.65, midribColor);
    midribShade.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = midribShade;
    ctx.fillRect(452, 0, 120, vSize);

    // Species-matched basal claw shading for crisp whorl depth
    const clawShade = ctx.createRadialGradient(512, 1010, 15, 512, 920, 340);
    clawShade.addColorStop(
      0,
      spec.morphology === 'lotus-pod' || spec.morphology === 'waterlily-stellate'
        ? 'rgba(180, 130, 24, 0.42)'
        : spec.morphology === 'iris-bearded'
          ? 'rgba(217, 119, 6, 0.36)'
          : spec.morphology === 'sunflower-capitulum'
            ? 'rgba(146, 64, 14, 0.45)'
            : 'rgba(92, 10, 34, 0.36)',
    );
    clawShade.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = clawShade;
    ctx.fillRect(0, 0, vSize, vSize);

    if (spec.morphology === 'lily-recurved') {
      const edgeLeft = ctx.createLinearGradient(0, 0, 195, 0);
      edgeLeft.addColorStop(0, '#fae6ed');
      edgeLeft.addColorStop(1, 'rgba(250,230,237,0)');
      ctx.fillStyle = edgeLeft;
      ctx.fillRect(0, 0, 195, vSize);

      const edgeRight = ctx.createLinearGradient(vSize, 0, vSize - 195, 0);
      edgeRight.addColorStop(0, '#fae6ed');
      edgeRight.addColorStop(1, 'rgba(250,230,237,0)');
      ctx.fillStyle = edgeRight;
      ctx.fillRect(vSize - 195, 0, 195, vSize);

      const furrow = ctx.createLinearGradient(468, 400, 556, 400);
      furrow.addColorStop(0, 'rgba(125,162,42,0)');
      furrow.addColorStop(0.5, 'rgba(125,162,42,0.82)');
      furrow.addColorStop(1, 'rgba(125,162,42,0)');
      ctx.fillStyle = furrow;
      ctx.fillRect(468, 340, 88, 684);

      for (let s = 0; s < 54; s++) {
        const uSpot = ((s * 37) % 100) / 100;
        const vSpot = 0.2 + ((s * 53) % 62) / 100;
        const sx = 190 + uSpot * 644;
        const sy = vSpot * vSize;
        const sr = 3.6 + (s % 4) * 1.9;
        ctx.fillStyle = 'rgba(145, 16, 52, 0.34)';
        ctx.beginPath();
        ctx.arc(sx, sy, sr * 1.85, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(92, 6, 32, 0.82)';
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (spec.morphology === 'orchid-zygomorphic') {
      // Authentic Phalaenopsis basal nectar guide speckles (蝴蝶兰基部豹纹斑点)
      for (let s = 0; s < 38; s++) {
        const uSpot = 0.24 + ((s * 41) % 52) / 100;
        const vSpot = 0.62 + ((s * 29) % 34) / 100;
        const sx = uSpot * vSize;
        const sy = vSpot * vSize;
        const sr = 2.8 + (s % 3) * 1.6;
        ctx.fillStyle = 'rgba(131, 24, 67, 0.58)';
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (spec.morphology === 'iris-bearded') {
      // White-and-gold signal patch & deep indigo nectar guide striations at the claw/haft
      const signalPatch = ctx.createRadialGradient(512, 820, 18, 512, 780, 260);
      signalPatch.addColorStop(0, 'rgba(254, 249, 195, 0.88)');
      signalPatch.addColorStop(0.55, 'rgba(224, 231, 255, 0.52)');
      signalPatch.addColorStop(1, 'rgba(99, 102, 241, 0)');
      ctx.fillStyle = signalPatch;
      ctx.fillRect(180, 480, 664, 544);
    } else if (spec.morphology === 'sunflower-capitulum') {
      // Prominent longitudinal parallel ray-floret ribs (向日葵舌状花纵向主肋脉)
      for (const ribU of [-0.28, -0.14, 0, 0.14, 0.28]) {
        const rx = 512 + ribU * 760;
        const ribGrad = ctx.createLinearGradient(rx - 18, 0, rx + 18, 0);
        ribGrad.addColorStop(0, 'rgba(180, 83, 9, 0)');
        ribGrad.addColorStop(0.5, 'rgba(180, 83, 9, 0.28)');
        ribGrad.addColorStop(1, 'rgba(180, 83, 9, 0)');
        ctx.fillStyle = ribGrad;
        ctx.fillRect(rx - 18, 20, 36, 980);
      }
    }

    // High-definition species-matched primary + secondary anastomosing vascular venation
    const primaryVeinColor =
      spec.morphology === 'waterlily-stellate'
        ? 'rgba(14, 116, 144, 0.44)'
        : spec.morphology === 'iris-bearded'
          ? 'rgba(30, 27, 75, 0.46)'
          : spec.morphology === 'orchid-zygomorphic'
            ? 'rgba(126, 34, 206, 0.36)'
            : spec.morphology === 'lotus-pod'
              ? 'rgba(162, 16, 72, 0.42)'
              : spec.morphology === 'peony-ruffled'
                ? 'rgba(108, 8, 38, 0.38)'
                : spec.morphology === 'sunflower-capitulum'
                  ? 'rgba(180, 83, 9, 0.42)'
                  : 'rgba(156, 32, 68, 0.32)';

    const fineVeinColor =
      spec.morphology === 'waterlily-stellate'
        ? 'rgba(56, 189, 248, 0.30)'
        : spec.morphology === 'iris-bearded'
          ? 'rgba(67, 56, 202, 0.32)'
          : spec.morphology === 'orchid-zygomorphic'
            ? 'rgba(168, 85, 247, 0.26)'
            : spec.morphology === 'sunflower-capitulum'
              ? 'rgba(217, 119, 6, 0.28)'
              : spec.morphology === 'lotus-pod'
                ? 'rgba(192, 28, 88, 0.26)'
                : 'rgba(148, 24, 66, 0.22)';

    for (let i = 0; i < 68; i++) {
      const u = i / 67;
      const spreadX = (u - 0.5) * 980;
      const wave = Math.sin(i * 1.9) * 18;
      const startX = 512 + (u - 0.5) * 76;
      const cp1X = 512 + spreadX * 0.28 + wave;
      const cp1Y = 720 + Math.cos(i * 1.4) * 26;
      const cp2X = 512 + spreadX * 0.72 - wave * 0.6;
      const cp2Y = 310 + Math.sin(i * 2.1) * 28;
      const endX = 512 + spreadX;
      const endY = 10 + (i % 4) * 5;

      ctx.beginPath();
      ctx.moveTo(startX, vSize);
      ctx.bezierCurveTo(cp1X, cp1Y, cp2X, cp2Y, endX, endY);
      ctx.strokeStyle = i % 2 === 0 ? primaryVeinColor : fineVeinColor;
      ctx.lineWidth = i % 3 === 0 ? 2.6 : 1.35;
      ctx.stroke();

      // Secondary bifurcating fork veins near the upper petal blade
      if (i % 3 === 0 && Math.abs(u - 0.5) > 0.06) {
        const forkStartX = 0.35 * cp1X + 0.65 * cp2X;
        const forkStartY = 0.35 * cp1Y + 0.65 * cp2Y;
        const forkSign = u >= 0.5 ? 1 : -1;
        ctx.beginPath();
        ctx.moveTo(forkStartX, forkStartY);
        ctx.quadraticCurveTo(
          forkStartX + forkSign * 26,
          forkStartY * 0.55,
          endX + forkSign * 38,
          endY + 18,
        );
        ctx.strokeStyle = fineVeinColor;
        ctx.lineWidth = 1.1;
        ctx.stroke();
      }
    }
    ctx.restore();
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

/**
 * Dedicated botanical texture for the Orchid's trilobed Labellum (蝴蝶兰三裂唇瓣纹理):
 * Golden-amber nectar throat with crimson tiger stripes & deep magenta-ruby velvet apex.
 */
function getOrchidLipTexture(): THREE.CanvasTexture {
  const size = IS_HEADLESS ? 256 : 512;
  const key = `ue5_orchid_lip_${size}_v15`;
  if (textureCache.has(key)) return textureCache.get(key)!;

  const scale = size / 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.save();
    ctx.scale(scale, scale);
    const grad = ctx.createLinearGradient(0, 512, 0, 0);
    grad.addColorStop(0.0, '#fbbf24');
    grad.addColorStop(0.28, '#fef08a');
    grad.addColorStop(0.52, '#db2777');
    grad.addColorStop(0.82, '#be185d');
    grad.addColorStop(1.0, '#831843');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    // Crimson tiger-stripe nectar guides on the golden lip throat
    for (let i = 0; i < 24; i++) {
      const u = i / 23;
      const sx = 256 + (u - 0.5) * 90;
      const ex = 256 + (u - 0.5) * 440;
      ctx.beginPath();
      ctx.moveTo(sx, 505);
      ctx.quadraticCurveTo(256 + (u - 0.5) * 260, 340, ex, 120);
      ctx.strokeStyle = 'rgba(131, 24, 67, 0.55)';
      ctx.lineWidth = i % 2 === 0 ? 3.2 : 1.8;
      ctx.stroke();
    }

    for (let s = 0; s < 42; s++) {
      const sx = 120 + ((s * 43) % 272);
      const sy = 280 + ((s * 31) % 210);
      ctx.fillStyle = 'rgba(112, 26, 117, 0.72)';
      ctx.beginPath();
      ctx.arc(sx, sy, 3.5 + (s % 3) * 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
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
 * High-poly sculpted 3D spoon/chalice botanical petal & leaf geometry featuring:
 * - Deep 3D boat/spoon transverse cupping (`cupZ`) & lush longitudinal bowl arch (`bellyZ`)
 *   so every petal is a plump, volumetric 3D shell rather than a flat board
 * - Plump obovate shoulders & graceful asymmetric margin waves
 * - Vertex Color encoding:
 *     R = Warm Cavity AO (0.68..0.99)
 *     G = Subsurface Translucency thickness profile (0.18..0.96)
 *     B = Normalized longitudinal distance `v` (0 at base hinge -> 1 at tip) for GPU wind flex
 */
function createSculptedPetalGeometry(
  length: number,
  width: number,
  cupDepth: number,
  ruffleFreq: number,
  ruffleAmp: number,
  tipNotchDepth: number,
  widthTipBias = 0.62,
  aoDarkenFactor = 0.28,
  recurvedFactor = 0.2,
  tipRoundness = 0.72,
  serrationAmp = 0.0,
  asymmetrySeed = 0.0,
): THREE.BufferGeometry {
  const segU = IS_HEADLESS ? 20 : 44;
  const segV = IS_HEADLESS ? 24 : 52;
  const geometry = new THREE.PlaneGeometry(1, 1, segU, segV);
  const pos = geometry.attributes.position;
  const colors = new Float32Array(pos.count * 3);

  const safeCup = clamp(cupDepth, 0.06, 0.34);
  const safeRuffle = clamp(ruffleAmp, 0, 0.014);
  const safeRecurve = clamp(recurvedFactor, -0.45, 0.36);
  const asymPhase = asymmetrySeed * 1.37;
  const lateralSweep = Math.sin(asymmetrySeed * 2.1) * width * 0.036;

  for (let i = 0; i < pos.count; i++) {
    const rawX = pos.getX(i);
    const rawY = pos.getY(i);

    const u = rawX * 2; // -1 .. +1
    const v = rawY + 0.5; // 0 .. 1 (0 at base claw, 1 at petal tip)

    // Plump, full obovate/spoon petal silhouette (eliminates pointy triangular stiffness)
    const peakV = clamp(widthTipBias, 0.46, 0.76);
    let widthProfile: number;
    if (v <= peakV) {
      const t = v / peakV;
      widthProfile =
        0.16 + 0.84 * Math.sin(Math.pow(t, 0.68) * (Math.PI * 0.5));
    } else {
      const t = clamp((v - peakV) / Math.max(0.05, 1 - peakV), 0, 1);
      const acuteArch = Math.cos(t * (Math.PI * 0.5));
      const obovateDome = Math.sqrt(Math.max(0, 1 - Math.pow(t, 2.5)));
      widthProfile =
        0.06 +
        0.94 * (acuteArch * (1 - tipRoundness) + obovateDome * tipRoundness);
    }

    const frillEdge =
      tipNotchDepth > 0.004 || safeRuffle > 0.0018
        ? 1 +
          (Math.cos(u * Math.PI * 3.2 + asymPhase) * 0.65 +
            Math.sin(u * Math.PI * 5.6 - asymPhase * 0.7) * 0.35) *
            Math.max(tipNotchDepth * 0.15, safeRuffle * 5.2) *
            Math.pow(v, 1.65)
        : 1;

    const serration =
      serrationAmp > 0.0005 && v > 0.12 && v < 0.94
        ? (0.5 - 0.5 * Math.cos(v * Math.PI * 22)) *
          serrationAmp *
          Math.pow(Math.abs(u), 2)
        : 0;

    const organicCurveX = Math.sin(v * Math.PI * 0.85) * v * lateralSweep;

    const x =
      u * (width * 0.5) * widthProfile * frillEdge +
      Math.sign(u) * serration +
      organicCurveX;

    const edgeArcDrop =
      tipRoundness > 0.42
        ? Math.pow(Math.abs(u), 2.2) * length * 0.072 * Math.pow(v, 1.9)
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

    // TRUE 3D SPOON / CHALICE CURVATURE:
    // 1. Deep transverse boat cupping so left & right petal margins curve forward (+z) around the flower heart
    const transverseSpoon =
      (u * u * 0.75 + Math.pow(Math.abs(u), 3.0) * 0.25) *
      width *
      (0.24 + safeCup * 0.95) *
      Math.sin(Math.pow(v, 0.72) * Math.PI);

    // 2. Plump longitudinal S-curve arch: bows outward (-z) in the lower/mid belly to form a round 3D bowl,
    //    then sweeps upward (+z) or recurves (-z) at the tip depending on whorl rank
    const longitudinalBowl =
      -Math.sin(Math.pow(v, 0.78) * Math.PI) *
      length *
      (0.11 + safeCup * 0.48);

    const tipReflexZ =
      -Math.pow(Math.max(0, v - 0.62) / 0.38, 1.85) *
      length *
      safeRecurve *
      1.35;

    // 3. Soft curling margin lip & organic multi-harmonic wave
    const marginLipCurlZ =
      Math.pow(Math.abs(u), 2.8) *
      Math.pow(v, 1.35) *
      width *
      0.055 *
      Math.cos(u * Math.PI + asymPhase * 0.5);

    const keelZ =
      -Math.exp(-Math.abs(u) * 8.0) * 0.0038 * Math.sin(v * Math.PI);

    const microVeinRelief =
      Math.cos((Math.abs(u) * 14 - v * 6.0) * Math.PI) *
      0.00055 *
      Math.sin(v * Math.PI) *
      (1 - Math.exp(-Math.abs(u) * 5));

    const primaryWave = Math.sin(u * Math.PI * ruffleFreq + asymPhase);
    const harmonicWave =
      Math.cos(u * Math.PI * (ruffleFreq * 1.85) - asymPhase * 1.3) * 0.45;
    const ruffleZ =
      (primaryWave + harmonicWave) *
      safeRuffle *
      1.42 *
      Math.pow(v, 1.55) *
      Math.pow(Math.abs(u), 1.25);

    const z =
      transverseSpoon +
      longitudinalBowl +
      tipReflexZ +
      marginLipCurlZ +
      keelZ +
      microVeinRelief +
      ruffleZ;
    pos.setXYZ(i, x, y, z);

    const ao = clamp(1 - Math.pow(1 - v, 1.45) * aoDarkenFactor, 0.42, 0.99);
    const edgeRim = Math.pow(Math.abs(u), 2.0) * 0.05 * v;
    const rAO = clamp(ao + edgeRim, 0.42, 1.0);

    const midribThickness = Math.exp(-Math.abs(u) * 6.0) * 0.26;
    const gTranslucency = clamp(
      0.24 +
        Math.pow(v, 0.8) * 0.6 +
        Math.pow(Math.abs(u), 1.4) * 0.28 -
        midribThickness,
      0.16,
      0.98,
    );

    const bTipProgress = clamp(v, 0, 1);

    colors[i * 3] = rAO;
    colors[i * 3 + 1] = gTranslucency;
    colors[i * 3 + 2] = bTipProgress;
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Builds a true 3D Bilobed Anther Geometry (双药室纵裂花药，带药隔凹槽) with plump pollen sacs
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

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const absX = Math.abs(x) / Math.max(0.0001, lobeRadius);
    const groovePinch =
      0.52 + 0.48 * Math.sin(Math.min(1, absX) * (Math.PI / 2));
    const pollenGrainBump =
      1.0 + 0.08 * Math.sin(y * 950.0 + x * 620.0) * Math.cos(z * 780.0);
    const wideX =
      (x * 1.52 + Math.sign(x || 1) * lobeRadius * 0.24) * pollenGrainBump;
    pos.setXYZ(i, wideX, y, z * groovePinch * pollenGrainBump);
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
  private readonly pollenHaloGroup = new THREE.Group();
  private readonly petalPivots: PetalPivotData[] = [];
  private readonly companionBudPivots: PetalPivotData[] = [];
  private readonly stamenPivots: StamenPivotData[] = [];
  private readonly leafPivots: LeafPivotData[] = [];
  private readonly dewdropItems: DewdropItemData[] = [];
  private readonly pollenMotes: PollenMoteData[] = [];
  private readonly antherMaterials: THREE.MeshPhysicalMaterial[] = [];
  private readonly animatedShaderUniforms: AnimatedShaderUniforms[] = [];
  private readonly meshMaterialsForMode: THREE.MeshPhysicalMaterial[] = [];
  private readonly materialsToDispose: THREE.Material[] = [];
  private readonly geometriesToDispose: THREE.BufferGeometry[] = [];
  private mainStemCurve!: THREE.CatmullRomCurve3;
  private coreGlowLight: THREE.PointLight;
  private gaussianSplatCloudMesh: THREE.Mesh | null = null;
  private gaussianSplatMaterial: THREE.ShaderMaterial | null = null;
  private totalGaussianSplats = 0;
  private gaussianSplatMode: GaussianSplatMode = 'hybrid-3dgs';
  private currentBloom01 = 0.78;
  private lastForceFieldState: BloomForceFieldState =
    computeBloomForceFieldDamping(0.78, 0, 0, 0);
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

    // Subtle inner-chalice nectar warmth (never overexposes stamens or inner petals)
    this.coreGlowLight = new THREE.PointLight(spec.coreColor, 0.08, 0.45, 1.8);
    this.coreGlowLight.position.set(0, 0.078, 0);
    this.flowerHeadGroup.add(this.coreGlowLight);

    this.buildSeamlessStemNodesLeavesAndBase();
    this.buildSpeciesCoreAndReproductiveOrgans();
    this.buildSepalsAndMorphologyCorolla();
    this.buildCrystalDewdrops();
    this.buildFloatingPollenHalo();
    this.buildArticulated3DGaussianSplatField();
    this.setGaussianSplatMode('hybrid-3dgs');
    this.setBloom(0.78, 0);
  }

  setHeadOrientation(pitchXRad: number, rollZRad: number): void {
    this.userHeadPitchRad = pitchXRad;
    this.userHeadRollRad = rollZRad;
  }

  setGaussianSplatMode(mode: GaussianSplatMode): void {
    this.gaussianSplatMode = mode;
    if (!this.gaussianSplatCloudMesh || !this.gaussianSplatMaterial) return;

    if (mode === 'pbr-mesh') {
      this.gaussianSplatCloudMesh.visible = false;
      for (const mat of this.meshMaterialsForMode) {
        mat.transparent = false;
        mat.opacity = 1.0;
        mat.depthWrite = true;
      }
    } else if (mode === 'pure-3dgs') {
      this.gaussianSplatCloudMesh.visible = true;
      this.gaussianSplatMaterial.uniforms.uSplatScaleMultiplier.value = 0.92;
      this.gaussianSplatMaterial.uniforms.uSplatOpacityMultiplier.value = 1.18;
      this.gaussianSplatMaterial.uniforms.uPureSplatMode.value = 1.0;
      for (const mat of this.meshMaterialsForMode) {
        mat.transparent = true;
        mat.opacity = 0.32;
        mat.depthWrite = true;
      }
    } else {
      // 'hybrid-3dgs' (Default): Tightly Contained Anisotropic 3DGS Surface Radiance + Subsurface Velvet Petals (Zero Overflow!)
      this.gaussianSplatCloudMesh.visible = true;
      this.gaussianSplatMaterial.uniforms.uSplatScaleMultiplier.value = 0.68;
      this.gaussianSplatMaterial.uniforms.uSplatOpacityMultiplier.value = 0.18;
      this.gaussianSplatMaterial.uniforms.uPureSplatMode.value = 0.0;
      for (const mat of this.meshMaterialsForMode) {
        mat.transparent = false;
        mat.opacity = 1.0;
        mat.depthWrite = true;
      }
    }
  }

  getGaussianSplatMode(): GaussianSplatMode {
    return this.gaussianSplatMode;
  }

  getGaussianSplatCount(): number {
    return this.totalGaussianSplats;
  }

  private buildSeamlessStemNodesLeavesAndBase(): void {
    const normalTex = getBotanicalNormalTexture();
    const roughTex = getBotanicalRoughnessTexture();
    const envelope = computeFloralShellEnvelope(this.spec);

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
      roughness: 0.62,
      roughnessMap: roughTex,
      metalness: 0.0,
      clearcoat: 0.04,
      sheen: 0.65,
      sheenRoughness: 0.48,
      sheenColor: new THREE.Color('#95d5b2'),
    });
    const stemMesh = new THREE.Mesh(stemGeo, stemMat);
    stemMesh.castShadow = true;
    stemMesh.receiveShadow = true;
    this.add(stemMesh);
    this.geometriesToDispose.push(stemGeo);
    this.materialsToDispose.push(stemMat);

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
      roughness: 0.34,
      metalness: 0.72,
      clearcoat: 0.25,
    });
    const kenzanPodMesh = new THREE.Mesh(kenzanPodGeo, kenzanPodMat);
    kenzanPodMesh.castShadow = true;
    kenzanPodMesh.receiveShadow = true;
    this.add(kenzanPodMesh);
    this.geometriesToDispose.push(kenzanPodGeo);
    this.materialsToDispose.push(kenzanPodMat);

    const basalScaleGeo = createSculptedPetalGeometry(
      0.072,
      0.038,
      0.24,
      1.0,
      0.001,
      0,
      0.5,
      0.28,
      0.16,
      0.35,
    );
    this.geometriesToDispose.push(basalScaleGeo);

    const neckBallGeo = new THREE.SphereGeometry(0.0175, 24, 24);
    const neckBallMesh = new THREE.Mesh(neckBallGeo, stemMat);
    neckBallMesh.position.set(0, 0.045, 0);
    this.add(neckBallMesh);
    this.geometriesToDispose.push(neckBallGeo);

    const isMonocot =
      this.spec.morphology === 'iris-bearded' ||
      this.spec.morphology === 'lily-recurved' ||
      this.spec.morphology === 'orchid-zygomorphic';
    const outerRimR = isMonocot
      ? 0.032
      : Math.min(0.088, envelope.sepalRadius + 0.005);
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

    const nectaryGeo = new THREE.TorusGeometry(
      envelope.stamenMinRadius * 0.92,
      0.0032,
      12,
      32,
    );
    nectaryGeo.rotateX(Math.PI / 2);
    const nectaryMat = new THREE.MeshPhysicalMaterial({
      color: '#a7c957',
      roughness: 0.42,
      sheen: 0.7,
      sheenColor: new THREE.Color('#e9f59e'),
    });
    const nectaryMesh = new THREE.Mesh(nectaryGeo, nectaryMat);
    nectaryMesh.position.y = 0.021;
    this.flowerHeadGroup.add(nectaryMesh);
    this.geometriesToDispose.push(nectaryGeo);
    this.materialsToDispose.push(nectaryMat);

    const leafGeo = createSculptedPetalGeometry(
      0.195,
      0.094,
      0.17,
      2.6,
      0.0048,
      0.02,
      0.54,
      0.26,
      0.22,
      0.32,
      0.0035,
      1.2,
    );
    const stipuleGeo = createSculptedPetalGeometry(
      0.038,
      0.016,
      0.22,
      1.0,
      0.001,
      0,
      0.48,
      0.24,
      0.15,
      0.2,
    );
    const leafMat = new THREE.MeshPhysicalMaterial({
      color: '#387d58',
      vertexColors: true,
      roughness: 0.64,
      roughnessMap: roughTex,
      metalness: 0.0,
      clearcoat: 0.0,
      sheen: 0.78,
      sheenRoughness: 0.45,
      sheenColor: new THREE.Color('#a3e6be'),
      normalMap: normalTex,
      normalScale: new THREE.Vector2(0.48, 0.48),
      side: THREE.DoubleSide,
    });
    applyUE5FoliageSubsurfaceShader(
      leafMat,
      '#74c69d',
      0.36,
      this.animatedShaderUniforms,
      0.0075,
    );
    this.geometriesToDispose.push(leafGeo, stipuleGeo);
    this.materialsToDispose.push(leafMat);
    this.meshMaterialsForMode.push(leafMat);

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

    const nodalRingGeo = new THREE.TorusGeometry(0.0145, 0.0034, 12, 24);
    nodalRingGeo.rotateX(Math.PI / 2);

    // Note: nodeGroup.rotation.y = -cfg.yaw - Math.PI / 2 makes -Z the OUTWARD radial direction from the stem!
    const petioleCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.002, -0.011),
      new THREE.Vector3(0, 0.005, -0.027),
      new THREE.Vector3(0, 0.006, -0.042),
    ]);
    const petioleGeo = new THREE.TubeGeometry(
      petioleCurve,
      14,
      0.0036,
      10,
      false,
    );

    const midribCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0.001),
      new THREE.Vector3(0, 0.08, 0.005),
      new THREE.Vector3(0, 0.155, 0.012),
    ]);
    const midribGeo = new THREE.TubeGeometry(midribCurve, 14, 0.0022, 8, false);

    const axilBudGeo = new THREE.ConeGeometry(0.0045, 0.016, 10);
    axilBudGeo.translate(0, 0.008, 0);

    this.geometriesToDispose.push(
      nodalRingGeo,
      petioleGeo,
      midribGeo,
      axilBudGeo,
    );

    const leafNodeConfigs = [
      {tStem: 0.72, yaw: 0.45, pitch: -1.02, roll: 0.06, scale: 0.92},
      {tStem: 0.54, yaw: -2.25, pitch: -1.08, roll: -0.07, scale: 1.04},
      {tStem: 0.34, yaw: 2.15, pitch: -1.06, roll: 0.05, scale: 0.96},
      {tStem: 0.18, yaw: -0.95, pitch: -1.12, roll: -0.05, scale: 0.86},
    ];

    leafNodeConfigs.forEach((cfg, idx) => {
      const stemPoint = this.mainStemCurve.getPointAt(cfg.tStem);

      const collarMesh = new THREE.Mesh(nodalRingGeo, stemMat);
      collarMesh.position.copy(stemPoint);
      this.add(collarMesh);

      const nodeGroup = new THREE.Group();
      nodeGroup.position.copy(stemPoint);
      nodeGroup.rotation.y = -cfg.yaw - Math.PI / 2;

      const petiole = new THREE.Mesh(petioleGeo, stemMat);
      petiole.castShadow = true;
      nodeGroup.add(petiole);

      const axilBud = new THREE.Mesh(axilBudGeo, leafMat);
      axilBud.position.set(0, 0.005, -0.015);
      axilBud.rotation.x = -0.38;
      nodeGroup.add(axilBud);

      for (const side of [-1, 1]) {
        const stip = new THREE.Mesh(stipuleGeo, leafMat);
        stip.position.set(side * 0.008, 0.002, -0.014);
        stip.rotation.set(-0.48, side * -0.42, side * 0.32);
        nodeGroup.add(stip);
      }

      const bladePivot = new THREE.Group();
      bladePivot.position.set(0, 0.006, -0.041);
      bladePivot.scale.setScalar(cfg.scale);

      const leaf = new THREE.Mesh(leafGeo, leafMat);
      leaf.rotation.x = cfg.pitch;
      leaf.rotation.z = cfg.roll;
      leaf.castShadow = true;
      leaf.receiveShadow = true;

      const midrib = new THREE.Mesh(midribGeo, stemMat);
      leaf.add(midrib);

      bladePivot.add(leaf);
      nodeGroup.add(bladePivot);
      this.add(nodeGroup);

      this.leafPivots.push({
        bladePivot,
        leafMesh: leaf,
        basePitch: cfg.pitch,
        baseRoll: cfg.roll,
        phaseOffset: idx * 1.15,
      });
    });

    // 5. SEAMLESS COMPANION BUD SIDE BRANCH
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

    const forkBractPivot = new THREE.Group();
    forkBractPivot.position
      .copy(forkOrigin)
      .add(new THREE.Vector3(0.014, -0.004, 0));
    forkBractPivot.rotation.y = -Math.PI / 2;
    const forkBract = new THREE.Mesh(basalScaleGeo, leafMat);
    forkBract.rotation.x = -0.95;
    forkBractPivot.add(forkBract);
    this.add(forkBractPivot);

    const endTangent = sideBranchCurve.getTangentAt(1.0).normalize();
    this.companionBudGroup.position.copy(budTargetPos);
    this.companionBudGroup.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      endTangent,
    );

    const budReceptacleGeo = new THREE.LatheGeometry(
      [
        new THREE.Vector2(0.0058, -0.004),
        new THREE.Vector2(0.011, 0.006),
        new THREE.Vector2(0.019, 0.016),
        new THREE.Vector2(0.016, 0.024),
      ],
      24,
    );
    const budReceptacle = new THREE.Mesh(budReceptacleGeo, stemMat);
    this.companionBudGroup.add(budReceptacle);
    this.geometriesToDispose.push(budReceptacleGeo);

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
      sMesh.scale.setScalar(1.45);
      sMesh.rotation.x = -0.36;
      sPiv.add(sMesh);
      this.companionBudGroup.add(sPiv);
    }

    // Nascent Companion Flower Bud (5 non-intersecting cupped petals that never cross the center axis)
    const budPetalMat = new THREE.MeshPhysicalMaterial({
      map: getSpeciesPetalTexture(this.spec),
      vertexColors: true,
      roughness: 0.74,
      roughnessMap: roughTex,
      metalness: 0.0,
      clearcoat: 0.0,
      sheen: 0.96,
      sheenRoughness: 0.44,
      sheenColor: new THREE.Color(this.spec.secondaryColor),
      normalMap: normalTex,
      normalScale: new THREE.Vector2(0.32, 0.32),
      side: THREE.DoubleSide,
    });
    applyUE5FoliageSubsurfaceShader(
      budPetalMat,
      this.spec.secondaryColor,
      0.46,
      this.animatedShaderUniforms,
      0.005,
    );

    const budPetalGeo = createSculptedPetalGeometry(
      0.078,
      0.042,
      0.20,
      1.6,
      0.002,
      0,
      0.56,
      0.22,
      0.10,
      0.62,
      0,
      0.4,
    );
    this.geometriesToDispose.push(budPetalGeo);
    this.materialsToDispose.push(budPetalMat);
    this.meshMaterialsForMode.push(budPetalMat);

    // 2 Inner + 3 Outer non-intersecting cupped bud petals (outward pitch 0.24..0.76 rad)
    for (let i = 0; i < 5; i++) {
      const isInner = i < 2;
      const rank = isInner ? 0.25 : 0.85;
      const yaw = isInner
        ? i * Math.PI + 0.35
        : ((i - 2) / 3) * Math.PI * 2;
      const r = isInner ? 0.012 : 0.022;
      const p = new THREE.Group();
      p.position.set(
        Math.cos(yaw) * r,
        isInner ? 0.021 : 0.017,
        Math.sin(yaw) * r,
      );
      const baseYaw = -yaw - Math.PI / 2;
      const baseRoll = organicNoise(i * 3.1) * 0.03;
      p.rotation.y = baseYaw;
      const m = new THREE.Mesh(budPetalGeo, budPetalMat);
      const closedPitch = isInner ? 0.24 : 0.42;
      const openPitch = isInner ? 0.44 : 0.76;
      m.rotation.x = -closedPitch;
      m.rotation.z = baseRoll;
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
        baseRoll,
        naturalScaleX: isInner ? 0.88 : 1.0,
        naturalScaleY: isInner ? 0.92 : 1.0,
        phaseOffset: i * 0.65,
      });
    }
    this.add(this.companionBudGroup);
  }

  private buildSpeciesCoreAndReproductiveOrgans(): void {
    const morph = this.spec.morphology;
    const envelope = computeFloralShellEnvelope(this.spec);

    if (morph === 'lotus-pod') {
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
        color: '#c9a938',
        roughness: 0.68,
        metalness: 0.0,
        clearcoat: 0.0,
        sheen: 0.72,
        sheenRoughness: 0.5,
        sheenColor: new THREE.Color('#fef08a'),
      });
      const podMesh = new THREE.Mesh(podGeo, podMat);
      podMesh.castShadow = true;
      podMesh.receiveShadow = true;
      this.flowerHeadGroup.add(podMesh);
      this.geometriesToDispose.push(podGeo);
      this.materialsToDispose.push(podMat);

      const socketRingGeo = new THREE.TorusGeometry(0.0056, 0.0014, 10, 24);
      socketRingGeo.rotateX(Math.PI / 2);
      const socketMat = new THREE.MeshStandardMaterial({
        color: '#6b4f12',
        roughness: 0.78,
      });

      const seedGeo = new THREE.SphereGeometry(0.0046, 16, 16);
      seedGeo.scale(1, 1.35, 1);
      const seedMat = new THREE.MeshPhysicalMaterial({
        color: '#6a994e',
        roughness: 0.42,
        sheen: 0.6,
        sheenColor: new THREE.Color('#d9ed92'),
      });

      const tipGeo = new THREE.CylinderGeometry(0.0008, 0.0014, 0.0045, 8);
      tipGeo.translate(0, 0.0062, 0);
      const tipMat = new THREE.MeshStandardMaterial({
        color: '#fef08a',
        roughness: 0.42,
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
      // Sculpted convex paraboloid capitulum receptacle dome (no bare flat brown gaps)
      const discProfile = [
        new THREE.Vector2(0.0, 0.056),
        new THREE.Vector2(envelope.coreMaxRadius * 0.45, 0.052),
        new THREE.Vector2(envelope.coreMaxRadius * 0.82, 0.043),
        new THREE.Vector2(envelope.coreMaxRadius * 1.02, 0.032),
        new THREE.Vector2(envelope.coreMaxRadius * 0.92, 0.014),
        new THREE.Vector2(0.015, 0.008),
      ];
      const discGeo = new THREE.LatheGeometry(discProfile, 48);
      const discMat = new THREE.MeshStandardMaterial({
        color: '#3b1c08',
        roughness: 0.78,
      });
      const discMesh = new THREE.Mesh(discGeo, discMat);
      discMesh.receiveShadow = true;
      this.flowerHeadGroup.add(discMesh);
      this.geometriesToDispose.push(discGeo);
      this.materialsToDispose.push(discMat);

      const outerFloretCount = 220;
      const innerBudCount = 200;
      const totalFlorets = outerFloretCount + innerBudCount;

      const openFloretGeo = new THREE.CylinderGeometry(
        0.0046,
        0.0022,
        0.016,
        7,
      );
      const openFloretMat = new THREE.MeshPhysicalMaterial({
        color: '#d97706',
        roughness: 0.48,
        sheen: 0.65,
        sheenColor: new THREE.Color('#fde047'),
      });
      const budFloretGeo = new THREE.SphereGeometry(0.0045, 8, 8);
      budFloretGeo.scale(1, 1.38, 1);
      const budFloretMat = new THREE.MeshPhysicalMaterial({
        color: '#5c2808',
        roughness: 0.52,
        sheen: 0.45,
        sheenColor: new THREE.Color('#d97706'),
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
        const norm = (i + 0.5) / totalFlorets;
        const r = Math.sqrt(norm) * (envelope.coreMaxRadius - 0.002);
        const theta = i * GOLDEN_ANGLE;
        const domeY =
          0.032 + (1 - Math.pow(r / envelope.coreMaxRadius, 1.85)) * 0.025;
        dummy.position.set(Math.cos(theta) * r, domeY, Math.sin(theta) * r);
        dummy.rotation.set(
          Math.sin(theta) * norm * 0.34,
          -theta,
          -Math.cos(theta) * norm * 0.34,
        );
        dummy.scale.setScalar(0.86 + norm * 0.34);
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
      // Sculpted arcuate Gynostemium (合蕊柱) + Rostellum + Golden Pollinia Anther Cap
      const colCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0.018, -0.004),
        new THREE.Vector3(0, 0.038, 0.006),
        new THREE.Vector3(0, 0.056, 0.022),
      ]);
      const colGeo = new THREE.TubeGeometry(colCurve, 18, 0.0115, 16, false);
      const colMat = new THREE.MeshPhysicalMaterial({
        color: '#fae8ff',
        roughness: 0.44,
        sheen: 0.78,
        sheenColor: new THREE.Color('#ffffff'),
      });
      const colMesh = new THREE.Mesh(colGeo, colMat);

      const antherCapGeo = new THREE.SphereGeometry(0.011, 16, 16);
      antherCapGeo.scale(1.05, 0.85, 1.2);
      const antherCapMat = new THREE.MeshPhysicalMaterial({
        color: '#f59e0b',
        roughness: 0.38,
        sheen: 0.68,
        sheenColor: new THREE.Color('#fef08a'),
      });
      const capMesh = new THREE.Mesh(antherCapGeo, antherCapMat);
      capMesh.position.set(0, 0.057, 0.025);

      this.flowerHeadGroup.add(colMesh, capMesh);
      this.geometriesToDispose.push(colGeo, antherCapGeo);
      this.materialsToDispose.push(colMat, antherCapMat);
      return;
    } else if (morph === 'iris-bearded') {
      // Iris germanica: central trigonal ovary/nectary column + 3 sub-style stamens tucked beneath the 3 style arms
      const styleColGeo = new THREE.CylinderGeometry(0.0052, 0.0085, 0.036, 12);
      styleColGeo.translate(0, 0.022, 0);
      const styleColMat = new THREE.MeshPhysicalMaterial({
        color: '#e0e7ff',
        roughness: 0.46,
        sheen: 0.72,
        sheenColor: new THREE.Color('#fef08a'),
      });
      const styleColMesh = new THREE.Mesh(styleColGeo, styleColMat);
      this.flowerHeadGroup.add(styleColMesh);

      const irisFilCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0.032, 0.006),
        new THREE.Vector3(0, 0.062, 0.022),
      ]);
      const irisFilGeo = new THREE.TubeGeometry(irisFilCurve, 12, 0.0018, 8, false);
      const irisAntherGeo = createBilobedAntherGeometry(0.0028, 0.014, false, 0.062, 0.022);
      const irisStamenMat = new THREE.MeshPhysicalMaterial({
        color: '#fef08a',
        roughness: 0.48,
        sheen: 0.75,
        sheenColor: new THREE.Color('#ffffff'),
      });
      this.geometriesToDispose.push(styleColGeo, irisFilGeo, irisAntherGeo);
      this.materialsToDispose.push(styleColMat, irisStamenMat);

      for (let i = 0; i < 3; i++) {
        const yaw = (i / 3) * Math.PI * 2;
        const pivot = new THREE.Group();
        pivot.position.set(Math.cos(yaw) * 0.022, 0.024, Math.sin(yaw) * 0.022);
        pivot.rotation.y = -yaw - Math.PI / 2;
        const fMesh = new THREE.Mesh(irisFilGeo, irisStamenMat);
        const aMesh = new THREE.Mesh(irisAntherGeo, irisStamenMat);
        pivot.add(fMesh, aMesh);
        this.flowerHeadGroup.add(pivot);
        this.stamenPivots.push({
          pivot,
          closedPitch: 0.18,
          openPitch: 0.82,
          baseRoll: 0,
          phaseOffset: i * 0.8,
        });
      }
      return;
    } else if (morph === 'waterlily-stellate') {
      // Nymphaea caerulea: Golden Solar Stigmatic Disc (柱头盘) + 52 golden-amber stamens with sky-blue tips
      const solarCupProfile = [
        new THREE.Vector2(0.0, 0.028),
        new THREE.Vector2(0.018, 0.032),
        new THREE.Vector2(0.024, 0.042),
        new THREE.Vector2(0.019, 0.046),
        new THREE.Vector2(0.005, 0.036),
        new THREE.Vector2(0.0, 0.038),
      ];
      const solarCupGeo = new THREE.LatheGeometry(solarCupProfile, 32);
      const solarCupMat = new THREE.MeshPhysicalMaterial({
        color: '#f59e0b',
        roughness: 0.44,
        sheen: 0.82,
        sheenColor: new THREE.Color('#fef08a'),
      });
      const solarCupMesh = new THREE.Mesh(solarCupGeo, solarCupMat);
      this.flowerHeadGroup.add(solarCupMesh);

      const wlFilCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0.028, -0.002),
        new THREE.Vector3(0, 0.056, 0.005),
      ]);
      const wlFilGeo = new THREE.TubeGeometry(wlFilCurve, 12, 0.0021, 8, false);
      const wlAntherGeo = createBilobedAntherGeometry(0.0025, 0.0095, false, 0.056, 0.005);
      const wlFilMat = new THREE.MeshPhysicalMaterial({
        color: '#fbbf24',
        roughness: 0.46,
        sheen: 0.75,
        sheenColor: new THREE.Color('#fef08a'),
      });
      const wlAntherMat = new THREE.MeshPhysicalMaterial({
        color: '#38bdf8',
        roughness: 0.42,
        sheen: 0.85,
        sheenColor: new THREE.Color('#bae6fd'),
      });
      this.geometriesToDispose.push(solarCupGeo, wlFilGeo, wlAntherGeo);
      this.materialsToDispose.push(solarCupMat, wlFilMat, wlAntherMat);

      const wlStamenCount = 52;
      for (let i = 0; i < wlStamenCount; i++) {
        const t = i / (wlStamenCount - 1);
        const yaw = i * GOLDEN_ANGLE;
        const r = envelope.stamenMinRadius + (envelope.stamenMaxRadius - envelope.stamenMinRadius) * t;
        const pivot = new THREE.Group();
        pivot.position.set(Math.cos(yaw) * r, 0.022 - t * 0.003, Math.sin(yaw) * r);
        pivot.rotation.y = -yaw - Math.PI / 2;
        pivot.scale.set(1.0, 0.78 + 0.36 * t, 1.0);
        const fMesh = new THREE.Mesh(wlFilGeo, wlFilMat);
        const aMesh = new THREE.Mesh(wlAntherGeo, wlAntherMat);
        pivot.add(fMesh, aMesh);
        this.flowerHeadGroup.add(pivot);
        this.stamenPivots.push({
          pivot,
          closedPitch: 0.1 + 0.12 * t,
          openPitch: 0.28 + 0.48 * t,
          baseRoll: organicNoise(i * 3.3) * 0.06,
          phaseOffset: i * 0.37,
        });
      }
      return;
    }

    const isLily = morph === 'lily-recurved';
    const isCamellia = morph === 'camellia-fibonacci';
    const stamenCount = isLily ? 6 : isCamellia ? 38 : 68;
    const filLen = isLily ? 0.165 : morph === 'lotus-pod' ? 0.046 : isCamellia ? 0.048 : 0.062;

    const filCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, filLen * 0.36, -0.003),
      new THREE.Vector3(0, filLen * 0.74, 0.0042),
      new THREE.Vector3(0, filLen, 0.008),
    ]);
    const filamentGeo = new THREE.TubeGeometry(
      filCurve,
      14,
      isLily ? 0.0025 : 0.00135,
      8,
      false,
    );

    const antherGeo = createBilobedAntherGeometry(
      isLily ? 0.0045 : 0.0023,
      isLily ? 0.02 : 0.0058,
      isLily,
      filLen,
      0.008,
    );

    const filamentMat = new THREE.MeshPhysicalMaterial({
      color: isLily ? '#a7c957' : '#fbbf24',
      roughness: 0.5,
      metalness: 0.0,
      sheen: 0.65,
      sheenColor: new THREE.Color('#fef08a'),
    });
    const antherMat = new THREE.MeshPhysicalMaterial({
      color: isLily ? '#9b2226' : '#f59e0b',
      roughness: 0.68,
      metalness: 0.0,
      sheen: 0.88,
      sheenRoughness: 0.55,
      sheenColor: new THREE.Color('#fef9c3'),
      emissive: new THREE.Color(isLily ? '#7f1d1d' : '#f59e0b'),
      emissiveIntensity: 0.04,
    });
    this.antherMaterials.push(antherMat);
    this.geometriesToDispose.push(filamentGeo, antherGeo);
    this.materialsToDispose.push(filamentMat, antherMat);

    if (isLily) {
      const styleCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0.01, 0),
        new THREE.Vector3(0, 0.1, 0.005),
        new THREE.Vector3(0, 0.195, 0.015),
      ]);
      const styleGeo = new THREE.TubeGeometry(
        styleCurve,
        20,
        0.0036,
        10,
        false,
      );
      const styleMesh = new THREE.Mesh(styleGeo, filamentMat);
      this.flowerHeadGroup.add(styleMesh);
      this.geometriesToDispose.push(styleGeo);

      const stigmaMat = new THREE.MeshPhysicalMaterial({
        color: '#7209b7',
        roughness: 0.38,
        sheen: 0.7,
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
    } else if (isCamellia) {
      // Camellia japonica: 3-fid pale-jade central style (三裂浅碧花柱) without Peony magenta carpels
      const camStyleGeo = new THREE.CylinderGeometry(0.0022, 0.0034, 0.038, 10);
      camStyleGeo.translate(0, 0.022, 0);
      const camStyleMat = new THREE.MeshPhysicalMaterial({
        color: '#d9f99d',
        roughness: 0.42,
        sheen: 0.7,
        sheenColor: new THREE.Color('#fef9c3'),
      });
      const camStyleMesh = new THREE.Mesh(camStyleGeo, camStyleMat);
      this.flowerHeadGroup.add(camStyleMesh);
      this.geometriesToDispose.push(camStyleGeo);
      this.materialsToDispose.push(camStyleMat);
    } else if (morph !== 'lotus-pod') {
      const carpelMat = new THREE.MeshPhysicalMaterial({
        color: '#74a857',
        roughness: 0.48,
        sheen: 0.6,
      });
      const stigmaCrestMat = new THREE.MeshPhysicalMaterial({
        color: '#b5174e',
        roughness: 0.38,
        sheen: 0.85,
        sheenColor: new THREE.Color('#ff85a1'),
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

    for (let i = 0; i < stamenCount; i++) {
      const t = i / Math.max(1, stamenCount - 1);
      const yaw = isLily
        ? (i / 6) * Math.PI * 2 + Math.PI / 6
        : i * GOLDEN_ANGLE + organicNoise(i * 4.1) * 0.04;
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

      const lenVariation = isLily
        ? 0.96 + organicNoise(i * 2.3) * 0.05
        : 0.82 + 0.32 * Math.sin(t * Math.PI) + organicNoise(i * 7.1) * 0.12;
      pivot.scale.set(1.0, lenVariation, 1.0);

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
          t +
        organicNoise(i * 5.9) * 0.06;

      this.stamenPivots.push({
        pivot,
        closedPitch,
        openPitch,
        baseRoll: organicNoise(i * 3.7) * 0.11,
        phaseOffset: i * 0.41,
        normalizedRank: t,
      });
    }
  }

  private buildSepalsAndMorphologyCorolla(): void {
    const normalTex = getBotanicalNormalTexture();
    const roughTex = getBotanicalRoughnessTexture();
    const albedoTex = getSpeciesPetalTexture(this.spec);
    const morph = this.spec.morphology;
    const envelope = computeFloralShellEnvelope(this.spec);

    const isMonocot =
      morph === 'iris-bearded' ||
      morph === 'lily-recurved' ||
      morph === 'orchid-zygomorphic';
    const sepalCount =
      morph === 'sunflower-capitulum' ? 24 : isMonocot ? 3 : 6;
    const sepalGeo = createSculptedPetalGeometry(
      isMonocot ? 0.064 : 0.132,
      isMonocot ? 0.028 : 0.058,
      0.18,
      1.5,
      0.0028,
      0,
      0.5,
      0.26,
      0.2,
      0.32,
      0,
      0.5,
    );
    const sepalMat = new THREE.MeshPhysicalMaterial({
      color: '#3a825e',
      vertexColors: true,
      roughness: 0.66,
      roughnessMap: roughTex,
      metalness: 0.0,
      clearcoat: 0.0,
      sheen: 0.72,
      sheenRoughness: 0.46,
      sheenColor: new THREE.Color('#a3e6be'),
      normalMap: normalTex,
      normalScale: new THREE.Vector2(0.36, 0.36),
      side: THREE.DoubleSide,
    });
    applyUE5FoliageSubsurfaceShader(
      sepalMat,
      '#74c69d',
      0.34,
      this.animatedShaderUniforms,
      0.006,
    );
    this.geometriesToDispose.push(sepalGeo);
    this.materialsToDispose.push(sepalMat);
    this.meshMaterialsForMode.push(sepalMat);

    for (let i = 0; i < sepalCount; i++) {
      const yaw = (i / sepalCount) * Math.PI * 2 + (i % 2) * 0.06;
      const rad = isMonocot
        ? 0.032
        : envelope.sepalRadius + (i % 2) * 0.003;
      const pivot = new THREE.Group();
      pivot.position.set(
        Math.cos(yaw) * rad,
        envelope.sepalY - (i % 2) * 0.002,
        Math.sin(yaw) * rad,
      );
      const baseYaw = -yaw - Math.PI / 2;
      const baseRoll = organicNoise(i * 2.9) * 0.05;
      pivot.rotation.y = baseYaw;

      const mesh = new THREE.Mesh(sepalGeo, sepalMat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.rotation.z = baseRoll;
      pivot.add(mesh);
      this.flowerHeadGroup.add(pivot);

      this.petalPivots.push({
        pivot,
        mesh,
        normalizedRank: -1,
        closedPitch: envelope.sepalClosedPitch + (i % 2) * 0.04,
        openPitch: envelope.sepalOpenPitch + (i % 2) * 0.05,
        baseYaw,
        baseRoll,
        naturalScaleX: 0.96 + (i % 2) * 0.08,
        naturalScaleY: 0.96 + ((i + 1) % 2) * 0.06,
        phaseOffset: i * 0.7,
      });
    }

    const isBioluminescent = morph === 'waterlily-stellate';
    // Silk-Velvet Translucent Botanical Material (Zero Plastic Clearcoat, High Vein Relief, Non-Overexposed!)
    const petalMaterial = new THREE.MeshPhysicalMaterial({
      map: albedoTex,
      vertexColors: true,
      roughness: 0.78,
      roughnessMap: roughTex,
      metalness: 0.0,
      transmission: 0.0,
      ior: 1.31,
      specularIntensity: 0.12,
      sheen: 0.32,
      sheenRoughness: 0.62,
      sheenColor: new THREE.Color(this.spec.primaryColor),
      clearcoat: 0.0,
      normalMap: normalTex,
      normalScale: new THREE.Vector2(0.64, 0.64),
      emissive: new THREE.Color(
        isBioluminescent ? this.spec.primaryColor : '#000000',
      ),
      emissiveIntensity: isBioluminescent ? 0.16 : 0.0,
      side: THREE.DoubleSide,
    });
    applyUE5FoliageSubsurfaceShader(
      petalMaterial,
      isBioluminescent ? '#80ffdb' : this.spec.primaryColor,
      isBioluminescent ? 0.32 : 0.24,
      this.animatedShaderUniforms,
      0.011,
    );
    this.materialsToDispose.push(petalMaterial);
    this.meshMaterialsForMode.push(petalMaterial);

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
      morph === 'waterlily-stellate'
        ? 0.44
        : morph === 'sunflower-capitulum'
          ? 0.48
          : morph === 'peony-ruffled' || morph === 'camellia-fibonacci'
            ? 0.68
            : 0.62;
    const tipRoundness =
      morph === 'peony-ruffled' || morph === 'camellia-fibonacci'
        ? 0.94
        : morph === 'lotus-pod'
          ? 0.68
          : morph === 'sunflower-capitulum'
            ? 0.28
            : 0.18;
    const recurve =
      morph === 'peony-ruffled'
        ? 0.26
        : morph === 'camellia-fibonacci'
          ? 0.14
          : 0.2;

    const tierSamples = [0.12, 0.24, 0.38, 0.52, 0.66, 0.78, 0.9, 1.0];
    const tierGeometries = tierSamples.map((tierT, idx) => {
      const lenScale =
        morph === 'sunflower-capitulum'
          ? 0.88 + 0.16 * Math.sin(tierT * Math.PI)
          : 0.62 + 0.42 * Math.sin(Math.pow(tierT, 0.68) * (Math.PI / 2));
      const widScale =
        morph === 'sunflower-capitulum'
          ? 0.88 + 0.2 * tierT
          : 0.78 + 0.3 * tierT;
      const aoFactor = 0.48 - tierT * 0.18;
      const tierCup = this.spec.cupDepth * (1.18 - tierT * 0.28);
      const tierRecurve = recurve * Math.pow(tierT, 1.35);
      const notchDepth =
        morph === 'sunflower-capitulum'
          ? 0.016
          : morph === 'peony-ruffled'
            ? this.spec.tipNotchDepth * (0.8 + 0.6 * tierT)
            : this.spec.tipNotchDepth;
      const geo = createSculptedPetalGeometry(
        this.spec.petalLength * lenScale,
        this.spec.petalWidth * widScale,
        tierCup,
        this.spec.ruffleFrequency,
        this.spec.ruffleAmplitude * (0.85 + 0.45 * tierT),
        notchDepth,
        widthBias,
        aoFactor,
        tierRecurve,
        tipRoundness,
        0,
        idx * 1.13,
      );
      this.geometriesToDispose.push(geo);
      return geo;
    });

    // For Sunflower capitulum, ray florets attach strictly around the outer rim of the seed disc
    const minR =
      morph === 'sunflower-capitulum'
        ? envelope.coreMaxRadius * 0.88
        : envelope.petalMinRadius;
    const maxR =
      morph === 'sunflower-capitulum'
        ? envelope.coreMaxRadius * 1.04
        : envelope.petalMaxRadius;

    for (let i = 0; i < totalPetals; i++) {
      const rank01 = i / Math.max(1, totalPetals - 1);
      const yawJitter = organicNoise(i * 3.73) * 0.036;
      const yaw =
        morph === 'sunflower-capitulum'
          ? (i / totalPetals) * Math.PI * 2 + (i % 2) * 0.055 + yawJitter * 0.5
          : i * GOLDEN_ANGLE + yawJitter;
      const r = minR + (maxR - minR) * Math.pow(rank01, 0.9);
      const yOffset =
        morph === 'sunflower-capitulum'
          ? 0.028 - rank01 * 0.008
          : envelope.petalTopY -
            (envelope.petalTopY - envelope.petalBottomY) * rank01;

      const tierIdx = Math.min(
        tierGeometries.length - 1,
        Math.floor(rank01 * tierGeometries.length),
      );
      const geo = tierGeometries[tierIdx];

      const pivot = new THREE.Group();
      pivot.position.set(Math.cos(yaw) * r, yOffset, Math.sin(yaw) * r);
      const baseYaw = -yaw - Math.PI / 2;
      const baseRoll = organicNoise(i * 6.17) * 0.085;
      const naturalScaleX = 0.93 + organicNoise(i * 9.41) * 0.08;
      const naturalScaleY = 0.95 + organicNoise(i * 4.83) * 0.06;
      pivot.rotation.y = baseYaw;

      const mesh = new THREE.Mesh(geo, petalMaterial);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.rotation.z = baseRoll;
      pivot.add(mesh);
      this.flowerHeadGroup.add(pivot);

      const closedPitch =
        envelope.petalClosedPitchRange[0] +
        (envelope.petalClosedPitchRange[1] -
          envelope.petalClosedPitchRange[0]) *
          rank01;
      const openPitch =
        morph === 'sunflower-capitulum'
          ? 1.38 + rank01 * 0.24 + organicNoise(i * 2.53) * 0.03
          : envelope.petalOpenPitchRange[0] +
            (envelope.petalOpenPitchRange[1] -
              envelope.petalOpenPitchRange[0]) *
              Math.pow(rank01, 1.05) +
            organicNoise(i * 2.53) * 0.038;

      this.petalPivots.push({
        pivot,
        mesh,
        normalizedRank: rank01,
        closedPitch,
        openPitch,
        baseYaw,
        baseRoll,
        naturalScaleX,
        naturalScaleY,
        phaseOffset: i * 0.47,
      });
    }
  }

  private buildLilyWhorls(petalMaterial: THREE.MeshPhysicalMaterial): void {
    const geoInner = createSculptedPetalGeometry(
      this.spec.petalLength * 0.96,
      this.spec.petalWidth * 1.12,
      0.18,
      this.spec.ruffleFrequency,
      this.spec.ruffleAmplitude * 1.25,
      0,
      0.54,
      0.26,
      0.26,
      0.48,
      0,
      0.4,
    );
    const geoOuter = createSculptedPetalGeometry(
      this.spec.petalLength * 1.04,
      this.spec.petalWidth * 0.98,
      0.16,
      this.spec.ruffleFrequency,
      this.spec.ruffleAmplitude,
      0,
      0.52,
      0.24,
      0.28,
      0.45,
      0,
      1.3,
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
        const baseRoll = organicNoise((ring * 3 + i) * 4.2) * 0.06;
        pivot.rotation.y = baseYaw;

        const mesh = new THREE.Mesh(
          isOuter ? geoOuter : geoInner,
          petalMaterial,
        );
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.rotation.z = baseRoll;
        pivot.add(mesh);
        this.flowerHeadGroup.add(pivot);

        this.petalPivots.push({
          pivot,
          mesh,
          normalizedRank: isOuter ? 0.88 : 0.38,
          closedPitch: isOuter ? 0.3 : 0.16,
          openPitch: this.spec.maxOpenAngleRad * (isOuter ? 0.98 : 0.82),
          baseYaw,
          baseRoll,
          naturalScaleX: 0.96 + organicNoise(i * 5.1) * 0.05,
          naturalScaleY: 0.97 + organicNoise(i * 7.7) * 0.04,
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
      0.255,
      0.132,
      0.16,
      1.8,
      0.0045,
      0,
      0.58,
      0.26,
      0.14,
      0.68,
      0,
      0.3,
    );
    const wingGeo = createSculptedPetalGeometry(
      0.275,
      0.228,
      0.2,
      2.6,
      0.0075,
      0.015,
      0.7,
      0.24,
      0.12,
      0.92,
      0,
      1.1,
    );
    // Mid-lobe of the trilobed labellum (蝴蝶兰中央舌瓣)
    const lipMidGeo = createSculptedPetalGeometry(
      0.185,
      0.138,
      0.28,
      3.4,
      0.008,
      0.1,
      0.72,
      0.22,
      0.08,
      0.78,
      0,
      2.2,
    );
    // Lateral side-lobes of the trilobed labellum (两侧向上包拢合蕊柱的侧裂片)
    const lipSideLobeGeo = createSculptedPetalGeometry(
      0.115,
      0.072,
      0.3,
      2.0,
      0.004,
      0,
      0.66,
      0.24,
      -0.12,
      0.86,
      0,
      0.8,
    );
    const lipMat = new THREE.MeshPhysicalMaterial({
      map: getOrchidLipTexture(),
      vertexColors: true,
      roughness: 0.72,
      roughnessMap: roughTex,
      clearcoat: 0.0,
      sheen: 0.45,
      sheenRoughness: 0.55,
      sheenColor: new THREE.Color('#ffd166'),
      normalMap: normalTex,
      normalScale: new THREE.Vector2(0.48, 0.48),
      side: THREE.DoubleSide,
    });
    applyUE5FoliageSubsurfaceShader(
      lipMat,
      '#ff9e00',
      0.28,
      this.animatedShaderUniforms,
      0.008,
    );

    const callusGeo = new THREE.CapsuleGeometry(0.0058, 0.018, 8, 12);
    const callusMat = new THREE.MeshPhysicalMaterial({
      color: '#f59e0b',
      roughness: 0.42,
      sheen: 0.6,
      sheenColor: new THREE.Color('#fef08a'),
    });

    this.geometriesToDispose.push(
      sepalGeo,
      wingGeo,
      lipMidGeo,
      lipSideLobeGeo,
      callusGeo,
    );
    this.materialsToDispose.push(lipMat, callusMat);
    this.meshMaterialsForMode.push(lipMat);

    // 1 Dorsal Sepal (top/back: Math.PI * 1.5) + 2 Lateral Sepals (lower-front left/right: Math.PI * 0.28 & Math.PI * 0.72)
    const sepalAngles = [Math.PI * 1.5, Math.PI * 0.28, Math.PI * 0.72];
    sepalAngles.forEach((yaw, i) => {
      const pivot = new THREE.Group();
      pivot.position.set(Math.cos(yaw) * 0.038, 0.016, Math.sin(yaw) * 0.038);
      const baseYaw = -yaw - Math.PI / 2;
      pivot.rotation.y = baseYaw;
      const mesh = new THREE.Mesh(sepalGeo, petalMaterial);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      pivot.add(mesh);
      this.flowerHeadGroup.add(pivot);
      this.petalPivots.push({
        pivot,
        mesh,
        normalizedRank: 0.88,
        closedPitch: 0.32,
        openPitch: i === 0 ? 1.32 : 1.44,
        baseYaw,
        baseRoll: organicNoise(i * 3.1) * 0.05,
        naturalScaleX: 1.0,
        naturalScaleY: 1.0,
        phaseOffset: i,
      });
    });

    // 2 Broad Lateral Wing Petals (宽展蝶翼侧花瓣)
    const wingAngles = [-0.06, Math.PI + 0.06];
    wingAngles.forEach((yaw, i) => {
      const pivot = new THREE.Group();
      pivot.position.set(Math.cos(yaw) * 0.032, 0.024, Math.sin(yaw) * 0.032);
      const baseYaw = -yaw - Math.PI / 2;
      pivot.rotation.y = baseYaw;
      const mesh = new THREE.Mesh(wingGeo, petalMaterial);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      pivot.add(mesh);
      this.flowerHeadGroup.add(pivot);
      this.petalPivots.push({
        pivot,
        mesh,
        normalizedRank: 0.52,
        closedPitch: 0.22,
        openPitch: 1.22,
        baseYaw,
        baseRoll: (i === 0 ? 1 : -1) * 0.06,
        naturalScaleX: 1.0,
        naturalScaleY: 1.0,
        phaseOffset: i + 2,
      });
    });

    // 2 Upturned Lateral Lip Lobes framing the arcuate Gynostemium column at the front (+Z)
    for (const side of [-1, 1]) {
      const sideYaw = Math.PI * 0.5 + side * 0.42;
      const sidePivot = new THREE.Group();
      sidePivot.position.set(side * 0.02, 0.026, 0.026);
      const baseYaw = -sideYaw - Math.PI / 2;
      sidePivot.rotation.y = baseYaw;
      const sideMesh = new THREE.Mesh(lipSideLobeGeo, lipMat);
      sideMesh.castShadow = true;
      sidePivot.add(sideMesh);
      this.flowerHeadGroup.add(sidePivot);
      this.petalPivots.push({
        pivot: sidePivot,
        mesh: sideMesh,
        normalizedRank: 0.22,
        closedPitch: 0.14,
        openPitch: 0.64,
        baseYaw,
        baseRoll: side * 0.18,
        naturalScaleX: 1.0,
        naturalScaleY: 1.0,
        phaseOffset: 5 + side,
      });
    }

    // Central Mid-Lobe of Labellum projecting forward (+Z) at yaw = Math.PI * 0.5 (baseYaw = -Math.PI)
    const lipPivot = new THREE.Group();
    lipPivot.position.set(0, 0.02, 0.036);
    const lipBaseYaw = -Math.PI;
    lipPivot.rotation.y = lipBaseYaw;
    const lipMesh = new THREE.Mesh(lipMidGeo, lipMat);
    lipMesh.castShadow = true;
    lipMesh.receiveShadow = true;

    const {position: cPos, normal: cNorm} = samplePetalSurfacePointAndNormal(
      lipMidGeo,
      0,
      0.24,
    );
    for (const side of [-1, 1]) {
      const callus = new THREE.Mesh(callusGeo, callusMat);
      callus.position
        .copy(cPos)
        .addScaledVector(cNorm, 0.0055)
        .add(new THREE.Vector3(side * 0.0085, 0, 0));
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
      baseRoll: 0,
      naturalScaleX: 1.0,
      naturalScaleY: 1.0,
      phaseOffset: 4,
    });
  }

  private buildIrisCorolla(petalMaterial: THREE.MeshPhysicalMaterial): void {
    // 1. Drooping Outer Falls (下垂反卷金须垂瓣)
    const fallGeo = createSculptedPetalGeometry(
      0.265,
      0.158,
      0.20,
      3.8,
      0.008,
      0.02,
      0.66,
      0.26,
      0.24,
      0.86,
      0,
      0.6,
    );
    // 2. Upright Vaulted Standards (直立拱冠旗瓣: clean 0.06 outward flare so the 3 standards never cross or clump)
    const standardGeo = createSculptedPetalGeometry(
      0.238,
      0.128,
      0.16,
      3.2,
      0.006,
      0.02,
      0.62,
      0.22,
      0.06,
      0.84,
      0,
      1.2,
    );
    // 3. Overarching Bifid Style Arms (花柱分枝)
    const styleArmGeo = createSculptedPetalGeometry(
      0.135,
      0.048,
      0.16,
      1.5,
      0.0025,
      0.06,
      0.55,
      0.22,
      0.14,
      0.62,
    );

    const beardTuftGeo = new THREE.ConeGeometry(0.0022, 0.0048, 6);
    beardTuftGeo.rotateX(Math.PI / 2);
    const beardMat = new THREE.MeshPhysicalMaterial({
      color: '#f59e0b',
      roughness: 0.44,
      sheen: 0.82,
      sheenColor: new THREE.Color('#fef08a'),
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
      pivot.position.set(Math.cos(yaw) * 0.048, 0.018, Math.sin(yaw) * 0.048);
      const baseYaw = -yaw - Math.PI / 2;
      pivot.rotation.y = baseYaw;

      const mesh = new THREE.Mesh(fallGeo, petalMaterial);
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      // Low-profile golden velvet beard along the white-gold signal midline
      for (let tIdx = 0; tIdx < 45; tIdx++) {
        const vNorm = 0.14 + (tIdx / 44) * 0.24;
        const rowMod = (tIdx % 3) - 1;
        const uNorm = rowMod * 0.036 + organicNoise(tIdx * 3.1) * 0.01;
        const {position, normal} = samplePetalSurfacePointAndNormal(
          fallGeo,
          uNorm,
          vNorm,
        );
        const tuft = new THREE.Mesh(beardTuftGeo, beardMat);
        tuft.position.copy(position).addScaledVector(normal, 0.0012);
        mesh.add(tuft);
      }

      pivot.add(mesh);
      this.flowerHeadGroup.add(pivot);

      this.petalPivots.push({
        pivot,
        mesh,
        normalizedRank: 0.88,
        closedPitch: 0.24,
        openPitch: 1.08,
        baseYaw,
        baseRoll: organicNoise(i * 4.1) * 0.04,
        naturalScaleX: 1.0,
        naturalScaleY: 1.0,
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
      styleMesh.castShadow = true;
      stylePivot.add(styleMesh);
      this.flowerHeadGroup.add(stylePivot);
      this.petalPivots.push({
        pivot: stylePivot,
        mesh: styleMesh,
        normalizedRank: 0.52,
        closedPitch: 0.20,
        openPitch: 0.82,
        baseYaw,
        baseRoll: 0,
        naturalScaleX: 1.0,
        naturalScaleY: 1.0,
        phaseOffset: i + 6,
      });
    }

    // 3 Upright Standards opening gracefully into a well-separated 3-part Iris crown
    for (let i = 0; i < 3; i++) {
      const yaw = (i / 3) * Math.PI * 2 + Math.PI / 3;
      const pivot = new THREE.Group();
      pivot.position.set(Math.cos(yaw) * 0.038, 0.030, Math.sin(yaw) * 0.038);
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
        normalizedRank: 0.24,
        closedPitch: 0.14,
        openPitch: 0.58,
        baseYaw,
        baseRoll: organicNoise((i + 3) * 3.7) * 0.03,
        naturalScaleX: 1.0,
        naturalScaleY: 1.0,
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
      transmission: IS_HEADLESS ? 0.0 : 0.96,
      transparent: true,
      opacity: IS_HEADLESS ? 0.72 : 1.0,
      ior: 1.333,
      thickness: 0.025,
      clearcoat: 1.0,
      clearcoatRoughness: 0.02,
    });
    this.geometriesToDispose.push(dropGeo);
    this.materialsToDispose.push(dropMat);

    const outerPetals = this.petalPivots.filter((p) => p.normalizedRank >= 0.48);
    for (let i = 0; i < Math.min(14, outerPetals.length); i += 2) {
      const targetPetal = outerPetals[i];
      const uNorm = (i % 4 === 0 ? 1 : -1) * (0.22 + (i % 3) * 0.05);
      const baseVNorm = 0.44 + (i % 3) * 0.12;
      const {position, normal} = samplePetalSurfacePointAndNormal(
        targetPetal.mesh.geometry,
        uNorm,
        baseVNorm,
      );

      const drop = new THREE.Mesh(dropGeo, dropMat);
      drop.position.copy(position).addScaledVector(normal, dropRadius * 0.62);
      targetPetal.mesh.add(drop);
      this.dewdropItems.push({
        mesh: drop,
        targetGeometry: targetPetal.mesh.geometry,
        uNorm,
        baseVNorm,
        dropRadius,
      });
    }
  }

  private buildFloatingPollenHalo(): void {
    const moteGeo = new THREE.SphereGeometry(0.002, 8, 8);
    const isBiolum = this.spec.morphology === 'waterlily-stellate';
    const moteMat = new THREE.MeshBasicMaterial({
      color: isBiolum ? '#80ffdb' : '#fde047',
      transparent: true,
      opacity: 0.76,
    });
    this.geometriesToDispose.push(moteGeo);
    this.materialsToDispose.push(moteMat);

    this.flowerHeadGroup.add(this.pollenHaloGroup);

    const moteCount = IS_HEADLESS ? 18 : 32;
    for (let i = 0; i < moteCount; i++) {
      const mesh = new THREE.Mesh(moteGeo, moteMat);
      const baseAngle = i * GOLDEN_ANGLE;
      const baseRadius = 0.02 + (i / moteCount) * 0.058;
      const baseY = 0.048 + (i % 6) * 0.015;
      const baseScale = 0.58 + (i % 3) * 0.24;
      const x = Math.cos(baseAngle) * baseRadius;
      const z = Math.sin(baseAngle) * baseRadius;
      mesh.position.set(x, baseY, z);
      mesh.scale.setScalar(baseScale);
      this.pollenHaloGroup.add(mesh);
      this.pollenMotes.push({
        mesh,
        state: {
          x,
          y: baseY,
          z,
          vx: -Math.sin(baseAngle) * 0.012,
          vy: 0.015,
          vz: Math.cos(baseAngle) * 0.012,
        },
        baseRadius,
        baseY,
        baseScale,
        speed: 0.58 + (i % 4) * 0.18,
        phase: i * 0.85,
      });
    }
  }

  /**
   * Constructs a single-draw-call Articulated 3D Gaussian Splatting (3DGS) Botanical Radiance Field
   * (Kerbl et al. SIGGRAPH 2023 EWA 2D Covariance Splatting + Degree-2 Spherical Harmonics).
   *
   * - In `'hybrid-3dgs'` mode, only margin/anther/core radiance splats (`isRimOrCore == 1`) are
   *   rendered with soft, elongated anisotropic covariance so petal faces stay 100% silky and
   *   free of polka-dot artifacts while petal edges, stamens, and flower heart glow with 3DGS softness!
   * - In `'pure-3dgs'` mode, all surface + margin + core Gaussians are rendered to reconstruct
   *   the entire botanical specimen as a dense 3D Gaussian Splatting radiance field!
   */
  private buildArticulated3DGaussianSplatField(): void {
    interface RawSplatSample {
      targetGroup: 'corolla' | 'companion' | 'stamen' | 'leaf';
      organIdx: number;
      uNorm: number;
      vNorm: number;
      normalOffset: number;
      sx: number;
      sy: number;
      tipDist: number;
      isRimOrCore: number;
      sh0: [number, number, number];
      alpha: number;
      sh1: [number, number, number];
    }

    const samples: RawSplatSample[] = [];
    const corollaCount = Math.max(
      6,
      this.petalPivots.filter((p) => p.normalizedRank >= 0).length,
    );
    const splatsPerPetal = IS_HEADLESS
      ? clamp(Math.round(820 / corollaCount), 18, 48)
      : clamp(Math.round(4200 / corollaCount), 56, 160);

    // Width ratio relative to reference petal width (0.14m) so narrow petals never overflow!
    const speciesWidthFactor = clamp(this.spec.petalWidth / 0.14, 0.48, 1.15);

    this.petalPivots.forEach((pItem, pIdx) => {
      const isSepal = pItem.normalizedRank < 0;
      const count = isSepal
        ? Math.max(8, Math.round(splatsPerPetal * 0.28))
        : splatsPerPetal;
      for (let s = 0; s < count; s++) {
        const t = (s + 0.5) / count;
        const frac = (s * 0.61803398875) % 1;
        // Inset vNorm in [0.10, 0.84] and uNorm in [-0.74, 0.74] so splat footprints NEVER bleed past petal tips/edges!
        const vNorm = clamp(0.1 + Math.pow(t, 0.78) * 0.74, 0.1, 0.84);
        const uRaw = frac * 2 - 1;
        const uNorm = clamp(
          Math.sign(uRaw) * Math.pow(Math.abs(uRaw), 0.76) * 0.74,
          -0.74,
          0.74,
        );

        let sh0: [number, number, number];
        let sh1: [number, number, number];
        if (isSepal) {
          sh0 = [0.24, 0.52, 0.36];
          sh1 = [0.34, 0.66, 0.46];
        } else {
          const pig = sampleSpeciesPetalPigment(
            this.spec,
            uNorm,
            vNorm,
            pItem.normalizedRank,
          );
          sh0 = pig.sh0;
          sh1 = pig.sh1;
        }

        const isEdgeOrThroat =
          Math.abs(uNorm) > 0.58 || vNorm > 0.72 || vNorm < 0.22;
        // Taper Gaussian covariance radii smoothly as splats approach the lateral edge or apex tip
        const lateralTaper = clamp(1.0 - Math.abs(uNorm) * 0.52, 0.42, 1.0);
        const longitudinalArch = clamp(
          Math.sin(Math.pow(vNorm, 0.72) * Math.PI),
          0.35,
          1.0,
        );
        const baseWidthFactor = isSepal ? 0.42 : speciesWidthFactor;

        const sx =
          (isEdgeOrThroat ? 0.011 : 0.0155) *
          baseWidthFactor *
          lateralTaper *
          longitudinalArch;
        const sy =
          (isEdgeOrThroat ? 0.016 : 0.022) *
          (0.68 + 0.32 * longitudinalArch) *
          clamp(1.0 - Math.pow(vNorm, 3.0) * 0.45, 0.5, 1.0);
        const alpha = isSepal ? 0.28 : isEdgeOrThroat ? 0.3 : 0.38;

        samples.push({
          targetGroup: 'corolla',
          organIdx: pIdx,
          uNorm,
          vNorm,
          normalOffset: (s % 2 === 0 ? 1 : -1) * 0.0005,
          sx,
          sy,
          tipDist: vNorm,
          isRimOrCore: isEdgeOrThroat ? 1.0 : 0.0,
          sh0,
          alpha,
          sh1,
        });
      }
    });

    const stamenStep = IS_HEADLESS ? 2 : 1;
    for (let sIdx = 0; sIdx < this.stamenPivots.length; sIdx += stamenStep) {
      const splatsPerStamen = IS_HEADLESS ? 2 : 4;
      for (let k = 0; k < splatsPerStamen; k++) {
        const vNorm = 0.62 + (k / splatsPerStamen) * 0.34;
        samples.push({
          targetGroup: 'stamen',
          organIdx: sIdx,
          uNorm: organicNoise(sIdx * 7 + k) * 0.35,
          vNorm,
          normalOffset: 0.0004,
          sx: 0.0052,
          sy: 0.0045,
          tipDist: vNorm,
          isRimOrCore: 1.0,
          sh0: [0.98, 0.8, 0.22],
          alpha: 0.44,
          sh1: [1.0, 0.92, 0.54],
        });
      }
    }

    // Keep companion bud crisp without oversized 3DGS splat halos
    const budSplatsPerPetal = 0;
    this.companionBudPivots.forEach((bItem, bIdx) => {
      for (let s = 0; s < budSplatsPerPetal; s++) {
        const vNorm = clamp(0.14 + ((s + 0.5) / budSplatsPerPetal) * 0.68, 0.14, 0.82);
        const uNorm = (((s * 0.6180339) % 1) * 2 - 1) * 0.68;
        const pig = sampleSpeciesPetalPigment(
          this.spec,
          uNorm,
          vNorm,
          bItem.normalizedRank,
        );
        samples.push({
          targetGroup: 'companion',
          organIdx: bIdx,
          uNorm,
          vNorm,
          normalOffset: 0.0004,
          sx: 0.0055,
          sy: 0.0075,
          tipDist: vNorm,
          isRimOrCore: vNorm > 0.68 ? 1.0 : 0.0,
          sh0: pig.sh0,
          alpha: 0.24,
          sh1: pig.sh1,
        });
      }
    });

    const leafSplatsPerBlade = IS_HEADLESS ? 16 : 48;
    this.leafPivots.forEach((_, lIdx) => {
      for (let s = 0; s < leafSplatsPerBlade; s++) {
        const vNorm = clamp(0.12 + ((s + 0.5) / leafSplatsPerBlade) * 0.72, 0.12, 0.84);
        const uNorm = (((s * 0.6180339) % 1) * 2 - 1) * 0.72;
        samples.push({
          targetGroup: 'leaf',
          organIdx: lIdx,
          uNorm,
          vNorm,
          normalOffset: 0.0005,
          sx: 0.011,
          sy: 0.015,
          tipDist: vNorm,
          isRimOrCore: Math.abs(uNorm) > 0.58 ? 1.0 : 0.0,
          sh0: [0.22, 0.48, 0.34],
          alpha: 0.28,
          sh1: [0.42, 0.76, 0.54],
        });
      }
    });

    const N = samples.length;
    this.totalGaussianSplats = N;

    const aCenterClosed = new Float32Array(N * 3);
    const aCenterMid = new Float32Array(N * 3);
    const aCenterOpen = new Float32Array(N * 3);
    const aNormalClosed = new Float32Array(N * 3);
    const aNormalOpen = new Float32Array(N * 3);
    const aSplatScale = new Float32Array(N * 4);
    const aColorSH0 = new Float32Array(N * 4);
    const aColorSH1 = new Float32Array(N * 3);

    const captureCanonicalBloomState = (
      bloomState: number,
      outCenters: Float32Array,
      outNormals?: Float32Array,
    ) => {
      this.setBloom(bloomState, 0);
      this.updateMatrixWorld(true);
      const invRootMat = new THREE.Matrix4().copy(this.matrixWorld).invert();
      const invRootRot = new THREE.Matrix3().getNormalMatrix(invRootMat);
      const tmpPos = new THREE.Vector3();
      const tmpNorm = new THREE.Vector3();

      for (let i = 0; i < N; i++) {
        const smp = samples[i];
        if (smp.targetGroup === 'corolla') {
          const item = this.petalPivots[smp.organIdx];
          const {position, normal} = samplePetalSurfacePointAndNormal(
            item.mesh.geometry,
            smp.uNorm,
            smp.vNorm,
          );
          tmpPos.copy(position).addScaledVector(normal, smp.normalOffset);
          tmpPos.applyMatrix4(item.mesh.matrixWorld).applyMatrix4(invRootMat);
          if (outNormals) {
            tmpNorm
              .copy(normal)
              .transformDirection(item.mesh.matrixWorld)
              .applyMatrix3(invRootRot)
              .normalize();
          }
        } else if (smp.targetGroup === 'companion') {
          const item = this.companionBudPivots[smp.organIdx];
          const {position, normal} = samplePetalSurfacePointAndNormal(
            item.mesh.geometry,
            smp.uNorm,
            smp.vNorm,
          );
          tmpPos.copy(position).addScaledVector(normal, smp.normalOffset);
          tmpPos.applyMatrix4(item.mesh.matrixWorld).applyMatrix4(invRootMat);
          if (outNormals) {
            tmpNorm
              .copy(normal)
              .transformDirection(item.mesh.matrixWorld)
              .applyMatrix3(invRootRot)
              .normalize();
          }
        } else if (smp.targetGroup === 'stamen') {
          const st = this.stamenPivots[smp.organIdx];
          const filLen =
            this.spec.morphology === 'lily-recurved'
              ? 0.165
              : this.spec.morphology === 'lotus-pod'
                ? 0.046
                : 0.062;
          tmpPos.set(
            smp.uNorm * 0.003,
            filLen * smp.vNorm,
            0.007 * smp.vNorm,
          );
          tmpPos.applyMatrix4(st.pivot.matrixWorld).applyMatrix4(invRootMat);
          if (outNormals) {
            tmpNorm.set(0, 1, 0.25).normalize();
          }
        } else {
          const lf = this.leafPivots[smp.organIdx];
          const {position, normal} = samplePetalSurfacePointAndNormal(
            lf.leafMesh.geometry,
            smp.uNorm,
            smp.vNorm,
          );
          tmpPos.copy(position).addScaledVector(normal, smp.normalOffset);
          tmpPos.applyMatrix4(lf.leafMesh.matrixWorld).applyMatrix4(invRootMat);
          if (outNormals) {
            tmpNorm
              .copy(normal)
              .transformDirection(lf.leafMesh.matrixWorld)
              .applyMatrix3(invRootRot)
              .normalize();
          }
        }

        outCenters[i * 3] = tmpPos.x;
        outCenters[i * 3 + 1] = tmpPos.y;
        outCenters[i * 3 + 2] = tmpPos.z;
        if (outNormals) {
          outNormals[i * 3] = tmpNorm.x;
          outNormals[i * 3 + 1] = tmpNorm.y;
          outNormals[i * 3 + 2] = tmpNorm.z;
        }
      }
    };

    captureCanonicalBloomState(0.0, aCenterClosed, aNormalClosed);
    captureCanonicalBloomState(0.5, aCenterMid);
    captureCanonicalBloomState(1.0, aCenterOpen, aNormalOpen);

    for (let i = 0; i < N; i++) {
      const smp = samples[i];
      aSplatScale[i * 4] = smp.sx;
      aSplatScale[i * 4 + 1] = smp.sy;
      aSplatScale[i * 4 + 2] = smp.tipDist;
      aSplatScale[i * 4 + 3] = smp.isRimOrCore;

      aColorSH0[i * 4] = smp.sh0[0];
      aColorSH0[i * 4 + 1] = smp.sh0[1];
      aColorSH0[i * 4 + 2] = smp.sh0[2];
      aColorSH0[i * 4 + 3] = smp.alpha;

      aColorSH1[i * 3] = smp.sh1[0];
      aColorSH1[i * 3 + 1] = smp.sh1[1];
      aColorSH1[i * 3 + 2] = smp.sh1[2];
    }

    const baseQuad = new THREE.PlaneGeometry(2, 2);
    const instGeo = new THREE.InstancedBufferGeometry();
    instGeo.index = baseQuad.index;
    instGeo.attributes.position = baseQuad.attributes.position;
    instGeo.attributes.uv = baseQuad.attributes.uv;
    instGeo.instanceCount = N;

    instGeo.setAttribute(
      'aCenterClosed',
      new THREE.InstancedBufferAttribute(aCenterClosed, 3),
    );
    instGeo.setAttribute(
      'aCenterMid',
      new THREE.InstancedBufferAttribute(aCenterMid, 3),
    );
    instGeo.setAttribute(
      'aCenterOpen',
      new THREE.InstancedBufferAttribute(aCenterOpen, 3),
    );
    instGeo.setAttribute(
      'aNormalClosed',
      new THREE.InstancedBufferAttribute(aNormalClosed, 3),
    );
    instGeo.setAttribute(
      'aNormalOpen',
      new THREE.InstancedBufferAttribute(aNormalOpen, 3),
    );
    instGeo.setAttribute(
      'aSplatScale',
      new THREE.InstancedBufferAttribute(aSplatScale, 4),
    );
    instGeo.setAttribute(
      'aColorSH0',
      new THREE.InstancedBufferAttribute(aColorSH0, 4),
    );
    instGeo.setAttribute(
      'aColorSH1',
      new THREE.InstancedBufferAttribute(aColorSH1, 3),
    );

    const splatUniforms = {
      uBloom: {value: 0.78},
      uTime: {value: 0.0},
      uTipUncurl: {value: 0.56},
      uKineticContainment: {value: 1.0},
      uSplatScaleMultiplier: {value: 0.68},
      uSplatOpacityMultiplier: {value: 0.18},
      uPureSplatMode: {value: 0.0},
    };
    this.animatedShaderUniforms.push(splatUniforms);

    this.gaussianSplatMaterial = new THREE.ShaderMaterial({
      uniforms: splatUniforms,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      side: THREE.DoubleSide,
      vertexShader: `
        attribute vec3 aCenterClosed;
        attribute vec3 aCenterMid;
        attribute vec3 aCenterOpen;
        attribute vec3 aNormalClosed;
        attribute vec3 aNormalOpen;
        attribute vec4 aSplatScale;
        attribute vec4 aColorSH0;
        attribute vec3 aColorSH1;

        uniform float uBloom;
        uniform float uTime;
        uniform float uTipUncurl;
        uniform float uKineticContainment;
        uniform float uSplatScaleMultiplier;
        uniform float uSplatOpacityMultiplier;
        uniform float uPureSplatMode;

        varying vec2 vSplatCoord;
        varying vec4 vColorAlpha;

        void main() {
          if (uPureSplatMode < 0.5 && aSplatScale.w < 0.5) {
            gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
            vSplatCoord = vec2(10.0, 10.0);
            vColorAlpha = vec4(0.0);
            return;
          }

          float b = clamp(uBloom, 0.0, 1.0);
          float l0 = 2.0 * (b - 0.5) * (b - 1.0);
          float l1 = -4.0 * b * (b - 1.0);
          float l2 = 2.0 * b * (b - 0.5);
          vec3 localCenter = l0 * aCenterClosed + l1 * aCenterMid + l2 * aCenterOpen;
          vec3 localNormal = normalize(mix(aNormalClosed, aNormalOpen, b));

          float vTipDist = clamp(aSplatScale.z, 0.0, 1.0);
          // Force-field kinetic containment damps high-speed wave splash while preserving tip uncurling
          float flexWeight = vTipDist * vTipDist * (0.38 + 0.62 * b) * uKineticContainment;
          float worldPhase = localCenter.x * 22.0 + localCenter.y * 14.0 + localCenter.z * 18.0;
          float primaryWave = sin(uTime * 2.25 + worldPhase + vTipDist * 4.2);
          float tipZone = smoothstep(0.48, 1.0, vTipDist);
          float uncurlOffset = -tipZone * tipZone * uTipUncurl * 0.008;
          localCenter += localNormal * (primaryWave * 0.0028 * flexWeight + uncurlOffset);

          vec4 viewCenter4 = modelViewMatrix * vec4(localCenter, 1.0);
          vec3 viewCenter = viewCenter4.xyz;
          vec3 viewNormal = normalize(normalMatrix * localNormal);

          // Pure 3D surface tangent basis (zero screen-space billboard tilt -> zero splat edge overflow!)
          vec3 upVec = abs(viewNormal.y) < 0.92 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
          vec3 t1 = normalize(cross(upVec, viewNormal));
          vec3 t2 = normalize(cross(viewNormal, t1));

          // Compress splat footprint by uKineticContainment at high interaction speeds so splats NEVER splash!
          float sx = aSplatScale.x * uSplatScaleMultiplier * (0.78 + 0.22 * b) * uKineticContainment;
          float sy = aSplatScale.y * uSplatScaleMultiplier * (0.78 + 0.22 * b) * uKineticContainment;

          vSplatCoord = position.xy * 2.0;
          vec3 splatOffset = t1 * (position.x * sx * 1.45) + t2 * (position.y * sy * 1.45) + viewNormal * 0.0008;

          vec3 keyDir = normalize(vec3(0.48, 0.78, 0.38));
          float dirLambert = 0.56 + 0.44 * clamp(dot(viewNormal, keyDir), -0.35, 1.0);

          vec3 viewDir = normalize(-viewCenter);
          float ndotv = abs(dot(viewNormal, viewDir));
          float shY1 = 0.4886 * (viewDir.y * 0.45 + viewDir.z * 0.35 - viewDir.x * 0.25);
          float shY2 = 0.3154 * (3.0 * viewDir.z * viewDir.z - 1.0) * 0.22;
          float velvetGrazing = pow(1.0 - clamp(ndotv, 0.0, 1.0), 1.85);
          float shMod = clamp(0.14 * (shY1 + shY2) + 0.24 * velvetGrazing, -0.1, 0.36);

          vec3 shRadiance = clamp(aColorSH0.rgb * dirLambert + aColorSH1 * shMod, 0.0, 0.90);
          vColorAlpha = vec4(shRadiance, clamp(aColorSH0.a * uSplatOpacityMultiplier, 0.0, 0.88));

          gl_Position = projectionMatrix * vec4(viewCenter + splatOffset, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vSplatCoord;
        varying vec4 vColorAlpha;

        void main() {
          float r2 = dot(vSplatCoord, vSplatCoord);
          if (r2 > 3.8) discard;
          // Tight Gaussian kernel with smooth boundary window so splats NEVER bleed or show hard edges
          float window = smoothstep(3.8, 1.1, r2);
          float gaussianWeight = exp(-1.35 * r2) * window;
          float alpha = vColorAlpha.a * gaussianWeight;
          if (alpha < 0.005) discard;

          vec3 col = vColorAlpha.rgb * (0.85 + 0.15 * gaussianWeight);
          gl_FragColor = vec4(col, alpha);
        }
      `,
    });

    this.gaussianSplatCloudMesh = new THREE.Mesh(
      instGeo,
      this.gaussianSplatMaterial,
    );
    this.gaussianSplatCloudMesh.name = `GaussianSplatField_${this.spec.id}`;
    this.gaussianSplatCloudMesh.frustumCulled = false;
    this.gaussianSplatCloudMesh.renderOrder = 2;
    this.add(this.gaussianSplatCloudMesh);

    baseQuad.dispose();
    this.geometriesToDispose.push(instGeo);
    this.materialsToDispose.push(this.gaussianSplatMaterial);
  }

  getForceFieldState(): BloomForceFieldState {
    return this.lastForceFieldState;
  }

  setBloom(
    bloom01: number,
    elapsedSec: number,
    dt = 1 / 60,
    bloomVelocity01PerSec = 0,
    angularSpeedRadPerSec = 0,
  ): void {
    this.currentBloom01 = clamp(bloom01, 0, 1);
    const b = this.currentBloom01;

    // Evaluate Force-Field Damping & Multi-Stage Blooming Details
    const damping = computeBloomForceFieldDamping(
      b,
      bloomVelocity01PerSec,
      angularSpeedRadPerSec,
    );
    this.lastForceFieldState = damping;
    const bloomDetails = evaluateDetailedBloomKinematics(
      b,
      bloomVelocity01PerSec,
    );

    for (const u of this.animatedShaderUniforms) {
      u.uTime.value = elapsedSec;
      u.uBloom.value = b;
      u.uTipUncurl.value = bloomDetails.tipUncurlFactor;
      u.uKineticContainment.value = damping.splatKineticCompression;
    }

    // Modulate anther pollen dehiscence luminescence as stamens are exposed at b > 0.42
    for (const aMat of this.antherMaterials) {
      aMat.emissiveIntensity = 0.03 + bloomDetails.antherDehiscenceGlow * 0.11;
    }

    this.flowerHeadGroup.position.set(0, 0.045, 0);
    this.flowerHeadGroup.rotation.x =
      0.16 +
      (Math.cos(elapsedSec * 1.15) * 0.015 +
        Math.sin(elapsedSec * 0.55) * 0.008) *
        damping.splatKineticCompression;
    this.flowerHeadGroup.rotation.z =
      (Math.sin(elapsedSec * 0.95) * 0.015 +
        Math.cos(elapsedSec * 0.6) * 0.006) *
      damping.splatKineticCompression;

    this.coreGlowLight.intensity =
      0.05 + Math.pow(b, 1.1) * (0.06 + 0.015 * Math.sin(elapsedSec * 2.2));

    // 1. Main Corolla Petals & Calyx Sepals: Multi-stage cascading radial wave + tip uncurling + breathing
    const kineticDamp = damping.splatKineticCompression;
    for (const item of this.petalPivots) {
      const basePitch = evaluateOrganPitchAtBloom(
        item.closedPitch,
        item.openPitch,
        item.normalizedRank,
        b,
      );
      const rankDelay = Math.max(0, item.normalizedRank) * 2.4;
      const primaryFlutter =
        Math.sin(elapsedSec * 1.95 - rankDelay + item.phaseOffset) *
        0.028 *
        (0.25 + 0.75 * b) *
        kineticDamp;
      const secondaryHarmonic =
        Math.cos(elapsedSec * 3.3 + item.phaseOffset * 1.7) *
        0.01 *
        (0.2 + 0.8 * b) *
        kineticDamp;

      item.mesh.rotation.x = -(basePitch + primaryFlutter + secondaryHarmonic);

      const rollWave =
        Math.sin(elapsedSec * 1.65 + item.phaseOffset * 1.3 - rankDelay * 0.5) *
        0.024 *
        (0.2 + 0.8 * b) *
        kineticDamp;
      item.mesh.rotation.z = item.baseRoll * (0.4 + 0.6 * b) + rollWave;

      if (item.normalizedRank >= 0) {
        const breathCupFlex =
          1.0 +
          Math.sin(elapsedSec * 1.95 - rankDelay + item.phaseOffset) *
            0.035 *
            b *
            kineticDamp;
        // At b=0, petals cup gently (1.12) to clasp the bud; as b->1, blade flattens & marginal ruffles expand
        const budCupScaleZ = (1.12 - 0.14 * b) * breathCupFlex;
        const budWidthScaleX =
          (0.88 + 0.12 * bloomDetails.marginRuffleExpansion) *
          item.naturalScaleX;
        const budLengthScaleY =
          (0.94 + 0.06 * Math.sin(b * Math.PI * 0.5)) * item.naturalScaleY;
        item.mesh.scale.set(
          budWidthScaleX,
          budLengthScaleY,
          budCupScaleZ,
        );
      }

      const spiralTwist =
        item.normalizedRank >= 0 ? (1 - b) * 0.24 * item.normalizedRank : 0;
      const azimuthSway =
        Math.cos(elapsedSec * 1.4 + item.phaseOffset) * 0.014 * b * kineticDamp;
      item.pivot.rotation.y = item.baseYaw + spiralTwist + azimuthSway;
    }

    // 2. Companion Side Bud Petals
    for (const budItem of this.companionBudPivots) {
      const budPitch = evaluateOrganPitchAtBloom(
        budItem.closedPitch,
        budItem.openPitch,
        budItem.normalizedRank,
        b * 0.85,
      );
      const flutter =
        Math.sin(elapsedSec * 2.25 + budItem.phaseOffset) *
        0.022 *
        (0.25 + 0.75 * b) *
        kineticDamp;
      budItem.mesh.rotation.x = -(budPitch + flutter);
      budItem.mesh.rotation.z =
        budItem.baseRoll +
        Math.cos(elapsedSec * 1.8 + budItem.phaseOffset) * 0.016 * b * kineticDamp;
      const twist = (1 - b) * 0.18 * budItem.normalizedRank;
      budItem.pivot.rotation.y = budItem.baseYaw + twist;
    }

    // 3. Stamens: Cascading Fibonacci spiral uncurl from outer ring to inner heart
    for (const st of this.stamenPivots) {
      const stRank = st.normalizedRank ?? 0.5;
      // Outer stamens (stRank -> 1) uncurl slightly earlier than innermost stamens (stRank -> 0)
      const staggeredBloom = clamp(b * (0.9 + 0.18 * stRank) - (1 - stRank) * 0.06, 0, 1);
      const baseStamenPitch = evaluateStamenPitchAtBloom(
        st.closedPitch,
        st.openPitch,
        staggeredBloom,
      );
      const pitchSway =
        (Math.sin(elapsedSec * 2.6 + st.phaseOffset) * 0.04 +
          Math.cos(elapsedSec * 4.1 - st.phaseOffset * 0.6) * 0.015) *
        (0.15 + 0.85 * b) *
        kineticDamp;
      const rollSway =
        Math.cos(elapsedSec * 2.15 + st.phaseOffset * 1.2) *
        0.034 *
        (0.15 + 0.85 * b) *
        kineticDamp;
      st.pivot.rotation.x = -(baseStamenPitch + pitchSway);
      st.pivot.rotation.z = st.baseRoll * b + rollSway;
    }

    // 4. Sliding Crystalline Dewdrops along unfurling outer petals
    const slideT = bloomDetails.dewdropSlideProgress;
    for (let dIdx = 0; dIdx < this.dewdropItems.length; dIdx++) {
      const item = this.dewdropItems[dIdx];
      const vSlide = clamp(
        item.baseVNorm + slideT * 0.12 + Math.sin(elapsedSec * 1.2 + dIdx) * 0.008 * b,
        0.22,
        0.82,
      );
      const {position, normal} = samplePetalSurfacePointAndNormal(
        item.targetGeometry,
        item.uNorm,
        vSlide,
      );
      item.mesh.position
        .copy(position)
        .addScaledVector(normal, item.dropRadius * 0.62);
      const tensionScale = 0.88 + 0.18 * Math.sin(b * Math.PI * 0.5);
      item.mesh.scale.set(
        tensionScale,
        tensionScale * (0.72 - 0.08 * slideT),
        tensionScale,
      );
    }

    // 5. Stem Leaves
    for (const lf of this.leafPivots) {
      const pitchWave =
        (Math.sin(elapsedSec * 1.55 + lf.phaseOffset) * 0.028 +
          Math.cos(elapsedSec * 2.7 + lf.phaseOffset) * 0.01) *
        kineticDamp;
      const rollWave =
        Math.cos(elapsedSec * 1.35 + lf.phaseOffset * 1.4) * 0.024 * kineticDamp;
      lf.leafMesh.rotation.x = lf.basePitch + pitchWave;
      lf.leafMesh.rotation.z = lf.baseRoll + rollWave;
    }

    // 6. Force-Field Damped Corolla Pollen & Nectar Micro-Vortex (Zero Splashing at High Speeds!)
    const haloVisible = b > 0.16;
    this.pollenHaloGroup.visible = haloVisible;
    if (haloVisible) {
      const bloomFactor = clamp((b - 0.16) / 0.84, 0, 1);
      const maxCorollaR = damping.maxRadialEnvelope;
      const minY = 0.032;
      const maxY = 0.068 + bloomFactor * 0.072;

      for (const mote of this.pollenMotes) {
        // Inject controlled radial impulse from bloomVelocity, immediately governed by force-field damper
        if (Math.abs(bloomVelocity01PerSec) > 0.05) {
          const rCur = Math.hypot(mote.state.x, mote.state.z) || 1;
          const radialImpulse = clamp(bloomVelocity01PerSec * 0.018, -0.04, 0.04);
          mote.state.vx += (mote.state.x / rCur) * radialImpulse * dt;
          mote.state.vz += (mote.state.z / rCur) * radialImpulse * dt;
        }

        const targetOrbitR = Math.min(
          maxCorollaR * 0.86,
          mote.baseRadius * (0.45 + 0.55 * bloomFactor),
        );
        mote.state = stepForceFieldDampedParticle(mote.state, {
          centerX: 0,
          centerY: 0,
          centerZ: 0,
          targetOrbitRadius: targetOrbitR,
          maxRadius: maxCorollaR,
          minY,
          maxY,
          swirlSpeed: (0.018 + 0.024 * bloomFactor) * mote.speed,
          updraftSpeed: (0.01 + 0.018 * bloomFactor) * mote.speed,
          phase: mote.phase,
          elapsedSec,
          dt,
          damping,
        });

        mote.mesh.position.set(mote.state.x, mote.state.y, mote.state.z);
        const pulseScale =
          mote.baseScale *
          (0.45 + 0.55 * bloomFactor) *
          (0.85 + 0.15 * Math.sin(elapsedSec * 2.8 + mote.phase)) *
          damping.splatKineticCompression;
        mote.mesh.scale.setScalar(pulseScale);
      }
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

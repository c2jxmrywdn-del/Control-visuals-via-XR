import * as THREE from 'three';
import {
  FLOWER_LIBRARY,
  type FlowerSpec,
  type GaussianSplatMode,
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
}

interface LeafPivotData {
  bladePivot: THREE.Group;
  leafMesh: THREE.Mesh;
  basePitch: number;
  baseRoll: number;
  phaseOffset: number;
}

interface PollenMoteData {
  mesh: THREE.Mesh;
  baseRadius: number;
  baseAngle: number;
  baseY: number;
  speed: number;
  phase: number;
}

interface AnimatedShaderUniforms {
  uTime: {value: number};
  uBloom: {value: number};
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
      clamp(sh1Color.r * 0.38, 0, 1),
      clamp(sh1Color.g * 0.38, 0, 1),
      clamp(sh1Color.b * 0.38, 0, 1),
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
  };
  if (uniformRegistry) {
    uniformRegistry.push(sharedUniforms);
  }

  material.customProgramCacheKey = () =>
    `ue5_3dgs_velvet_sss_v14_${subsurfaceColorHex}_${sssStrength.toFixed(2)}_${windAmplitude.toFixed(4)}`;

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uSubsurfaceColor = {value: sssColor};
    shader.uniforms.uSubsurfaceStrength = {value: sssStrength};
    shader.uniforms.uTime = sharedUniforms.uTime;
    shader.uniforms.uBloom = sharedUniforms.uBloom;
    shader.uniforms.uWindAmp = {value: windAmplitude};

    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `#include <common>
      uniform float uTime;
      uniform float uBloom;
      uniform float uWindAmp;`,
    );

    // Living GPU vertex undulation: flexes petal blade & ruffled margins while keeping base (color.b == 0) locked
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      #if defined( USE_COLOR )
        float vTipDist = clamp( color.b, 0.0, 1.0 );
        float flexWeight = vTipDist * vTipDist * ( 0.38 + 0.62 * uBloom );
        float worldPhase = position.x * 22.0 + position.y * 14.0 + position.z * 18.0;
        float primaryWave = sin( uTime * 2.25 + worldPhase + vTipDist * 4.2 );
        float secondaryRipple = cos( uTime * 3.6 - position.x * 32.0 + vTipDist * 6.8 ) * 0.48;
        float marginWeight = clamp( abs( position.x ) * 11.0, 0.3, 1.0 );
        transformed.z += ( primaryWave + secondaryRipple ) * uWindAmp * flexWeight * marginWeight;
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
  const key = `ue5_albedo_${size}_v14_${spec.id}`;
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
      // Authentic Sacred Pink Lotus: Warm golden-jade base -> soft blush-rose belly -> deep carmine-rose tip (rich contrast, never bleached white!)
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
    } else if (spec.morphology === 'sunflower-capitulum') {
      grad.addColorStop(0.0, '#9a3412');
      grad.addColorStop(0.22, '#c2410c');
      grad.addColorStop(0.54, '#d97706');
      grad.addColorStop(0.85, '#eab308');
      grad.addColorStop(1.0, '#facc15');
    } else if (spec.morphology === 'camellia-fibonacci') {
      grad.addColorStop(0.0, '#9e2a47');
      grad.addColorStop(0.36, '#d45d79');
      grad.addColorStop(0.74, '#ea9ab0');
      grad.addColorStop(1.0, '#f7d1dc');
    } else {
      const darkThroat = new THREE.Color(spec.throatColor).multiplyScalar(0.78);
      const midPrimary = new THREE.Color(spec.primaryColor).multiplyScalar(0.86);
      const tipSecondary = new THREE.Color(spec.secondaryColor).multiplyScalar(0.9);
      grad.addColorStop(0.0, `#${darkThroat.getHexString()}`);
      grad.addColorStop(0.38, `#${midPrimary.getHexString()}`);
      grad.addColorStop(0.82, `#${tipSecondary.getHexString()}`);
      grad.addColorStop(1.0, `#${ midPrimary.getHexString() }`);
    }

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, vSize, vSize);

    // Rich botanical tip & upper-margin blush (enhances 3D petal rim definition!)
    const tipRimGrad = ctx.createRadialGradient(512, 30, 20, 512, 160, 480);
    tipRimGrad.addColorStop(
      0,
      spec.morphology === 'lotus-pod'
        ? 'rgba(156, 14, 68, 0.42)'
        : spec.morphology === 'peony-ruffled'
          ? 'rgba(128, 12, 48, 0.28)'
          : 'rgba(140, 20, 65, 0.24)',
    );
    tipRimGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = tipRimGrad;
    ctx.fillRect(0, 0, vSize, vSize);

    // Central midrib structural shading
    const midribShade = ctx.createLinearGradient(452, 0, 572, 0);
    midribShade.addColorStop(0, 'rgba(0,0,0,0)');
    midribShade.addColorStop(0.35, 'rgba(120, 18, 54, 0.12)');
    midribShade.addColorStop(0.5, 'rgba(255, 240, 245, 0.18)');
    midribShade.addColorStop(0.65, 'rgba(120, 18, 54, 0.12)');
    midribShade.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = midribShade;
    ctx.fillRect(452, 0, 120, vSize);

    // Deep nectar claw shading at the petal base for crisp whorl separation
    const clawShade = ctx.createRadialGradient(512, 1010, 15, 512, 920, 340);
    clawShade.addColorStop(
      0,
      spec.morphology === 'lotus-pod'
        ? 'rgba(168, 125, 32, 0.42)'
        : 'rgba(92, 10, 34, 0.38)',
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
    }

    // High-definition primary + secondary anastomosing vascular venation (清晰细腻的植物花瓣脉络)
    const primaryVeinColor =
      spec.morphology === 'waterlily-stellate'
        ? 'rgba(32, 185, 160, 0.42)'
        : spec.morphology === 'lotus-pod'
          ? 'rgba(162, 16, 72, 0.42)'
          : spec.morphology === 'peony-ruffled'
            ? 'rgba(108, 8, 38, 0.38)'
            : spec.morphology === 'sunflower-capitulum'
              ? 'rgba(146, 52, 12, 0.40)'
              : 'rgba(132, 18, 58, 0.36)';

    const fineVeinColor =
      spec.morphology === 'waterlily-stellate'
        ? 'rgba(72, 228, 198, 0.28)'
        : spec.morphology === 'lotus-pod'
          ? 'rgba(192, 28, 88, 0.26)'
          : 'rgba(148, 24, 66, 0.24)';

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

  const safeCup = clamp(cupDepth, 0.06, 0.32);
  const safeRuffle = clamp(ruffleAmp, 0, 0.014);
  const safeRecurve = clamp(recurvedFactor, -0.14, 0.32);
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
  private readonly pollenMotes: PollenMoteData[] = [];
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
      this.gaussianSplatMaterial.uniforms.uSplatScaleMultiplier.value = 1.42;
      this.gaussianSplatMaterial.uniforms.uSplatOpacityMultiplier.value = 1.28;
      this.gaussianSplatMaterial.uniforms.uPureSplatMode.value = 1.0;
      for (const mat of this.meshMaterialsForMode) {
        mat.transparent = true;
        mat.opacity = 0.25;
        mat.depthWrite = true;
      }
    } else {
      // 'hybrid-3dgs' (Default): Continuous 3DGS SH + Subsurface Velvet Petals + Soft 3DGS Rim/Pollen Radiance Field
      this.gaussianSplatCloudMesh.visible = true;
      this.gaussianSplatMaterial.uniforms.uSplatScaleMultiplier.value = 1.08;
      this.gaussianSplatMaterial.uniforms.uSplatOpacityMultiplier.value = 0.26;
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

    const petioleCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.002, 0.011),
      new THREE.Vector3(0, 0.0, 0.028),
      new THREE.Vector3(0, -0.005, 0.045),
    ]);
    const petioleGeo = new THREE.TubeGeometry(
      petioleCurve,
      14,
      0.0036,
      10,
      false,
    );

    const midribCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, -0.001),
      new THREE.Vector3(0, 0.08, -0.005),
      new THREE.Vector3(0, 0.155, -0.012),
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
      {tStem: 0.72, yaw: 0.65, pitch: -1.22, roll: 0.08, scale: 0.94},
      {tStem: 0.54, yaw: -2.1, pitch: -1.28, roll: -0.09, scale: 1.06},
      {tStem: 0.34, yaw: 2.3, pitch: -1.25, roll: 0.07, scale: 0.96},
      {tStem: 0.18, yaw: -0.85, pitch: -1.32, roll: -0.06, scale: 0.86},
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
      axilBud.position.set(0, 0.004, 0.016);
      axilBud.rotation.x = 0.42;
      nodeGroup.add(axilBud);

      for (const side of [-1, 1]) {
        const stip = new THREE.Mesh(stipuleGeo, leafMat);
        stip.position.set(side * 0.008, 0.001, 0.015);
        stip.rotation.set(-0.55, side * 0.45, side * -0.35);
        nodeGroup.add(stip);
      }

      const bladePivot = new THREE.Group();
      bladePivot.position.set(0, -0.005, 0.044);
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
      sMesh.scale.setScalar(1.85);
      sMesh.rotation.x = -0.28;
      sPiv.add(sMesh);
      this.companionBudGroup.add(sPiv);
    }

    const budPetalGeo = createSculptedPetalGeometry(
      0.092,
      0.056,
      0.24,
      2.2,
      0.0035,
      0,
      0.58,
      0.24,
      0.06,
      0.78,
      0,
      0.7,
    );
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
      0.006,
    );
    this.geometriesToDispose.push(budPetalGeo);
    this.materialsToDispose.push(budPetalMat);
    this.meshMaterialsForMode.push(budPetalMat);

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
      const baseRoll = organicNoise(i * 3.1) * 0.06;
      p.rotation.y = baseYaw;
      const m = new THREE.Mesh(budPetalGeo, budPetalMat);
      const closedPitch = 0.08 + rank * 0.18;
      const openPitch = 0.34 + rank * 0.56;
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
        naturalScaleX: 0.94 + organicNoise(i * 5.7) * 0.06,
        naturalScaleY: 0.96 + organicNoise(i * 7.3) * 0.05,
        phaseOffset: i * 0.55,
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
      const discGeo = new THREE.CylinderGeometry(
        envelope.coreMaxRadius,
        envelope.coreMaxRadius * 0.82,
        0.036,
        48,
      );
      const discMat = new THREE.MeshStandardMaterial({
        color: '#281305',
        roughness: 0.78,
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
        roughness: 0.52,
        sheen: 0.6,
        sheenColor: new THREE.Color('#fde047'),
      });
      const budFloretGeo = new THREE.SphereGeometry(0.0044, 8, 8);
      budFloretGeo.scale(1, 1.4, 1);
      const budFloretMat = new THREE.MeshPhysicalMaterial({
        color: '#4a2208',
        roughness: 0.55,
        sheen: 0.4,
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
        roughness: 0.48,
        sheen: 0.78,
        sheenColor: new THREE.Color('#ffffff'),
      });
      const colMesh = new THREE.Mesh(colGeo, colMat);
      colMesh.position.set(0, 0.046, 0.008);
      colMesh.rotation.x = 0.42;

      const antherCapGeo = new THREE.SphereGeometry(0.0105, 14, 14);
      antherCapGeo.scale(1.05, 0.85, 1.15);
      const antherCapMat = new THREE.MeshPhysicalMaterial({
        color: '#e09f3e',
        roughness: 0.42,
        sheen: 0.65,
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
    const filLen = isLily ? 0.165 : morph === 'lotus-pod' ? 0.046 : 0.062;

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
    });
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
      0.132,
      0.058,
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
      const rad = envelope.sepalRadius + (i % 2) * 0.003;
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
      morph === 'waterlily-stellate' || morph === 'sunflower-capitulum'
        ? 0.5
        : morph === 'peony-ruffled' || morph === 'camellia-fibonacci'
          ? 0.68
          : 0.62;
    const tipRoundness =
      morph === 'peony-ruffled' || morph === 'camellia-fibonacci'
        ? 0.95
        : morph === 'lotus-pod'
          ? 0.72
          : morph === 'sunflower-capitulum'
            ? 0.42
            : 0.35;
    const recurve = morph === 'peony-ruffled' ? 0.26 : 0.2;

    const tierSamples = [0.12, 0.24, 0.38, 0.52, 0.66, 0.78, 0.9, 1.0];
    const tierGeometries = tierSamples.map((tierT, idx) => {
      const lenScale =
        0.62 + 0.42 * Math.sin(Math.pow(tierT, 0.68) * (Math.PI / 2));
      const widScale = 0.78 + 0.3 * tierT;
      const aoFactor = 0.48 - tierT * 0.18;
      // Inner tiers have deeper spoon cupping (1.18x) to form a lush 3D chalice bowl;
      // outer tiers flare and gently recurve at their tips!
      const tierCup = this.spec.cupDepth * (1.18 - tierT * 0.28);
      const tierRecurve = recurve * Math.pow(tierT, 1.35);
      const geo = createSculptedPetalGeometry(
        this.spec.petalLength * lenScale,
        this.spec.petalWidth * widScale,
        tierCup,
        this.spec.ruffleFrequency,
        this.spec.ruffleAmplitude * (0.85 + 0.45 * tierT),
        this.spec.tipNotchDepth,
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

    const minR = envelope.petalMinRadius;
    const maxR = envelope.petalMaxRadius;

    for (let i = 0; i < totalPetals; i++) {
      const rank01 = i / Math.max(1, totalPetals - 1);
      const yawJitter = organicNoise(i * 3.73) * 0.042;
      const yaw = i * GOLDEN_ANGLE + yawJitter;
      const r = minR + (maxR - minR) * Math.pow(rank01, 0.9);
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
      const baseRoll = organicNoise(i * 6.17) * 0.095;
      const naturalScaleX = 0.92 + organicNoise(i * 9.41) * 0.09;
      const naturalScaleY = 0.94 + organicNoise(i * 4.83) * 0.07;
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
      // Progressive 3D chalice bowl pitch curve: inner petals cup upward around the heart,
      // middle petals form a deep bowl, and outer guard petals flare gracefully!
      const openPitch =
        envelope.petalOpenPitchRange[0] +
        (envelope.petalOpenPitchRange[1] - envelope.petalOpenPitchRange[0]) *
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
      0.25,
      0.13,
      0.16,
      1.8,
      0.005,
      0,
      0.62,
      0.26,
      0.16,
      0.75,
      0,
      0.3,
    );
    const wingGeo = createSculptedPetalGeometry(
      0.27,
      0.22,
      0.2,
      2.8,
      0.0085,
      0.02,
      0.7,
      0.24,
      0.14,
      0.92,
      0,
      1.1,
    );
    const lipGeo = createSculptedPetalGeometry(
      0.195,
      0.15,
      0.26,
      3.8,
      0.0095,
      0.12,
      0.72,
      0.22,
      0.12,
      0.85,
      0,
      2.2,
    );
    const lipMat = new THREE.MeshPhysicalMaterial({
      color: '#e61972',
      vertexColors: true,
      roughness: 0.72,
      roughnessMap: roughTex,
      clearcoat: 0.0,
      sheen: 0.98,
      sheenRoughness: 0.42,
      sheenColor: new THREE.Color('#ffd166'),
      normalMap: normalTex,
      normalScale: new THREE.Vector2(0.35, 0.35),
      side: THREE.DoubleSide,
    });
    applyUE5FoliageSubsurfaceShader(
      lipMat,
      '#ff9e00',
      0.46,
      this.animatedShaderUniforms,
      0.009,
    );

    const callusGeo = new THREE.CapsuleGeometry(0.0055, 0.018, 6, 12);
    const callusMat = new THREE.MeshPhysicalMaterial({
      color: '#d97706',
      roughness: 0.45,
    });

    this.geometriesToDispose.push(sepalGeo, wingGeo, lipGeo, callusGeo);
    this.materialsToDispose.push(lipMat, callusMat);
    this.meshMaterialsForMode.push(lipMat);

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
        openPitch: 1.48,
        baseYaw,
        baseRoll: organicNoise(i * 3.1) * 0.05,
        naturalScaleX: 1.0,
        naturalScaleY: 1.0,
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
        openPitch: 1.28,
        baseYaw,
        baseRoll: (i === 0 ? 1 : -1) * 0.06,
        naturalScaleX: 1.0,
        naturalScaleY: 1.0,
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
      openPitch: 1.18,
      baseYaw: lipBaseYaw,
      baseRoll: 0,
      naturalScaleX: 1.0,
      naturalScaleY: 1.0,
      phaseOffset: 4,
    });
  }

  private buildIrisCorolla(petalMaterial: THREE.MeshPhysicalMaterial): void {
    const fallGeo = createSculptedPetalGeometry(
      0.27,
      0.165,
      0.22,
      4.5,
      0.0095,
      0.03,
      0.68,
      0.26,
      0.26,
      0.88,
      0,
      0.6,
    );
    const standardGeo = createSculptedPetalGeometry(
      0.245,
      0.155,
      0.24,
      4.0,
      0.0085,
      0.025,
      0.66,
      0.24,
      -0.06,
      0.88,
      0,
      1.5,
    );
    const styleArmGeo = createSculptedPetalGeometry(
      0.135,
      0.048,
      0.2,
      1.5,
      0.003,
      0.06,
      0.55,
      0.24,
      0.18,
      0.65,
    );

    const beardTuftGeo = new THREE.ConeGeometry(0.0038, 0.011, 7);
    beardTuftGeo.rotateX(Math.PI / 2);
    const beardMat = new THREE.MeshStandardMaterial({
      color: '#f59e0b',
      roughness: 0.55,
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
        openPitch: 1.52,
        baseYaw,
        baseRoll: organicNoise(i * 4.1) * 0.05,
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
      stylePivot.add(styleMesh);
      this.flowerHeadGroup.add(stylePivot);
      this.petalPivots.push({
        pivot: stylePivot,
        mesh: styleMesh,
        normalizedRank: 0.52,
        closedPitch: 0.22,
        openPitch: 0.98,
        baseYaw,
        baseRoll: 0,
        naturalScaleX: 1.0,
        naturalScaleY: 1.0,
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
        openPitch: 0.64,
        baseYaw,
        baseRoll: organicNoise((i + 3) * 3.7) * 0.06,
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

  private buildFloatingPollenHalo(): void {
    const moteGeo = new THREE.SphereGeometry(0.0021, 8, 8);
    const isBiolum = this.spec.morphology === 'waterlily-stellate';
    const moteMat = new THREE.MeshBasicMaterial({
      color: isBiolum ? '#80ffdb' : '#fde047',
      transparent: true,
      opacity: 0.78,
    });
    this.geometriesToDispose.push(moteGeo);
    this.materialsToDispose.push(moteMat);

    this.flowerHeadGroup.add(this.pollenHaloGroup);

    const moteCount = 16;
    for (let i = 0; i < moteCount; i++) {
      const mesh = new THREE.Mesh(moteGeo, moteMat);
      const baseAngle = i * GOLDEN_ANGLE;
      const baseRadius = 0.024 + (i / moteCount) * 0.075;
      const baseY = 0.055 + (i % 5) * 0.018;
      const scale = 0.65 + (i % 3) * 0.28;
      mesh.scale.setScalar(scale);
      this.pollenHaloGroup.add(mesh);
      this.pollenMotes.push({
        mesh,
        baseRadius,
        baseAngle,
        baseY,
        speed: 0.65 + (i % 4) * 0.22,
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
    const splatsPerPetal = IS_HEADLESS
      ? Math.max(24, Math.round(960 / Math.max(6, this.petalPivots.length)))
      : Math.max(72, Math.round(4800 / Math.max(6, this.petalPivots.length)));

    this.petalPivots.forEach((pItem, pIdx) => {
      const isSepal = pItem.normalizedRank < 0;
      const count = isSepal
        ? Math.max(10, Math.round(splatsPerPetal * 0.35))
        : splatsPerPetal;
      for (let s = 0; s < count; s++) {
        const t = (s + 0.5) / count;
        const frac = (s * 0.61803398875) % 1;
        const vNorm = clamp(Math.pow(t, 0.75), 0.06, 0.98);
        const uRaw = frac * 2 - 1;
        const uNorm = clamp(
          Math.sign(uRaw) * Math.pow(Math.abs(uRaw), 0.68),
          -0.98,
          0.98,
        );

        let sh0: [number, number, number];
        let sh1: [number, number, number];
        if (isSepal) {
          sh0 = [0.24, 0.52, 0.36];
          sh1 = [0.38, 0.72, 0.52];
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
          Math.abs(uNorm) > 0.82 || vNorm > 0.88 || vNorm < 0.18;
        // Elongated anisotropic Gaussian splats along the petal tangent plane
        const sx = (isEdgeOrThroat ? 0.018 : 0.026) * (0.78 + 0.32 * vNorm);
        const sy = (isEdgeOrThroat ? 0.028 : 0.036) * (0.78 + 0.32 * vNorm);
        const alpha = isSepal ? 0.34 : isEdgeOrThroat ? 0.36 : 0.44;

        samples.push({
          targetGroup: 'corolla',
          organIdx: pIdx,
          uNorm,
          vNorm,
          normalOffset: (s % 2 === 0 ? 1 : -1) * 0.0012,
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
      const splatsPerStamen = IS_HEADLESS ? 3 : 5;
      for (let k = 0; k < splatsPerStamen; k++) {
        const vNorm = 0.55 + (k / splatsPerStamen) * 0.45;
        samples.push({
          targetGroup: 'stamen',
          organIdx: sIdx,
          uNorm: organicNoise(sIdx * 7 + k) * 0.5,
          vNorm,
          normalOffset: 0.001,
          sx: 0.0085,
          sy: 0.0065,
          tipDist: vNorm,
          isRimOrCore: 1.0,
          sh0: [1.0, 0.84, 0.24],
          alpha: 0.55,
          sh1: [1.0, 0.96, 0.62],
        });
      }
    }

    const budSplatsPerPetal = IS_HEADLESS ? 8 : 20;
    this.companionBudPivots.forEach((bItem, bIdx) => {
      for (let s = 0; s < budSplatsPerPetal; s++) {
        const vNorm = clamp((s + 0.5) / budSplatsPerPetal, 0.1, 0.95);
        const uNorm = (((s * 0.6180339) % 1) * 2 - 1) * 0.9;
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
          normalOffset: 0.001,
          sx: 0.014,
          sy: 0.018,
          tipDist: vNorm,
          isRimOrCore: vNorm > 0.78 ? 1.0 : 0.0,
          sh0: pig.sh0,
          alpha: 0.38,
          sh1: pig.sh1,
        });
      }
    });

    const leafSplatsPerBlade = IS_HEADLESS ? 20 : 64;
    this.leafPivots.forEach((_, lIdx) => {
      for (let s = 0; s < leafSplatsPerBlade; s++) {
        const vNorm = clamp((s + 0.5) / leafSplatsPerBlade, 0.08, 0.96);
        const uNorm = (((s * 0.6180339) % 1) * 2 - 1) * 0.92;
        samples.push({
          targetGroup: 'leaf',
          organIdx: lIdx,
          uNorm,
          vNorm,
          normalOffset: 0.0012,
          sx: 0.018,
          sy: 0.024,
          tipDist: vNorm,
          isRimOrCore: Math.abs(uNorm) > 0.8 ? 1.0 : 0.0,
          sh0: [0.22, 0.5, 0.35],
          alpha: 0.34,
          sh1: [0.46, 0.84, 0.6],
        });
      }
    });

    const N = samples.length;
    this.totalGaussianSplats = N;

    const aCenterClosed = new Float32Array(N * 3);
    const aCenterMid = new Float32Array(N * 3);
    const aCenterOpen = new Float32Array(N * 3);
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
            smp.uNorm * 0.004,
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

    captureCanonicalBloomState(0.0, aCenterClosed);
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
      uSplatScaleMultiplier: {value: 1.08},
      uSplatOpacityMultiplier: {value: 0.26},
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
        attribute vec3 aNormalOpen;
        attribute vec4 aSplatScale;
        attribute vec4 aColorSH0;
        attribute vec3 aColorSH1;

        uniform float uBloom;
        uniform float uTime;
        uniform float uSplatScaleMultiplier;
        uniform float uSplatOpacityMultiplier;
        uniform float uPureSplatMode;

        varying vec2 vSplatCoord;
        varying vec4 vColorAlpha;

        void main() {
          // In hybrid mode (uPureSplatMode == 0), only render rim/margin & stamen/core 3DGS radiance wisps
          // so petal interiors stay 100% silky and show crisp vascular vein details!
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

          float vTipDist = clamp(aSplatScale.z, 0.0, 1.0);
          float flexWeight = vTipDist * vTipDist * (0.38 + 0.62 * b);
          float worldPhase = localCenter.x * 22.0 + localCenter.y * 14.0 + localCenter.z * 18.0;
          float primaryWave = sin(uTime * 2.25 + worldPhase + vTipDist * 4.2);
          localCenter.y += primaryWave * 0.006 * flexWeight;
          localCenter.x += cos(uTime * 1.85 + worldPhase * 0.75) * 0.004 * flexWeight;

          vec4 viewCenter4 = modelViewMatrix * vec4(localCenter, 1.0);
          vec3 viewCenter = viewCenter4.xyz;
          vec3 viewNormal = normalize(normalMatrix * aNormalOpen);

          vec3 upVec = abs(viewNormal.y) < 0.92 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
          vec3 t1 = normalize(cross(upVec, viewNormal));
          vec3 t2 = normalize(cross(viewNormal, t1));

          float sx = aSplatScale.x * uSplatScaleMultiplier * (0.76 + 0.24 * b);
          float sy = aSplatScale.y * uSplatScaleMultiplier * (0.76 + 0.24 * b);

          vec3 billT1 = mix(t1, vec3(1.0, 0.0, 0.0), 0.32);
          vec3 billT2 = mix(t2, vec3(0.0, 1.0, 0.0), 0.32);

          vSplatCoord = position.xy * 2.35;
          vec3 splatOffset = billT1 * (position.x * sx * 2.1) + billT2 * (position.y * sy * 2.1) + viewNormal * 0.0018;

          // Directional Lambertian shading + Degree-2 Spherical Harmonics so 3DGS splats have crisp 3D depth
          vec3 keyDir = normalize(vec3(0.48, 0.78, 0.38));
          float dirLambert = 0.56 + 0.44 * clamp(dot(viewNormal, keyDir), -0.35, 1.0);

          vec3 viewDir = normalize(-viewCenter);
          float ndotv = abs(dot(viewNormal, viewDir));
          float shY1 = 0.4886 * (viewDir.y * 0.45 + viewDir.z * 0.35 - viewDir.x * 0.25);
          float shY2 = 0.3154 * (3.0 * viewDir.z * viewDir.z - 1.0) * 0.22;
          float velvetGrazing = pow(1.0 - clamp(ndotv, 0.0, 1.0), 1.85);
          float shMod = clamp(0.16 * (shY1 + shY2) + 0.28 * velvetGrazing, -0.1, 0.42);

          vec3 shRadiance = clamp(aColorSH0.rgb * dirLambert + aColorSH1 * shMod, 0.0, 0.92);
          vColorAlpha = vec4(shRadiance, clamp(aColorSH0.a * uSplatOpacityMultiplier, 0.0, 0.92));

          gl_Position = projectionMatrix * vec4(viewCenter + splatOffset, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vSplatCoord;
        varying vec4 vColorAlpha;

        void main() {
          float r2 = dot(vSplatCoord, vSplatCoord);
          if (r2 > 5.5) discard;
          float gaussianWeight = exp(-0.5 * r2);
          float alpha = vColorAlpha.a * gaussianWeight;
          if (alpha < 0.004) discard;

          vec3 col = vColorAlpha.rgb * (0.82 + 0.16 * gaussianWeight);
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

  setBloom(bloom01: number, elapsedSec: number): void {
    this.currentBloom01 = clamp(bloom01, 0, 1);
    const b = this.currentBloom01;

    for (const u of this.animatedShaderUniforms) {
      u.uTime.value = elapsedSec;
      u.uBloom.value = b;
    }

    this.flowerHeadGroup.position.set(0, 0.045, 0);
    this.flowerHeadGroup.rotation.x =
      0.16 +
      Math.cos(elapsedSec * 1.15) * 0.015 +
      Math.sin(elapsedSec * 0.55) * 0.008;
    this.flowerHeadGroup.rotation.z =
      Math.sin(elapsedSec * 0.95) * 0.015 +
      Math.cos(elapsedSec * 0.6) * 0.006;

    this.coreGlowLight.intensity =
      0.05 + Math.pow(b, 1.1) * (0.06 + 0.015 * Math.sin(elapsedSec * 2.2));

    // 1. Main Corolla Petals & Calyx Sepals: Cascading radial wave + 3-axis organic breathing
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
        (0.25 + 0.75 * b);
      const secondaryHarmonic =
        Math.cos(elapsedSec * 3.3 + item.phaseOffset * 1.7) *
        0.01 *
        (0.2 + 0.8 * b);

      item.mesh.rotation.x = -(basePitch + primaryFlutter + secondaryHarmonic);

      const rollWave =
        Math.sin(elapsedSec * 1.65 + item.phaseOffset * 1.3 - rankDelay * 0.5) *
        0.024 *
        (0.2 + 0.8 * b);
      item.mesh.rotation.z = item.baseRoll * (0.4 + 0.6 * b) + rollWave;

      if (item.normalizedRank >= 0) {
        const breathCupFlex =
          1.0 +
          Math.sin(elapsedSec * 1.95 - rankDelay + item.phaseOffset) *
            0.035 *
            b;
        const budCupScaleZ = (1.28 - 0.24 * b) * breathCupFlex;
        const budWidthScaleX = (0.88 + 0.12 * b) * item.naturalScaleX;
        item.mesh.scale.set(
          budWidthScaleX,
          item.naturalScaleY,
          budCupScaleZ,
        );
      }

      const spiralTwist =
        item.normalizedRank >= 0 ? (1 - b) * 0.22 * item.normalizedRank : 0;
      const azimuthSway =
        Math.cos(elapsedSec * 1.4 + item.phaseOffset) * 0.014 * b;
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
        (0.25 + 0.75 * b);
      budItem.mesh.rotation.x = -(budPitch + flutter);
      budItem.mesh.rotation.z =
        budItem.baseRoll +
        Math.cos(elapsedSec * 1.8 + budItem.phaseOffset) * 0.016 * b;
      const twist = (1 - b) * 0.18 * budItem.normalizedRank;
      budItem.pivot.rotation.y = budItem.baseYaw + twist;
    }

    // 3. Stamens
    for (const st of this.stamenPivots) {
      const baseStamenPitch = evaluateStamenPitchAtBloom(
        st.closedPitch,
        st.openPitch,
        b,
      );
      const pitchSway =
        (Math.sin(elapsedSec * 2.6 + st.phaseOffset) * 0.04 +
          Math.cos(elapsedSec * 4.1 - st.phaseOffset * 0.6) * 0.015) *
        (0.15 + 0.85 * b);
      const rollSway =
        Math.cos(elapsedSec * 2.15 + st.phaseOffset * 1.2) *
        0.034 *
        (0.15 + 0.85 * b);
      st.pivot.rotation.x = -(baseStamenPitch + pitchSway);
      st.pivot.rotation.z = st.baseRoll * b + rollSway;
    }

    // 4. Stem Leaves
    for (const lf of this.leafPivots) {
      const pitchWave =
        Math.sin(elapsedSec * 1.55 + lf.phaseOffset) * 0.028 +
        Math.cos(elapsedSec * 2.7 + lf.phaseOffset) * 0.01;
      const rollWave =
        Math.cos(elapsedSec * 1.35 + lf.phaseOffset * 1.4) * 0.024;
      lf.leafMesh.rotation.x = lf.basePitch + pitchWave;
      lf.leafMesh.rotation.z = lf.baseRoll + rollWave;
    }

    // 5. Floating Pollen Motes
    const haloVisible = b > 0.22;
    this.pollenHaloGroup.visible = haloVisible;
    if (haloVisible) {
      const bloomFactor = clamp((b - 0.22) / 0.78, 0, 1);
      for (const mote of this.pollenMotes) {
        const ang =
          mote.baseAngle +
          elapsedSec * mote.speed * 0.45 +
          Math.sin(elapsedSec + mote.phase) * 0.2;
        const r =
          mote.baseRadius *
          (0.55 + 0.55 * bloomFactor) *
          (1 + 0.12 * Math.sin(elapsedSec * 1.5 + mote.phase));
        const yLift =
          mote.baseY +
          Math.sin(elapsedSec * 1.4 + mote.phase) * 0.018 * bloomFactor;
        mote.mesh.position.set(
          Math.cos(ang) * r,
          yLift,
          Math.sin(ang) * r,
        );
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

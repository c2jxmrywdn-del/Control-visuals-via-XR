import * as THREE from 'three';
import {FLOWER_LIBRARY, type FlowerSpec, clamp} from './gestureMath';

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
const textureCache = new Map<string, THREE.CanvasTexture>();

function getBotanicalNormalTexture(): THREE.CanvasTexture {
  const key = 'shared_normal_veins_lownoise_v4';
  if (textureCache.has(key)) return textureCache.get(key)!;

  const size = 512;
  const hCanvas = document.createElement('canvas');
  hCanvas.width = size;
  hCanvas.height = size;
  const hCtx = hCanvas.getContext('2d')!;

  hCtx.fillStyle = '#808080';
  hCtx.fillRect(0, 0, size, size);

  const midGrad = hCtx.createLinearGradient(224, 0, 288, 0);
  midGrad.addColorStop(0, 'rgba(128,128,128,0)');
  midGrad.addColorStop(0.5, 'rgba(220,220,220,0.35)');
  midGrad.addColorStop(1, 'rgba(128,128,128,0)');
  hCtx.fillStyle = midGrad;
  hCtx.fillRect(224, 0, 64, size);

  for (let i = 0; i < 36; i++) {
    const u = i / 35;
    const spreadX = (u - 0.5) * 480;
    hCtx.beginPath();
    hCtx.moveTo(256 + (u - 0.5) * 36, size);
    hCtx.bezierCurveTo(
      256 + spreadX * 0.3,
      360,
      256 + spreadX * 0.72,
      170,
      256 + spreadX,
      8,
    );
    hCtx.strokeStyle = 'rgba(210,210,210,0.16)';
    hCtx.lineWidth = 2.2;
    hCtx.stroke();
  }

  const srcData = hCtx.getImageData(0, 0, size, size).data;
  const nCanvas = document.createElement('canvas');
  nCanvas.width = size;
  nCanvas.height = size;
  const nCtx = nCanvas.getContext('2d')!;
  const outImg = nCtx.createImageData(size, size);
  const dst = outImg.data;
  const strength = 0.75;

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
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  textureCache.set(key, tex);
  return tex;
}

function getSpeciesPetalTexture(spec: FlowerSpec): THREE.CanvasTexture {
  const key = `albedo_lownoise_v4_${spec.id}`;
  if (textureCache.has(key)) return textureCache.get(key)!;

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    const grad = ctx.createLinearGradient(0, 512, 0, 0);
    if (spec.morphology === 'lotus-pod') {
      grad.addColorStop(0.0, spec.throatColor);
      grad.addColorStop(0.24, spec.secondaryColor);
      grad.addColorStop(0.74, spec.primaryColor);
      grad.addColorStop(1.0, '#d81b60');
    } else if (spec.morphology === 'lily-recurved') {
      grad.addColorStop(0.0, spec.throatColor);
      grad.addColorStop(0.18, spec.primaryColor);
      grad.addColorStop(0.84, spec.primaryColor);
      grad.addColorStop(1.0, spec.secondaryColor);
    } else if (spec.morphology === 'peony-ruffled') {
      grad.addColorStop(0.0, spec.throatColor);
      grad.addColorStop(0.32, spec.primaryColor);
      grad.addColorStop(0.78, '#ff4d6d');
      grad.addColorStop(1.0, spec.secondaryColor);
    } else if (spec.morphology === 'sunflower-capitulum') {
      grad.addColorStop(0.0, spec.throatColor);
      grad.addColorStop(0.2, spec.primaryColor);
      grad.addColorStop(0.88, spec.secondaryColor);
      grad.addColorStop(1.0, '#fff8d6');
    } else {
      grad.addColorStop(0.0, spec.throatColor);
      grad.addColorStop(0.38, spec.primaryColor);
      grad.addColorStop(1.0, spec.secondaryColor);
    }

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    // Soft central nectar glow for depth without grainy spots
    const radialGlow = ctx.createRadialGradient(256, 440, 12, 256, 380, 220);
    radialGlow.addColorStop(0, spec.throatColor);
    radialGlow.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = radialGlow;
    ctx.fillRect(0, 0, 512, 512);
    ctx.globalAlpha = 1.0;

    if (spec.morphology === 'lily-recurved') {
      const edgeLeft = ctx.createLinearGradient(0, 0, 104, 0);
      edgeLeft.addColorStop(0, '#ffffff');
      edgeLeft.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = edgeLeft;
      ctx.fillRect(0, 0, 104, 512);

      const edgeRight = ctx.createLinearGradient(512, 0, 408, 0);
      edgeRight.addColorStop(0, '#ffffff');
      edgeRight.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = edgeRight;
      ctx.fillRect(408, 0, 104, 512);
    }

    for (let i = 0; i < 32; i++) {
      const u = i / 31;
      const spreadX = (u - 0.5) * 475;
      ctx.beginPath();
      ctx.moveTo(256 + (u - 0.5) * 42, 512);
      ctx.quadraticCurveTo(256 + spreadX * 0.52, 256, 256 + spreadX, 10);
      ctx.strokeStyle =
        spec.morphology === 'waterlily-stellate'
          ? 'rgba(128, 255, 219, 0.22)'
          : 'rgba(255, 255, 255, 0.09)';
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  textureCache.set(key, tex);
  return tex;
}

function createSculptedPetalGeometry(
  length: number,
  width: number,
  cupDepth: number,
  ruffleFreq: number,
  ruffleAmp: number,
  tipNotchDepth: number,
  widthTipBias = 0.62,
  aoDarkenFactor = 0.32,
  recurvedFactor = 0.28,
): THREE.BufferGeometry {
  const segU = 32;
  const segV = 36;
  const geometry = new THREE.PlaneGeometry(1, 1, segU, segV);
  const pos = geometry.attributes.position;
  const colors = new Float32Array(pos.count * 3);

  for (let i = 0; i < pos.count; i++) {
    const rawX = pos.getX(i);
    const rawY = pos.getY(i);

    const u = rawX * 2; // -1 .. +1
    const v = rawY + 0.5; // 0 .. 1

    const clawNarrowing =
      0.15 + 0.85 * Math.sin(Math.pow(v, widthTipBias) * Math.PI);
    const frillEdge =
      tipNotchDepth > 0.005
        ? 1 +
          Math.cos(u * Math.PI * 3.0) * tipNotchDepth * 0.14 * Math.pow(v, 2)
        : 1;
    const x = u * (width * 0.5) * clawNarrowing * frillEdge;

    // Smooth organic cleft instead of spiky sawtooth
    const smoothCleft = (1 - Math.cos(u * Math.PI * 2)) * 0.5;
    const tipNotch =
      tipNotchDepth > 0.005 && v > 0.78
        ? smoothCleft *
          tipNotchDepth *
          length *
          Math.pow((v - 0.78) / 0.22, 1.6)
        : 0;
    const y = v * length - tipNotch;

    const cupZ = +(u * u) * width * cupDepth * Math.sin(v * Math.PI) * 0.75;
    const bellyZ = -Math.sin(v * Math.PI) * length * cupDepth * 0.24;
    const tipReflexZ =
      -Math.pow(Math.max(0, v - 0.52) / 0.48, 1.85) * length * recurvedFactor;

    const keelZ = -Math.exp(-Math.abs(u) * 8) * 0.004 * Math.sin(v * Math.PI);
    const ruffleZ =
      Math.sin(u * Math.PI * ruffleFreq) *
      ruffleAmp *
      Math.pow(v, 1.6) *
      Math.pow(Math.abs(u), 1.35);

    const z = cupZ + bellyZ + tipReflexZ + keelZ + ruffleZ;
    pos.setXYZ(i, x, y, z);

    const ao = clamp(1 - Math.pow(1 - v, 1.4) * aoDarkenFactor, 0.48, 1.04);
    const edgeRim = Math.pow(Math.abs(u), 2.4) * 0.07 * v;
    const lum = clamp(ao + edgeRim, 0.46, 1.08);
    colors[i * 3] = lum;
    colors[i * 3 + 1] = lum;
    colors[i * 3 + 2] = lum;
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

export class ProceduralFlowerModel extends THREE.Group {
  readonly spec: FlowerSpec;
  private readonly flowerHeadGroup = new THREE.Group();
  private readonly companionBudGroup = new THREE.Group();
  private readonly petalPivots: PetalPivotData[] = [];
  private readonly stamenPivots: StamenPivotData[] = [];
  private readonly materialsToDispose: THREE.Material[] = [];
  private readonly geometriesToDispose: THREE.BufferGeometry[] = [];
  private coreGlowLight: THREE.PointLight;
  private currentBloom01 = 0.78;

  constructor(spec: FlowerSpec) {
    super();
    this.spec = spec;
    this.name = `Flower_${spec.id}`;

    this.scale.setScalar(1.38);

    this.flowerHeadGroup.position.set(0, 0.06, 0);
    this.add(this.flowerHeadGroup);

    this.coreGlowLight = new THREE.PointLight(spec.coreColor, 0.9, 1.2, 1.5);
    this.coreGlowLight.position.set(0, 0.11, 0);
    this.flowerHeadGroup.add(this.coreGlowLight);

    this.buildStemFoliageAndFloatingPads();
    this.buildSpeciesCoreAndReproductiveOrgans();
    this.buildSepalsAndMorphologyCorolla();
    this.buildCrystalDewdrops();
    this.setBloom(0.78, 0);
  }

  private buildStemFoliageAndFloatingPads(): void {
    const normalTex = getBotanicalNormalTexture();

    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.34, 0.014),
      new THREE.Vector3(-0.012, -0.2, -0.008),
      new THREE.Vector3(0.008, -0.07, 0.006),
      new THREE.Vector3(0, 0.06, 0),
    ]);
    const stemGeo = new THREE.TubeGeometry(curve, 32, 0.0145, 14, false);
    const stemMat = new THREE.MeshPhysicalMaterial({
      color: this.spec.stemColor,
      roughness: 0.48,
      metalness: 0.02,
      clearcoat: 0.25,
      clearcoatRoughness: 0.35,
    });
    const stemMesh = new THREE.Mesh(stemGeo, stemMat);
    stemMesh.castShadow = true;
    stemMesh.receiveShadow = true;
    this.add(stemMesh);
    this.geometriesToDispose.push(stemGeo);
    this.materialsToDispose.push(stemMat);

    const recepGeo = new THREE.CylinderGeometry(0.038, 0.015, 0.04, 24);
    const recepMesh = new THREE.Mesh(recepGeo, stemMat);
    recepMesh.position.set(0, 0.044, 0);
    this.add(recepMesh);
    this.geometriesToDispose.push(recepGeo);

    const leafGeo = createSculptedPetalGeometry(
      0.21,
      0.098,
      0.25,
      2.5,
      0.008,
      0.04,
      0.52,
      0.26,
      0.32,
    );
    const leafMat = new THREE.MeshPhysicalMaterial({
      color: '#3b8764',
      vertexColors: true,
      roughness: 0.36,
      metalness: 0.02,
      clearcoat: 0.35,
      normalMap: normalTex,
      normalScale: new THREE.Vector2(0.45, 0.45),
      side: THREE.DoubleSide,
    });
    this.geometriesToDispose.push(leafGeo);
    this.materialsToDispose.push(leafMat);

    const leafConfigs = [
      {y: -0.1, yaw: 0.65, pitch: -1.06, scale: 1.06},
      {y: -0.18, yaw: -2.1, pitch: -1.14, scale: 1.18},
      {y: -0.25, yaw: 2.3, pitch: -1.12, scale: 0.96},
      {y: -0.3, yaw: -0.85, pitch: -1.2, scale: 0.88},
    ];
    for (const cfg of leafConfigs) {
      const pivot = new THREE.Group();
      pivot.position.set(0, cfg.y, 0);
      pivot.rotation.y = -cfg.yaw - Math.PI / 2;
      const leaf = new THREE.Mesh(leafGeo, leafMat);
      leaf.rotation.x = cfg.pitch;
      leaf.scale.setScalar(cfg.scale);
      leaf.castShadow = true;
      leaf.receiveShadow = true;
      pivot.add(leaf);
      this.add(pivot);
    }

    const sideBranchCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.2, 0),
      new THREE.Vector3(0.085, -0.11, 0.03),
      new THREE.Vector3(0.145, -0.01, 0.04),
    ]);
    const sideStemGeo = new THREE.TubeGeometry(
      sideBranchCurve,
      16,
      0.007,
      8,
      false,
    );
    const sideStemMesh = new THREE.Mesh(sideStemGeo, stemMat);
    this.add(sideStemMesh);
    this.geometriesToDispose.push(sideStemGeo);

    this.companionBudGroup.position.set(0.145, -0.01, 0.04);
    this.companionBudGroup.rotation.z = -0.38;
    this.companionBudGroup.rotation.x = 0.15;
    const budPetalGeo = createSculptedPetalGeometry(
      0.095,
      0.052,
      0.5,
      1.5,
      0.003,
      0,
      0.55,
      0.22,
      0.0,
    );
    const budPetalMat = new THREE.MeshPhysicalMaterial({
      map: getSpeciesPetalTexture(this.spec),
      roughness: 0.34,
      sheen: 0.65,
      normalMap: normalTex,
      normalScale: new THREE.Vector2(0.35, 0.35),
      side: THREE.DoubleSide,
    });
    this.geometriesToDispose.push(budPetalGeo);
    this.materialsToDispose.push(budPetalMat);

    for (let i = 0; i < 8; i++) {
      const yaw = i * GOLDEN_ANGLE;
      const p = new THREE.Group();
      p.position.set(Math.cos(yaw) * 0.012, 0, Math.sin(yaw) * 0.012);
      p.rotation.y = -yaw - Math.PI / 2;
      const m = new THREE.Mesh(budPetalGeo, budPetalMat);
      m.rotation.x = -(0.12 + (i / 8) * 0.22);
      p.add(m);
      this.companionBudGroup.add(p);
    }
    this.add(this.companionBudGroup);
  }

  private buildSpeciesCoreAndReproductiveOrgans(): void {
    const morph = this.spec.morphology;

    if (morph === 'lotus-pod') {
      const podGeo = new THREE.CylinderGeometry(0.054, 0.022, 0.056, 32);
      const podMat = new THREE.MeshPhysicalMaterial({
        color: '#d4b838',
        roughness: 0.45,
        clearcoat: 0.18,
      });
      const podMesh = new THREE.Mesh(podGeo, podMat);
      podMesh.position.y = 0.028;
      this.flowerHeadGroup.add(podMesh);
      this.geometriesToDispose.push(podGeo);
      this.materialsToDispose.push(podMat);

      const seedGeo = new THREE.SphereGeometry(0.006, 10, 10);
      seedGeo.scale(1, 1.38, 1);
      const seedMat = new THREE.MeshStandardMaterial({
        color: '#9ef01a',
        roughness: 0.28,
      });
      this.geometriesToDispose.push(seedGeo);
      this.materialsToDispose.push(seedMat);

      const seedCoords = [
        [0, 0],
        ...Array.from({length: 5}, (_, i) => [
          Math.cos((i * Math.PI * 2) / 5) * 0.019,
          Math.sin((i * Math.PI * 2) / 5) * 0.019,
        ]),
        ...Array.from({length: 10}, (_, i) => [
          Math.cos((i * Math.PI * 2) / 10 + 0.3) * 0.037,
          Math.sin((i * Math.PI * 2) / 10 + 0.3) * 0.037,
        ]),
      ];
      for (const [sx, sz] of seedCoords) {
        const sMesh = new THREE.Mesh(seedGeo, seedMat);
        sMesh.position.set(sx, 0.057, sz);
        this.flowerHeadGroup.add(sMesh);
      }
    } else if (morph === 'sunflower-capitulum') {
      const discGeo = new THREE.CylinderGeometry(0.118, 0.088, 0.034, 36);
      const discMat = new THREE.MeshStandardMaterial({
        color: '#3b1f0e',
        roughness: 0.72,
      });
      const discMesh = new THREE.Mesh(discGeo, discMat);
      discMesh.position.y = 0.022;
      this.flowerHeadGroup.add(discMesh);
      this.geometriesToDispose.push(discGeo);
      this.materialsToDispose.push(discMat);

      const floretCount = 160;
      const floretGeo = new THREE.SphereGeometry(0.0056, 7, 7);
      floretGeo.scale(1, 1.45, 1);
      const floretMat = new THREE.MeshStandardMaterial({
        color: '#d97706',
        roughness: 0.45,
      });
      const floretInst = new THREE.InstancedMesh(
        floretGeo,
        floretMat,
        floretCount,
      );
      const dummy = new THREE.Object3D();
      for (let i = 0; i < floretCount; i++) {
        const r = Math.sqrt(i / floretCount) * 0.11;
        const theta = i * GOLDEN_ANGLE;
        const domeY = 0.038 + (1 - (r / 0.115) * (r / 0.115)) * 0.02;
        dummy.position.set(Math.cos(theta) * r, domeY, Math.sin(theta) * r);
        dummy.scale.setScalar(0.75 + (i / floretCount) * 0.45);
        dummy.updateMatrix();
        floretInst.setMatrixAt(i, dummy.matrix);
      }
      floretInst.instanceMatrix.needsUpdate = true;
      this.flowerHeadGroup.add(floretInst);
      this.geometriesToDispose.push(floretGeo);
      this.materialsToDispose.push(floretMat);
      return;
    } else if (morph === 'orchid-zygomorphic') {
      const colGeo = new THREE.CapsuleGeometry(0.016, 0.034, 8, 16);
      const colMat = new THREE.MeshPhysicalMaterial({
        color: '#fff0f6',
        roughness: 0.24,
        clearcoat: 0.5,
      });
      const colMesh = new THREE.Mesh(colGeo, colMat);
      colMesh.position.set(0, 0.048, 0.012);
      colMesh.rotation.x = 0.45;
      this.flowerHeadGroup.add(colMesh);
      this.geometriesToDispose.push(colGeo);
      this.materialsToDispose.push(colMat);
      return;
    }

    const isLily = morph === 'lily-recurved';
    const stamenCount = isLily ? 6 : 64;
    const filLen = isLily ? 0.21 : 0.112;
    const filamentGeo = new THREE.CylinderGeometry(
      isLily ? 0.003 : 0.0018,
      isLily ? 0.0042 : 0.0026,
      filLen,
      8,
    );
    filamentGeo.translate(0, filLen * 0.5, 0);

    const antherGeo = new THREE.SphereGeometry(isLily ? 0.0105 : 0.0058, 8, 8);
    if (isLily) {
      antherGeo.scale(0.68, 3.0, 0.78);
      antherGeo.rotateZ(1.25);
    } else {
      antherGeo.scale(0.85, 1.75, 0.85);
    }
    antherGeo.translate(0, filLen + 0.0035, 0);

    const filamentMat = new THREE.MeshStandardMaterial({
      color: this.spec.coreColor,
      emissive: this.spec.coreColor,
      emissiveIntensity: 0.22,
      roughness: 0.28,
    });
    const antherMat = new THREE.MeshStandardMaterial({
      color: this.spec.stamenColor,
      emissive: this.spec.stamenColor,
      emissiveIntensity: 0.48,
      roughness: 0.28,
    });
    this.geometriesToDispose.push(filamentGeo, antherGeo);
    this.materialsToDispose.push(filamentMat, antherMat);

    if (isLily) {
      const styleGeo = new THREE.CylinderGeometry(0.0038, 0.0048, 0.24, 10);
      styleGeo.translate(0, 0.12, 0);
      const stigmaGeo = new THREE.SphereGeometry(0.0125, 10, 10);
      stigmaGeo.translate(0, 0.24, 0);
      const styleMesh = new THREE.Mesh(styleGeo, filamentMat);
      const stigmaMesh = new THREE.Mesh(stigmaGeo, antherMat);
      this.flowerHeadGroup.add(styleMesh, stigmaMesh);
      this.geometriesToDispose.push(styleGeo, stigmaGeo);
    } else if (morph !== 'lotus-pod') {
      // Sculpted central gynoecium / pistil cluster (雌蕊心皮群) for peony, camellia, waterlily, iris
      const carpelGeo = new THREE.ConeGeometry(0.018, 0.052, 12);
      carpelGeo.translate(0, 0.032, 0);
      const stigmaCrownGeo = new THREE.DodecahedronGeometry(0.012, 1);
      stigmaCrownGeo.translate(0, 0.06, 0);
      const carpelMesh = new THREE.Mesh(carpelGeo, filamentMat);
      const stigmaCrownMesh = new THREE.Mesh(stigmaCrownGeo, antherMat);
      this.flowerHeadGroup.add(carpelMesh, stigmaCrownMesh);
      this.geometriesToDispose.push(carpelGeo, stigmaCrownGeo);
    }

    for (let i = 0; i < stamenCount; i++) {
      const t = i / stamenCount;
      const yaw = isLily ? (i / 6) * Math.PI * 2 : i * GOLDEN_ANGLE;
      const radius = isLily
        ? 0.024
        : morph === 'lotus-pod'
          ? 0.052 + t * 0.02
          : 0.018 + t * 0.032;

      const pivot = new THREE.Group();
      pivot.position.set(
        Math.cos(yaw) * radius,
        0.026,
        Math.sin(yaw) * radius,
      );
      pivot.rotation.y = -yaw - Math.PI / 2;

      const fMesh = new THREE.Mesh(filamentGeo, filamentMat);
      const aMesh = new THREE.Mesh(antherGeo, antherMat);
      pivot.add(fMesh, aMesh);
      this.flowerHeadGroup.add(pivot);

      this.stamenPivots.push({
        pivot,
        closedPitch: 0.08 + t * 0.14,
        openPitch: isLily ? 0.52 : 0.42 + t * 0.68,
        phaseOffset: i * 0.37,
      });
    }
  }

  private buildSepalsAndMorphologyCorolla(): void {
    const normalTex = getBotanicalNormalTexture();
    const albedoTex = getSpeciesPetalTexture(this.spec);
    const morph = this.spec.morphology;

    const sepalCount = morph === 'sunflower-capitulum' ? 18 : 6;
    const sepalGeo = createSculptedPetalGeometry(
      0.125,
      0.054,
      0.26,
      1.0,
      0.002,
      0,
      0.5,
      0.25,
      0.22,
    );
    const sepalMat = new THREE.MeshPhysicalMaterial({
      color: '#3b7a57',
      vertexColors: true,
      roughness: 0.44,
      metalness: 0.02,
      normalMap: normalTex,
      normalScale: new THREE.Vector2(0.35, 0.35),
      side: THREE.DoubleSide,
    });
    this.geometriesToDispose.push(sepalGeo);
    this.materialsToDispose.push(sepalMat);

    for (let i = 0; i < sepalCount; i++) {
      const yaw = (i / sepalCount) * Math.PI * 2;
      const rad = morph === 'sunflower-capitulum' ? 0.092 : 0.028;
      const pivot = new THREE.Group();
      pivot.position.set(Math.cos(yaw) * rad, 0.008, Math.sin(yaw) * rad);
      const baseYaw = -yaw - Math.PI / 2;
      pivot.rotation.y = baseYaw;

      const mesh = new THREE.Mesh(sepalGeo, sepalMat);
      pivot.add(mesh);
      this.flowerHeadGroup.add(pivot);

      this.petalPivots.push({
        pivot,
        mesh,
        normalizedRank: -1,
        closedPitch: 0.36,
        openPitch: 1.62,
        baseYaw,
        phaseOffset: i * 0.7,
      });
    }

    const isBioluminescent = morph === 'waterlily-stellate';
    const petalMaterial = new THREE.MeshPhysicalMaterial({
      map: albedoTex,
      vertexColors: true,
      roughness: 0.36,
      metalness: 0.01,
      transmission: 0.03,
      thickness: 0.06,
      sheen: 0.85,
      sheenRoughness: 0.32,
      sheenColor: new THREE.Color(this.spec.secondaryColor),
      clearcoat: 0.14,
      clearcoatRoughness: 0.36,
      normalMap: normalTex,
      normalScale: new THREE.Vector2(0.16, 0.16),
      emissive: new THREE.Color(
        isBioluminescent ? this.spec.primaryColor : this.spec.throatColor,
      ),
      emissiveIntensity: isBioluminescent ? 0.34 : 0.06,
      side: THREE.DoubleSide,
    });
    this.materialsToDispose.push(petalMaterial);

    if (morph === 'orchid-zygomorphic') {
      this.buildOrchidCorolla(petalMaterial, normalTex);
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
        ? 0.46
        : 0.64;
    const recurve = morph === 'peony-ruffled' ? 0.28 : 0.24;

    const tierGeometries = [0.2, 0.45, 0.72, 1.0].map((tierT) => {
      const lenScale =
        0.54 + 0.54 * Math.sin(Math.pow(tierT, 0.65) * (Math.PI / 2));
      const widScale = 0.65 + 0.42 * tierT;
      const aoFactor = 0.48 - tierT * 0.22;
      const geo = createSculptedPetalGeometry(
        this.spec.petalLength * lenScale,
        this.spec.petalWidth * widScale,
        this.spec.cupDepth * (1.05 - tierT * 0.25),
        this.spec.ruffleFrequency,
        this.spec.ruffleAmplitude * (0.7 + 0.5 * tierT),
        this.spec.tipNotchDepth,
        widthBias,
        aoFactor,
        recurve * tierT,
      );
      this.geometriesToDispose.push(geo);
      return geo;
    });

    const isSunflower = morph === 'sunflower-capitulum';
    const minR = isSunflower ? 0.094 : morph === 'lotus-pod' ? 0.048 : 0.026;
    const maxR = isSunflower ? 0.116 : 0.062;

    for (let i = 0; i < totalPetals; i++) {
      const rank01 = i / Math.max(1, totalPetals - 1);
      const yaw = i * GOLDEN_ANGLE;
      const r = minR + (maxR - minR) * Math.sqrt(rank01);
      const yOffset = 0.028 - rank01 * 0.018;

      const tierIdx = Math.min(3, Math.floor(rank01 * 4));
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

      const closedPitch = isSunflower
        ? 0.24 + rank01 * 0.22
        : 0.04 + Math.pow(rank01, 1.15) * 0.24;
      // Expanded inner-petal openPitch (starts at 0.72 rad = ~41 deg instead of 0.26 rad)
      // so the innermost petals unfurl wide open and never obstruct the central stamens (花蕊)!
      const openPitch = isSunflower
        ? this.spec.maxOpenAngleRad * (0.92 + rank01 * 0.16)
        : 0.72 + Math.pow(rank01, 0.65) * (this.spec.maxOpenAngleRad - 0.56);

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
    const geoOuter = createSculptedPetalGeometry(
      this.spec.petalLength * 1.04,
      this.spec.petalWidth * 1.05,
      this.spec.cupDepth,
      this.spec.ruffleFrequency,
      this.spec.ruffleAmplitude,
      0,
      0.48,
      0.24,
      0.48,
    );
    const geoInner = createSculptedPetalGeometry(
      this.spec.petalLength * 0.94,
      this.spec.petalWidth * 1.12,
      this.spec.cupDepth,
      this.spec.ruffleFrequency,
      this.spec.ruffleAmplitude,
      0,
      0.5,
      0.32,
      0.42,
    );
    this.geometriesToDispose.push(geoOuter, geoInner);

    for (let ring = 0; ring < 2; ring++) {
      const count = 6;
      for (let i = 0; i < count; i++) {
        const yaw = (i / count) * Math.PI * 2 + ring * (Math.PI / 6);
        const r = 0.026 - ring * 0.005;
        const pivot = new THREE.Group();
        pivot.position.set(
          Math.cos(yaw) * r,
          0.018 + ring * 0.006,
          Math.sin(yaw) * r,
        );
        const baseYaw = -yaw - Math.PI / 2;
        pivot.rotation.y = baseYaw;

        const mesh = new THREE.Mesh(
          ring === 0 ? geoOuter : geoInner,
          petalMaterial,
        );
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        pivot.add(mesh);
        this.flowerHeadGroup.add(pivot);

        this.petalPivots.push({
          pivot,
          mesh,
          normalizedRank: ring === 0 ? 0.85 : 0.45,
          closedPitch: 0.1 + (1 - ring) * 0.08,
          openPitch: this.spec.maxOpenAngleRad * (ring === 0 ? 1.06 : 0.92),
          baseYaw,
          phaseOffset: i * 0.7 + ring,
        });
      }
    }
  }

  private buildOrchidCorolla(
    petalMaterial: THREE.MeshPhysicalMaterial,
    normalTex: THREE.CanvasTexture,
  ): void {
    const sepalGeo = createSculptedPetalGeometry(
      0.25,
      0.13,
      0.22,
      1.5,
      0.005,
      0,
      0.58,
      0.2,
      0.18,
    );
    const wingGeo = createSculptedPetalGeometry(
      0.27,
      0.22,
      0.28,
      2.5,
      0.012,
      0.03,
      0.68,
      0.18,
      0.16,
    );
    const lipGeo = createSculptedPetalGeometry(
      0.19,
      0.14,
      0.65,
      4.0,
      0.022,
      0.18,
      0.7,
      0.1,
      0.12,
    );
    const lipMat = new THREE.MeshPhysicalMaterial({
      color: '#ff2a85',
      roughness: 0.26,
      sheen: 0.9,
      normalMap: normalTex,
      normalScale: new THREE.Vector2(0.5, 0.5),
      side: THREE.DoubleSide,
    });
    this.geometriesToDispose.push(sepalGeo, wingGeo, lipGeo);
    this.materialsToDispose.push(lipMat);

    const sepalAngles = [Math.PI * 0.5, Math.PI * 1.2, Math.PI * 1.8];
    sepalAngles.forEach((yaw, i) => {
      const pivot = new THREE.Group();
      pivot.position.set(Math.cos(yaw) * 0.02, 0.02, Math.sin(yaw) * 0.02);
      const baseYaw = -yaw - Math.PI / 2;
      pivot.rotation.y = baseYaw;
      const mesh = new THREE.Mesh(sepalGeo, petalMaterial);
      pivot.add(mesh);
      this.flowerHeadGroup.add(pivot);
      this.petalPivots.push({
        pivot,
        mesh,
        normalizedRank: 0.85,
        closedPitch: 0.22,
        openPitch: 1.48,
        baseYaw,
        phaseOffset: i,
      });
    });

    const wingAngles = [0.12, Math.PI - 0.12];
    wingAngles.forEach((yaw, i) => {
      const pivot = new THREE.Group();
      pivot.position.set(Math.cos(yaw) * 0.022, 0.026, Math.sin(yaw) * 0.022);
      const baseYaw = -yaw - Math.PI / 2;
      pivot.rotation.y = baseYaw;
      const mesh = new THREE.Mesh(wingGeo, petalMaterial);
      pivot.add(mesh);
      this.flowerHeadGroup.add(pivot);
      this.petalPivots.push({
        pivot,
        mesh,
        normalizedRank: 0.55,
        closedPitch: 0.15,
        openPitch: 1.42,
        baseYaw,
        phaseOffset: i + 2,
      });
    });

    const lipPivot = new THREE.Group();
    lipPivot.position.set(0, 0.022, 0.028);
    const lipBaseYaw = 0;
    lipPivot.rotation.y = lipBaseYaw;
    const lipMesh = new THREE.Mesh(lipGeo, lipMat);
    lipPivot.add(lipMesh);
    this.flowerHeadGroup.add(lipPivot);
    this.petalPivots.push({
      pivot: lipPivot,
      mesh: lipMesh,
      normalizedRank: 0.3,
      closedPitch: 0.18,
      openPitch: 1.32,
      baseYaw: lipBaseYaw,
      phaseOffset: 4,
    });
  }

  private buildIrisCorolla(petalMaterial: THREE.MeshPhysicalMaterial): void {
    const fallGeo = createSculptedPetalGeometry(
      0.27,
      0.165,
      0.38,
      5.5,
      0.024,
      0.05,
      0.66,
      0.25,
      0.58,
    );
    const standardGeo = createSculptedPetalGeometry(
      0.25,
      0.155,
      0.48,
      5.0,
      0.022,
      0.04,
      0.64,
      0.22,
      -0.12,
    );
    const beardGeo = new THREE.CapsuleGeometry(0.0085, 0.082, 6, 12);
    beardGeo.translate(0, 0.06, 0.015);
    const beardMat = new THREE.MeshStandardMaterial({
      color: '#ffbe0b',
      emissive: '#fb8500',
      emissiveIntensity: 0.45,
      roughness: 0.5,
    });
    this.geometriesToDispose.push(fallGeo, standardGeo, beardGeo);
    this.materialsToDispose.push(beardMat);

    for (let i = 0; i < 3; i++) {
      const yaw = (i / 3) * Math.PI * 2;
      const pivot = new THREE.Group();
      pivot.position.set(Math.cos(yaw) * 0.032, 0.018, Math.sin(yaw) * 0.032);
      const baseYaw = -yaw - Math.PI / 2;
      pivot.rotation.y = baseYaw;

      const mesh = new THREE.Mesh(fallGeo, petalMaterial);
      const beard = new THREE.Mesh(beardGeo, beardMat);
      mesh.add(beard);
      pivot.add(mesh);
      this.flowerHeadGroup.add(pivot);

      this.petalPivots.push({
        pivot,
        mesh,
        normalizedRank: 0.85,
        closedPitch: 0.28,
        openPitch: 1.56,
        baseYaw,
        phaseOffset: i,
      });
    }

    for (let i = 0; i < 3; i++) {
      const yaw = (i / 3) * Math.PI * 2 + Math.PI / 3;
      const pivot = new THREE.Group();
      pivot.position.set(Math.cos(yaw) * 0.026, 0.028, Math.sin(yaw) * 0.026);
      const baseYaw = -yaw - Math.PI / 2;
      pivot.rotation.y = baseYaw;

      const mesh = new THREE.Mesh(standardGeo, petalMaterial);
      pivot.add(mesh);
      this.flowerHeadGroup.add(pivot);

      this.petalPivots.push({
        pivot,
        mesh,
        normalizedRank: 0.35,
        closedPitch: 0.08,
        openPitch: 0.72,
        baseYaw,
        phaseOffset: i + 3,
      });
    }
  }

  private buildCrystalDewdrops(): void {
    const dropGeo = new THREE.SphereGeometry(0.0052, 12, 12);
    dropGeo.scale(1, 0.72, 1);
    const dropMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.02,
      metalness: 0.0,
      transmission: 0.92,
      ior: 1.333,
      thickness: 0.02,
      clearcoat: 1.0,
    });
    this.geometriesToDispose.push(dropGeo);
    this.materialsToDispose.push(dropMat);

    const outerPetals = this.petalPivots.filter((p) => p.normalizedRank >= 0.55);
    for (let i = 0; i < Math.min(8, outerPetals.length); i += 2) {
      const targetPetal = outerPetals[i];
      const drop = new THREE.Mesh(dropGeo, dropMat);
      drop.position.set(
        (i % 3 === 0 ? 1 : -1) * 0.015,
        this.spec.petalLength * 0.55,
        0.012,
      );
      targetPetal.mesh.add(drop);
    }
  }

  setBloom(bloom01: number, elapsedSec: number): void {
    this.currentBloom01 = clamp(bloom01, 0, 1);
    const b = this.currentBloom01;

    this.flowerHeadGroup.position.y =
      0.06 + Math.sin(elapsedSec * 1.5) * 0.005;
    this.flowerHeadGroup.rotation.z = Math.sin(elapsedSec * 0.9) * 0.012;

    this.coreGlowLight.intensity = 0.55 + Math.pow(b, 1.2) * 2.35;

    for (const item of this.petalPivots) {
      let layerProgress = b;
      if (item.normalizedRank < 0) {
        layerProgress = clamp(b / 0.45, 0, 1);
      } else {
        // Inner petals begin opening earlier (at 18% bloom instead of 25%) so the stamens are revealed generously
        const startAt = (1 - item.normalizedRank) * 0.18;
        const span = 1 - startAt;
        layerProgress = clamp((b - startAt) / Math.max(0.18, span), 0, 1);
      }

      const smoothP =
        layerProgress * layerProgress * (3 - 2 * layerProgress);
      const flutter =
        Math.sin(elapsedSec * 2.1 + item.phaseOffset) *
        0.012 *
        (0.25 + 0.75 * smoothP);

      const pitch =
        item.closedPitch +
        (item.openPitch - item.closedPitch) * smoothP +
        flutter;
      // Negative X rotation opens the petal outward so its +Z front face points upward toward camera & light!
      item.mesh.rotation.x = -pitch;

      const spiralTwist = (1 - smoothP) * 0.22;
      item.pivot.rotation.y = item.baseYaw + spiralTwist;
    }

    const stamenProgress = clamp((b - 0.12) / 0.88, 0, 1);
    for (const st of this.stamenPivots) {
      const sway =
        Math.sin(elapsedSec * 2.6 + st.phaseOffset) * 0.02 * stamenProgress;
      st.pivot.rotation.x = -(
        st.closedPitch +
        (st.openPitch - st.closedPitch) * stamenProgress +
        sway
      );
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

import * as THREE from 'three';
import {FLOWER_LIBRARY, type FlowerSpec, clamp} from './gestureMath';

interface PetalPivotData {
  pivot: THREE.Group;
  mesh: THREE.Mesh;
  layerIndex: number;
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

let sharedPetalVeinsTexture: THREE.CanvasTexture | null = null;

function getPetalVeinsTexture(): THREE.CanvasTexture {
  if (sharedPetalVeinsTexture) return sharedPetalVeinsTexture;

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, 512, 512);

    for (let i = 0; i < 64; i++) {
      const u = i / 63;
      const spreadX = (u - 0.5) * 480;
      ctx.beginPath();
      ctx.moveTo(256 + (u - 0.5) * 70, 512);
      ctx.quadraticCurveTo(256 + spreadX * 0.55, 256, 256 + spreadX, 12);
      ctx.strokeStyle =
        i % 3 === 0 ? 'rgba(255,255,255,0.28)' : 'rgba(60,60,60,0.22)';
      ctx.lineWidth = i % 3 === 0 ? 2.2 : 1.2;
      ctx.stroke();
    }

    const grad = ctx.createLinearGradient(0, 512, 0, 0);
    grad.addColorStop(0, 'rgba(255,255,255,0.18)');
    grad.addColorStop(0.5, 'rgba(128,128,128,0.08)');
    grad.addColorStop(1, 'rgba(220,220,220,0.25)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);
  }

  sharedPetalVeinsTexture = new THREE.CanvasTexture(canvas);
  sharedPetalVeinsTexture.wrapS = THREE.ClampToEdgeWrapping;
  sharedPetalVeinsTexture.wrapT = THREE.ClampToEdgeWrapping;
  sharedPetalVeinsTexture.needsUpdate = true;
  return sharedPetalVeinsTexture;
}

function createSculptedPetalGeometry(
  length: number,
  width: number,
  cupDepth: number,
  ruffleFreq: number,
  ruffleAmp: number,
  baseColorHex: string,
  tipColorHex: string,
  coreColorHex: string,
  widthTipBias = 0.65,
): THREE.BufferGeometry {
  const segU = 22;
  const segV = 28;
  const geometry = new THREE.PlaneGeometry(1, 1, segU, segV);
  const pos = geometry.attributes.position;

  const colors = new Float32Array(pos.count * 3);
  const cBase = new THREE.Color(coreColorHex);
  const cMid = new THREE.Color(baseColorHex);
  const cTip = new THREE.Color(tipColorHex);
  const tmpColor = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const rawX = pos.getX(i);
    const rawY = pos.getY(i);

    const u = rawX * 2;
    const v = rawY + 0.5;

    const envelope =
      Math.sin(Math.pow(v, widthTipBias) * Math.PI) *
      (1 - 0.12 * Math.pow(v, 3));
    const x = u * (width * 0.5) * Math.max(0.06, envelope);
    const y = v * length;

    const archZ = Math.sin(v * Math.PI) * length * cupDepth * 0.45;
    const tipReflexZ = -Math.pow(Math.max(0, v - 0.68) / 0.32, 2.1) * length * 0.16;
    const cupZ = -(u * u) * width * cupDepth * Math.sin(v * Math.PI) * 0.65;
    const ruffleZ =
      Math.sin(u * Math.PI * ruffleFreq) *
      ruffleAmp *
      Math.pow(v, 1.8) *
      Math.abs(u);

    const z = archZ + tipReflexZ + cupZ + ruffleZ;
    pos.setXYZ(i, x, y, z);

    if (v < 0.22) {
      tmpColor.lerpColors(cBase, cMid, v / 0.22);
    } else {
      tmpColor.lerpColors(cMid, cTip, (v - 0.22) / 0.78);
    }
    const edgeShade = Math.pow(Math.abs(u), 2.2) * 0.06;
    tmpColor.offsetHSL(0, 0.05, edgeShade);

    colors[i * 3] = tmpColor.r;
    colors[i * 3 + 1] = tmpColor.g;
    colors[i * 3 + 2] = tmpColor.b;
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

export class ProceduralFlowerModel extends THREE.Group {
  readonly spec: FlowerSpec;
  private readonly flowerHeadGroup = new THREE.Group();
  private readonly petalPivots: PetalPivotData[] = [];
  private readonly stamenPivots: StamenPivotData[] = [];
  private readonly materialsToDispose: THREE.Material[] = [];
  private readonly geometriesToDispose: THREE.BufferGeometry[] = [];
  private coreGlowLight: THREE.PointLight;
  private receptacleMesh!: THREE.Mesh;
  private currentBloom01 = 0.35;

  constructor(spec: FlowerSpec) {
    super();
    this.spec = spec;
    this.name = `Flower_${spec.id}`;

    this.flowerHeadGroup.position.set(0, 0.04, 0);
    this.add(this.flowerHeadGroup);

    this.coreGlowLight = new THREE.PointLight(spec.coreColor, 0.5, 0.9, 1.6);
    this.coreGlowLight.position.set(0, 0.09, 0);
    this.flowerHeadGroup.add(this.coreGlowLight);

    this.buildStemAndLeaves();
    this.buildReceptacleAndStamens();
    this.buildSepalsAndPetalRings();
    this.setBloom(0.35, 0);
  }

  private buildStemAndLeaves(): void {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.46, 0.02),
      new THREE.Vector3(-0.014, -0.28, -0.01),
      new THREE.Vector3(0.01, -0.12, 0.008),
      new THREE.Vector3(0, 0.04, 0),
    ]);
    const stemGeo = new THREE.TubeGeometry(curve, 28, 0.013, 12, false);
    const stemMat = new THREE.MeshPhysicalMaterial({
      color: this.spec.stemColor,
      roughness: 0.55,
      metalness: 0.02,
      clearcoat: 0.18,
      clearcoatRoughness: 0.4,
    });
    const stemMesh = new THREE.Mesh(stemGeo, stemMat);
    stemMesh.castShadow = true;
    stemMesh.receiveShadow = true;
    this.add(stemMesh);
    this.geometriesToDispose.push(stemGeo);
    this.materialsToDispose.push(stemMat);

    const leafGeo = createSculptedPetalGeometry(
      0.19,
      0.085,
      0.22,
      2.0,
      0.006,
      this.spec.stemColor,
      '#52b788',
      '#1b4332',
      0.55,
    );
    const leafMat = new THREE.MeshPhysicalMaterial({
      vertexColors: true,
      roughness: 0.42,
      metalness: 0.03,
      clearcoat: 0.28,
      side: THREE.DoubleSide,
      bumpMap: getPetalVeinsTexture(),
      bumpScale: 0.003,
    });
    this.geometriesToDispose.push(leafGeo);
    this.materialsToDispose.push(leafMat);

    const leafConfigs = [
      {y: -0.18, yaw: 0.7, pitch: 1.05, scale: 1.0},
      {y: -0.27, yaw: -2.2, pitch: 1.12, scale: 1.12},
      {y: -0.35, yaw: 2.3, pitch: 1.18, scale: 0.92},
    ];
    for (const cfg of leafConfigs) {
      const pivot = new THREE.Group();
      pivot.position.set(0, cfg.y, 0);
      pivot.rotation.y = cfg.yaw;
      const leaf = new THREE.Mesh(leafGeo, leafMat);
      leaf.rotation.x = cfg.pitch;
      leaf.scale.setScalar(cfg.scale);
      leaf.castShadow = true;
      leaf.receiveShadow = true;
      pivot.add(leaf);
      this.add(pivot);
    }
  }

  private buildReceptacleAndStamens(): void {
    const podGeo = new THREE.CylinderGeometry(0.038, 0.018, 0.042, 24);
    const podMat = new THREE.MeshStandardMaterial({
      color: this.spec.coreColor,
      roughness: 0.45,
      metalness: 0.08,
    });
    this.receptacleMesh = new THREE.Mesh(podGeo, podMat);
    this.receptacleMesh.position.y = 0.022;
    this.flowerHeadGroup.add(this.receptacleMesh);
    this.geometriesToDispose.push(podGeo);
    this.materialsToDispose.push(podMat);

    const domeGeo = new THREE.SphereGeometry(
      0.037,
      20,
      12,
      0,
      Math.PI * 2,
      0,
      Math.PI * 0.5,
    );
    const domeMesh = new THREE.Mesh(domeGeo, podMat);
    domeMesh.position.y = 0.042;
    this.flowerHeadGroup.add(domeMesh);
    this.geometriesToDispose.push(domeGeo);

    const stamenCount = 32;
    const filamentGeo = new THREE.CylinderGeometry(0.0016, 0.0022, 0.068, 6);
    filamentGeo.translate(0, 0.034, 0);
    const antherGeo = new THREE.SphereGeometry(0.0048, 8, 8);
    antherGeo.scale(0.8, 1.6, 0.8);
    antherGeo.translate(0, 0.07, 0);

    const filamentMat = new THREE.MeshStandardMaterial({
      color: this.spec.coreColor,
      roughness: 0.35,
    });
    const antherMat = new THREE.MeshStandardMaterial({
      color: this.spec.stamenColor,
      emissive: this.spec.stamenColor,
      emissiveIntensity: 0.32,
      roughness: 0.3,
    });

    this.geometriesToDispose.push(filamentGeo, antherGeo);
    this.materialsToDispose.push(filamentMat, antherMat);

    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < stamenCount; i++) {
      const t = i / stamenCount;
      const yaw = i * goldenAngle;
      const radius = 0.022 + t * 0.02;

      const pivot = new THREE.Group();
      pivot.position.set(
        Math.cos(yaw) * radius,
        0.026,
        Math.sin(yaw) * radius,
      );
      pivot.rotation.y = -yaw + Math.PI / 2;

      const fMesh = new THREE.Mesh(filamentGeo, filamentMat);
      const aMesh = new THREE.Mesh(antherGeo, antherMat);
      pivot.add(fMesh, aMesh);
      this.flowerHeadGroup.add(pivot);

      this.stamenPivots.push({
        pivot,
        closedPitch: 0.08 + t * 0.14,
        openPitch: 0.38 + t * 0.48,
        phaseOffset: i * 0.37,
      });
    }
  }

  private buildSepalsAndPetalRings(): void {
    const veinsTex = getPetalVeinsTexture();

    const sepalCount = 6;
    const sepalGeo = createSculptedPetalGeometry(
      0.11,
      0.048,
      0.24,
      1.0,
      0.002,
      this.spec.stemColor,
      '#74c69d',
      '#1b4332',
      0.5,
    );
    const sepalMat = new THREE.MeshPhysicalMaterial({
      vertexColors: true,
      roughness: 0.48,
      metalness: 0.02,
      side: THREE.DoubleSide,
    });
    this.geometriesToDispose.push(sepalGeo);
    this.materialsToDispose.push(sepalMat);

    for (let i = 0; i < sepalCount; i++) {
      const yaw = (i / sepalCount) * Math.PI * 2;
      const pivot = new THREE.Group();
      pivot.position.set(Math.cos(yaw) * 0.024, 0.006, Math.sin(yaw) * 0.024);
      pivot.rotation.y = -yaw + Math.PI / 2;

      const mesh = new THREE.Mesh(sepalGeo, sepalMat);
      pivot.add(mesh);
      this.flowerHeadGroup.add(pivot);

      this.petalPivots.push({
        pivot,
        mesh,
        layerIndex: 0,
        closedPitch: 0.42,
        openPitch: 1.48,
        baseYaw: -yaw + Math.PI / 2,
        phaseOffset: i * 0.8,
      });
    }

    const isBioluminescent = this.spec.id === 'udumbara';
    const petalMaterial = new THREE.MeshPhysicalMaterial({
      vertexColors: true,
      roughness: 0.38,
      metalness: 0.02,
      transmission: 0.04,
      thickness: 0.05,
      sheen: 0.65,
      sheenRoughness: 0.38,
      sheenColor: new THREE.Color(this.spec.primaryColor),
      clearcoat: 0.12,
      clearcoatRoughness: 0.4,
      bumpMap: veinsTex,
      bumpScale: 0.004,
      emissive: new THREE.Color(
        isBioluminescent ? this.spec.primaryColor : this.spec.primaryColor,
      ),
      emissiveIntensity: isBioluminescent ? 0.32 : 0.08,
      side: THREE.DoubleSide,
    });
    this.materialsToDispose.push(petalMaterial);

    const ringDefinitions = [
      {
        layerIndex: 1,
        count: this.spec.outerPetals,
        lengthScale: 1.04,
        widthScale: 1.05,
        radius: 0.032,
        yOffset: 0.012,
        closedPitch: 0.22,
        openPitch: this.spec.maxOpenAngleRad * 1.06,
        yawTwist: 0,
      },
      {
        layerIndex: 2,
        count: this.spec.midPetals,
        lengthScale: 0.9,
        widthScale: 0.94,
        radius: 0.025,
        yOffset: 0.018,
        closedPitch: 0.12,
        openPitch: this.spec.maxOpenAngleRad * 0.76,
        yawTwist: Math.PI / this.spec.midPetals,
      },
      {
        layerIndex: 3,
        count: this.spec.innerPetals,
        lengthScale: 0.72,
        widthScale: 0.82,
        radius: 0.018,
        yOffset: 0.024,
        closedPitch: 0.04,
        openPitch: this.spec.maxOpenAngleRad * 0.46,
        yawTwist: Math.PI / (this.spec.innerPetals * 1.6),
      },
    ];

    for (const ring of ringDefinitions) {
      const geo = createSculptedPetalGeometry(
        this.spec.petalLength * ring.lengthScale,
        this.spec.petalWidth * ring.widthScale,
        this.spec.cupDepth,
        this.spec.ruffleFrequency,
        this.spec.ruffleAmplitude,
        this.spec.primaryColor,
        this.spec.secondaryColor,
        this.spec.coreColor,
        this.spec.id === 'lily' ? 0.48 : 0.65,
      );
      this.geometriesToDispose.push(geo);

      for (let i = 0; i < ring.count; i++) {
        const yaw = (i / ring.count) * Math.PI * 2 + ring.yawTwist;
        const pivot = new THREE.Group();
        pivot.position.set(
          Math.cos(yaw) * ring.radius,
          ring.yOffset,
          Math.sin(yaw) * ring.radius,
        );
        const baseYaw = -yaw + Math.PI / 2;
        pivot.rotation.y = baseYaw;

        const mesh = new THREE.Mesh(geo, petalMaterial);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        pivot.add(mesh);
        this.flowerHeadGroup.add(pivot);

        this.petalPivots.push({
          pivot,
          mesh,
          layerIndex: ring.layerIndex,
          closedPitch: ring.closedPitch + (i % 2) * 0.025,
          openPitch: ring.openPitch + (i % 2) * 0.03,
          baseYaw,
          phaseOffset: i * 0.65 + ring.layerIndex * 1.3,
        });
      }
    }
  }

  setBloom(bloom01: number, elapsedSec: number): void {
    this.currentBloom01 = clamp(bloom01, 0, 1);
    const b = this.currentBloom01;

    this.flowerHeadGroup.position.y =
      0.04 + Math.sin(elapsedSec * 1.5) * 0.008;
    this.flowerHeadGroup.rotation.z = Math.sin(elapsedSec * 0.9) * 0.025;

    this.coreGlowLight.intensity = 0.25 + Math.pow(b, 1.5) * 1.65;

    for (const item of this.petalPivots) {
      let layerProgress = b;
      if (item.layerIndex === 0) {
        layerProgress = clamp(b / 0.55, 0, 1);
      } else if (item.layerIndex === 1) {
        layerProgress = clamp(b / 0.82, 0, 1);
      } else if (item.layerIndex === 2) {
        layerProgress = clamp((b - 0.12) / 0.78, 0, 1);
      } else {
        layerProgress = clamp((b - 0.24) / 0.76, 0, 1);
      }

      const smoothP =
        layerProgress * layerProgress * (3 - 2 * layerProgress);
      const flutter =
        Math.sin(elapsedSec * 2.1 + item.phaseOffset) *
        0.018 *
        (0.25 + 0.75 * smoothP);

      const pitch =
        item.closedPitch +
        (item.openPitch - item.closedPitch) * smoothP +
        flutter;
      item.mesh.rotation.x = pitch;

      const spiralTwist = (1 - smoothP) * 0.18 * (item.layerIndex >= 2 ? 1 : -1);
      item.pivot.rotation.y = item.baseYaw + spiralTwist;
    }

    const stamenProgress = clamp((b - 0.18) / 0.82, 0, 1);
    for (const st of this.stamenPivots) {
      const sway = Math.sin(elapsedSec * 3.0 + st.phaseOffset) * 0.025 * stamenProgress;
      st.pivot.rotation.x =
        st.closedPitch +
        (st.openPitch - st.closedPitch) * stamenProgress +
        sway;
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

import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {
  ENVIRONMENT_LIBRARY,
  type EnvironmentSpec,
  clamp,
} from './gestureMath';

const PARTICLE_COUNT = 140;

export class EnvironmentManager extends THREE.Group {
  private currentSpec: EnvironmentSpec = ENVIRONMENT_LIBRARY[0];
  private hemiLight: THREE.HemisphereLight;
  private keyLight: THREE.DirectionalLight;
  private rimLight: THREE.DirectionalLight;
  private fillLight: THREE.PointLight;

  private sanctuaryDomeMat!: THREE.MeshBasicMaterial;
  private haloBackdropMat!: THREE.MeshBasicMaterial;
  private pedestalGroup: THREE.Group;
  private waterDiscMat!: THREE.MeshPhysicalMaterial;
  private rippleRings: THREE.Mesh[] = [];
  private ripplePhases: number[] = [0, 0.33, 0.66];

  private particleMesh!: THREE.InstancedMesh;
  private particleMaterial!: THREE.MeshBasicMaterial;
  private particlePositions: Float32Array;
  private particleVelocities: Float32Array;
  private particlePhases: Float32Array;
  private burstIntensity = 0;

  private targetBgColor = new THREE.Color(ENVIRONMENT_LIBRARY[0].bgHex);
  private currentBgColor = new THREE.Color(ENVIRONMENT_LIBRARY[0].bgHex);
  private targetKeyColor = new THREE.Color(ENVIRONMENT_LIBRARY[0].keyLightHex);
  private targetRimColor = new THREE.Color(ENVIRONMENT_LIBRARY[0].rimLightHex);
  private targetFillColor = new THREE.Color(ENVIRONMENT_LIBRARY[0].fillLightHex);
  private targetGroundColor = new THREE.Color(ENVIRONMENT_LIBRARY[0].groundHex);
  private targetParticleColor = new THREE.Color(ENVIRONMENT_LIBRARY[0].particleHex);

  private pmremGenerator: THREE.PMREMGenerator | null = null;
  private envRenderTarget: THREE.WebGLRenderTarget | null = null;

  constructor() {
    super();
    this.name = 'BotanicalEnvironmentManager';

    this.hemiLight = new THREE.HemisphereLight(
      this.currentSpec.ambientHex,
      this.currentSpec.groundHex,
      1.35,
    );
    this.add(this.hemiLight);

    this.keyLight = new THREE.DirectionalLight(
      this.currentSpec.keyLightHex,
      1.9,
    );
    this.keyLight.position.set(1.6, 2.8, 1.5);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(1024, 1024);
    this.keyLight.shadow.bias = -0.0005;
    this.add(this.keyLight);

    this.rimLight = new THREE.DirectionalLight(
      this.currentSpec.rimLightHex,
      1.6,
    );
    this.rimLight.position.set(-1.8, 2.1, -1.6);
    this.add(this.rimLight);

    this.fillLight = new THREE.PointLight(
      this.currentSpec.fillLightHex,
      1.2,
      4.5,
    );
    this.fillLight.position.set(-0.8, 1.25, 0.3);
    this.add(this.fillLight);

    this.buildSanctuaryAtmosphere();

    this.pedestalGroup = new THREE.Group();
    this.pedestalGroup.position.set(0, 0.86, -1.15);
    this.pedestalGroup.xb = {pointerEvents: 'none'};
    this.add(this.pedestalGroup);
    this.buildPedestalAndRipples();

    this.particlePositions = new Float32Array(PARTICLE_COUNT * 3);
    this.particleVelocities = new Float32Array(PARTICLE_COUNT * 3);
    this.particlePhases = new Float32Array(PARTICLE_COUNT);
    this.buildParticleSystem();
  }

  private buildSanctuaryAtmosphere(): void {
    // Subtle dark atmospheric sanctuary envelope behind the flower so the petals pop with high contrast
    const domeGeo = new THREE.SphereGeometry(2.6, 32, 24);
    this.sanctuaryDomeMat = new THREE.MeshBasicMaterial({
      color: this.currentSpec.bgHex,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
    });
    const domeMesh = new THREE.Mesh(domeGeo, this.sanctuaryDomeMat);
    domeMesh.position.set(0, 1.3, -1.15);
    domeMesh.xb = {pointerEvents: 'none'};
    this.add(domeMesh);

    const haloGeo = new THREE.RingGeometry(0.18, 0.62, 48);
    this.haloBackdropMat = new THREE.MeshBasicMaterial({
      color: this.currentSpec.rimLightHex,
      transparent: true,
      opacity: 0.14,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const haloMesh = new THREE.Mesh(haloGeo, this.haloBackdropMat);
    haloMesh.position.set(0, 1.38, -1.55);
    haloMesh.xb = {pointerEvents: 'none'};
    this.add(haloMesh);
  }

  initStudioEnvironment(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
  ): void {
    try {
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.96;
      this.pmremGenerator = new THREE.PMREMGenerator(renderer);
      const roomEnv = new RoomEnvironment();
      this.envRenderTarget = this.pmremGenerator.fromScene(roomEnv, 0.04);
      scene.environment = this.envRenderTarget.texture;
      scene.background = this.currentBgColor;
      scene.fog = new THREE.FogExp2(this.currentSpec.fogHex, 0.16);
      roomEnv.dispose();
    } catch (e) {
      console.warn('Studio PMREM setup fallback:', e);
    }
  }

  private buildPedestalAndRipples(): void {
    const waterGeo = new THREE.CylinderGeometry(0.46, 0.48, 0.018, 48);
    this.waterDiscMat = new THREE.MeshPhysicalMaterial({
      color: this.currentSpec.groundHex,
      roughness: 0.15,
      metalness: 0.12,
      clearcoat: 0.9,
      clearcoatRoughness: 0.12,
      transparent: true,
      opacity: 0.88,
    });
    const waterDisc = new THREE.Mesh(waterGeo, this.waterDiscMat);
    waterDisc.receiveShadow = true;
    this.pedestalGroup.add(waterDisc);

    const rimGeo = new THREE.TorusGeometry(0.47, 0.004, 12, 64);
    rimGeo.rotateX(Math.PI / 2);
    const rimMat = new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      roughness: 0.28,
      metalness: 0.82,
    });
    const rimMesh = new THREE.Mesh(rimGeo, rimMat);
    rimMesh.position.y = 0.009;
    this.pedestalGroup.add(rimMesh);

    const ringGeo = new THREE.RingGeometry(0.08, 0.092, 48);
    ringGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < 3; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: this.currentSpec.particleHex,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(ringGeo, mat);
      ring.position.y = 0.011 + i * 0.001;
      this.pedestalGroup.add(ring);
      this.rippleRings.push(ring);
    }
  }

  private buildParticleSystem(): void {
    const geo = new THREE.IcosahedronGeometry(0.009, 1);
    this.particleMaterial = new THREE.MeshBasicMaterial({
      color: this.currentSpec.particleHex,
      transparent: true,
      opacity: 0.85,
    });
    this.particleMesh = new THREE.InstancedMesh(
      geo,
      this.particleMaterial,
      PARTICLE_COUNT,
    );
    this.particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.particleMesh.xb = {pointerEvents: 'none'};

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 0.12 + Math.random() * 0.65;
      const y = 0.9 + Math.random() * 0.95;

      this.particlePositions[i * 3] = Math.cos(angle) * radius;
      this.particlePositions[i * 3 + 1] = y;
      this.particlePositions[i * 3 + 2] = -1.15 + Math.sin(angle) * radius;

      this.particleVelocities[i * 3] = (Math.random() - 0.5) * 0.06;
      this.particleVelocities[i * 3 + 1] = 0.04 + Math.random() * 0.09;
      this.particleVelocities[i * 3 + 2] = (Math.random() - 0.5) * 0.06;
      this.particlePhases[i] = Math.random() * Math.PI * 2;
    }

    this.add(this.particleMesh);
  }

  setEnvironment(spec: EnvironmentSpec): void {
    this.currentSpec = spec;
    this.targetBgColor.setHex(spec.bgHex);
    this.targetKeyColor.setHex(spec.keyLightHex);
    this.targetRimColor.setHex(spec.rimLightHex);
    this.targetFillColor.setHex(spec.fillLightHex);
    this.targetGroundColor.setHex(spec.groundHex);
    this.targetParticleColor.setHex(spec.particleHex);
    this.triggerGestureBurst();
  }

  triggerGestureBurst(accentColorHex?: string): void {
    this.burstIntensity = 1.0;
    if (accentColorHex) {
      this.targetParticleColor.set(accentColorHex);
    }
  }

  updateEnvironment(
    bloom01: number,
    elapsedSec: number,
    dt: number,
  ): void {
    const safeDt = clamp(dt, 0.001, 0.05);
    const lerpFactor = clamp(safeDt * 4.5, 0.02, 0.25);

    this.currentBgColor.lerp(this.targetBgColor, lerpFactor);
    this.sanctuaryDomeMat.color.copy(this.currentBgColor);
    this.haloBackdropMat.color.lerp(this.targetRimColor, lerpFactor);
    this.haloBackdropMat.opacity = 0.1 + bloom01 * 0.14 + this.burstIntensity * 0.18;

    this.keyLight.color.lerp(this.targetKeyColor, lerpFactor);
    this.rimLight.color.lerp(this.targetRimColor, lerpFactor);
    this.fillLight.color.lerp(this.targetFillColor, lerpFactor);
    this.waterDiscMat.color.lerp(this.targetGroundColor, lerpFactor);
    this.particleMaterial.color.lerp(this.targetParticleColor, lerpFactor);

    this.burstIntensity = Math.max(0, this.burstIntensity - safeDt * 1.4);

    this.keyLight.intensity = 1.65 + bloom01 * 0.75 + this.burstIntensity * 0.6;
    this.rimLight.intensity = 1.35 + bloom01 * 0.75 + this.burstIntensity * 0.9;

    const rippleSpeed = 0.28 + bloom01 * 0.42 + this.burstIntensity * 0.8;
    for (let i = 0; i < this.rippleRings.length; i++) {
      this.ripplePhases[i] = (this.ripplePhases[i] + safeDt * rippleSpeed) % 1;
      const p = this.ripplePhases[i];
      const ring = this.rippleRings[i];
      const scale = 0.4 + p * 4.4;
      ring.scale.setScalar(scale);
      const mat = ring.material as THREE.MeshBasicMaterial;
      mat.opacity = (1 - p) * (0.22 + bloom01 * 0.35 + this.burstIntensity * 0.35);
      mat.color.copy(this.particleMaterial.color);
    }

    const dummy = new THREE.Object3D();
    const speedMultiplier = 0.55 + bloom01 * 1.65 + this.burstIntensity * 2.8;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const ix = i * 3;
      const iy = i * 3 + 1;
      const iz = i * 3 + 2;

      const phase = this.particlePhases[i];
      const swirlAngle = elapsedSec * (0.4 + bloom01 * 0.6) + phase;

      this.particlePositions[ix] +=
        (Math.cos(swirlAngle) * 0.08 + this.particleVelocities[ix]) *
        safeDt *
        speedMultiplier;
      this.particlePositions[iy] +=
        this.particleVelocities[iy] * safeDt * speedMultiplier;
      this.particlePositions[iz] +=
        (Math.sin(swirlAngle) * 0.08 + this.particleVelocities[iz]) *
        safeDt *
        speedMultiplier;

      if (this.particlePositions[iy] > 1.95) {
        const respawnAngle = Math.random() * Math.PI * 2;
        const respawnR = 0.08 + Math.random() * (0.28 + bloom01 * 0.35);
        this.particlePositions[ix] = Math.cos(respawnAngle) * respawnR;
        this.particlePositions[iy] = 0.88;
        this.particlePositions[iz] = -1.15 + Math.sin(respawnAngle) * respawnR;
      }

      const pulse =
        (0.55 + 0.45 * Math.sin(elapsedSec * 3.2 + phase)) *
        (0.45 + bloom01 * 0.85 + this.burstIntensity * 0.6);

      dummy.position.set(
        this.particlePositions[ix],
        this.particlePositions[iy],
        this.particlePositions[iz],
      );
      dummy.scale.setScalar(pulse);
      dummy.updateMatrix();
      this.particleMesh.setMatrixAt(i, dummy.matrix);
    }
    this.particleMesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.pmremGenerator?.dispose();
    this.envRenderTarget?.dispose();
    this.sanctuaryDomeMat.dispose();
    this.haloBackdropMat.dispose();
    this.waterDiscMat.dispose();
    this.particleMaterial.dispose();
    this.particleMesh.geometry.dispose();
  }
}

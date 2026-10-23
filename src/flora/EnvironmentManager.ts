import * as THREE from 'three';
import {
  ENVIRONMENT_LIBRARY,
  type EnvironmentSpec,
  type ForceFieldParticleState,
  type BloomForceFieldState,
  type FlowerEnvironmentLightingProfile,
  computeBloomForceFieldDamping,
  stepForceFieldDampedParticle,
  computeFlowerEnvironmentLightingProfile,
  interpolateFlowerLightingProfiles,
  clamp,
} from './gestureMath';

const PARTICLE_COUNT = 28;

export class EnvironmentManager extends THREE.Group {
  private currentSpec: EnvironmentSpec = ENVIRONMENT_LIBRARY[0];
  private currentLightingProfile: FlowerEnvironmentLightingProfile =
    computeFlowerEnvironmentLightingProfile(ENVIRONMENT_LIBRARY[0], 0.78);
  private targetLightingProfile: FlowerEnvironmentLightingProfile =
    computeFlowerEnvironmentLightingProfile(ENVIRONMENT_LIBRARY[0], 0.78);
  private hemiLight: THREE.HemisphereLight;
  private keyLight: THREE.DirectionalLight;
  private keyLightTarget: THREE.Object3D;
  private rimLight: THREE.DirectionalLight;
  private fillLight: THREE.PointLight;
  private bounceLight: THREE.PointLight;

  private sanctuaryDomeMat!: THREE.ShaderMaterial;
  private pedestalGroup: THREE.Group;
  private livingRoomGroup: THREE.Group;
  private forestCanopyGroup: THREE.Group;
  private desertDuneGroup: THREE.Group;
  private coffeeTableGroup: THREE.Group;
  private basinMat!: THREE.MeshPhysicalMaterial;
  private waterDiscMat!: THREE.MeshPhysicalMaterial;
  private goldTrimMat!: THREE.MeshPhysicalMaterial;
  private rippleRings: THREE.Mesh[] = [];
  private ripplePhases: number[] = [0, 0.33, 0.66];
  private godRayMeshes: THREE.Mesh[] = [];
  private godRayMat!: THREE.MeshBasicMaterial;

  private particleMesh!: THREE.InstancedMesh;
  private particleMaterial!: THREE.MeshBasicMaterial;
  private particlePositions: Float32Array;
  private particleVelocities: Float32Array;
  private particlePhases: Float32Array;
  private particleStates: ForceFieldParticleState[] = [];
  private lastForceFieldState: BloomForceFieldState =
    computeBloomForceFieldDamping(0.78, 0, 0, 0);
  private burstIntensity = 0;
  private lowNoiseMode = true;

  private targetBgColor = new THREE.Color(ENVIRONMENT_LIBRARY[0].bgHex);
  private currentBgColor = new THREE.Color(ENVIRONMENT_LIBRARY[0].bgHex);
  private targetFogColor = new THREE.Color(ENVIRONMENT_LIBRARY[0].fogHex);
  private currentFogColor = new THREE.Color(ENVIRONMENT_LIBRARY[0].fogHex);
  private targetAmbientColor = new THREE.Color(
    ENVIRONMENT_LIBRARY[0].ambientHex,
  );
  private targetKeyColor = new THREE.Color(ENVIRONMENT_LIBRARY[0].keyLightHex);
  private targetRimColor = new THREE.Color(ENVIRONMENT_LIBRARY[0].rimLightHex);
  private targetFillColor = new THREE.Color(ENVIRONMENT_LIBRARY[0].fillLightHex);
  private targetGroundColor = new THREE.Color(ENVIRONMENT_LIBRARY[0].groundHex);
  private targetParticleColor = new THREE.Color(
    ENVIRONMENT_LIBRARY[0].particleHex,
  );

  private pmremGenerator: THREE.PMREMGenerator | null = null;
  private envRenderTarget: THREE.WebGLRenderTarget | null = null;
  private sceneRef: THREE.Scene | null = null;
  private rendererRef: THREE.WebGLRenderer | null = null;

  constructor() {
    super();
    this.name = 'BotanicalEnvironmentManager';

    // 1. Calibrated Sky/Studio Hemisphere GI Fill (preserves deep petal pigment & vein contrast on white backdrops)
    this.hemiLight = new THREE.HemisphereLight(
      this.currentSpec.ambientHex,
      this.currentSpec.groundHex,
      0.34,
    );
    this.hemiLight.position.set(0, 3.5, -1.08);
    this.add(this.hemiLight);

    const isHeadless =
      typeof navigator !== 'undefined' &&
      (navigator.webdriver || /HeadlessChrome/i.test(navigator.userAgent));

    // 2. Key Sun / Window Directional Light with Contact-Hardened Shadow Frustum
    this.keyLight = new THREE.DirectionalLight(
      this.currentSpec.keyLightHex,
      0.84,
    );
    this.keyLight.position.set(1.45, 2.75, 0.45);
    this.keyLight.castShadow = !isHeadless;
    this.keyLight.shadow.mapSize.set(
      isHeadless ? 512 : 2048,
      isHeadless ? 512 : 2048,
    );
    this.keyLight.shadow.camera.near = 0.5;
    this.keyLight.shadow.camera.far = 4.5;
    this.keyLight.shadow.camera.left = -0.65;
    this.keyLight.shadow.camera.right = 0.65;
    this.keyLight.shadow.camera.top = 0.65;
    this.keyLight.shadow.camera.bottom = -0.65;
    this.keyLight.shadow.bias = -0.0002;
    this.keyLight.shadow.normalBias = 0.006;
    this.keyLight.shadow.radius = 2.5;

    this.keyLightTarget = new THREE.Object3D();
    this.keyLightTarget.position.set(0, 1.24, -1.08);
    this.add(this.keyLightTarget);
    this.keyLight.target = this.keyLightTarget;
    this.add(this.keyLight);

    // 3. Subsurface Back-Rim Light (excites Two-Sided Foliage SSS translucency without blowout)
    this.rimLight = new THREE.DirectionalLight(
      this.currentSpec.rimLightHex,
      0.56,
    );
    this.rimLight.position.set(-1.55, 2.15, -2.35);
    this.rimLight.target = this.keyLightTarget;
    this.add(this.rimLight);

    // 4. Lateral Fill Light (gentle shadow lift, preserves deep petal fold contrast)
    this.fillLight = new THREE.PointLight(
      this.currentSpec.fillLightHex,
      0.28,
      4.5,
      1.5,
    );
    this.fillLight.position.set(-0.92, 1.42, -0.32);
    this.add(this.fillLight);

    // 5. Porcelain/Table Bounce Uplight (illuminates abaxial lower petals & sepals)
    this.bounceLight = new THREE.PointLight(
      this.currentSpec.particleHex,
      0.22,
      2.2,
      1.6,
    );
    this.bounceLight.position.set(0, 0.9, -1.08);
    this.add(this.bounceLight);

    this.buildSanctuaryAtmosphere();
    this.buildVolumetricGodRays();

    this.pedestalGroup = new THREE.Group();
    this.pedestalGroup.position.set(0, 0.68, -1.08);
    this.pedestalGroup.xb = {pointerEvents: 'none'};
    this.add(this.pedestalGroup);

    this.coffeeTableGroup = new THREE.Group();
    this.pedestalGroup.add(this.coffeeTableGroup);

    this.livingRoomGroup = new THREE.Group();
    this.livingRoomGroup.name = 'WarmSunlitLivingRoomBackdrop';
    this.livingRoomGroup.xb = {pointerEvents: 'none'};
    this.livingRoomGroup.visible =
      this.currentSpec.id === 'warm-living-room';
    this.add(this.livingRoomGroup);

    this.forestCanopyGroup = new THREE.Group();
    this.forestCanopyGroup.name = 'EmeraldForestCanopyBackdrop';
    this.forestCanopyGroup.xb = {pointerEvents: 'none'};
    this.forestCanopyGroup.visible =
      this.currentSpec.id === 'emerald-forest';
    this.add(this.forestCanopyGroup);

    this.desertDuneGroup = new THREE.Group();
    this.desertDuneGroup.name = 'GoldenDesertMirageBackdrop';
    this.desertDuneGroup.xb = {pointerEvents: 'none'};
    this.desertDuneGroup.visible =
      this.currentSpec.id === 'golden-desert';
    this.add(this.desertDuneGroup);

    this.buildPedestalAndRipples();
    this.buildWarmSunlitLivingRoom();
    this.buildEmeraldForestBackdrop();
    this.buildGoldenDesertBackdrop();

    this.particlePositions = new Float32Array(PARTICLE_COUNT * 3);
    this.particleVelocities = new Float32Array(PARTICLE_COUNT * 3);
    this.particlePhases = new Float32Array(PARTICLE_COUNT);
    this.buildParticleSystem();
  }

  setLowNoiseMode(enabled: boolean): void {
    this.lowNoiseMode = enabled;
    if (this.particleMaterial) {
      this.particleMaterial.opacity = enabled ? 0.24 : 0.56;
    }
    if (this.godRayMat) {
      this.godRayMat.opacity = enabled ? 0.04 : 0.075;
    }
  }

  isLowNoiseMode(): boolean {
    return this.lowNoiseMode;
  }

  private buildSanctuaryAtmosphere(): void {
    // Dynamic Environment Sky & Studio Dome (adapts smoothly to Studio, Living Room, Emerald Forest, or Golden Desert)
    const domeGeo = new THREE.SphereGeometry(4.6, 48, 32);
    this.sanctuaryDomeMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      toneMapped: false,
      uniforms: {
        uZenithColor: {value: new THREE.Color(this.currentSpec.bgHex)},
        uHorizonColor: {value: new THREE.Color(this.currentSpec.fogHex)},
        uGlowColor: {value: new THREE.Color(this.currentSpec.rimLightHex)},
        uHaloColor: {
          value: new THREE.Vector3(
            ...this.currentLightingProfile.skyHaloColorRgb,
          ),
        },
        uEdgeTintColor: {
          value: new THREE.Vector3(
            ...this.currentLightingProfile.skyEdgeTintRgb,
          ),
        },
      },
      vertexShader: `
        varying vec3 vWorldOffset;
        void main() {
          vWorldOffset = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uZenithColor;
        uniform vec3 uHorizonColor;
        uniform vec3 uGlowColor;
        uniform vec3 uHaloColor;
        uniform vec3 uEdgeTintColor;
        varying vec3 vWorldOffset;
        void main() {
          vec3 dir = normalize(vWorldOffset);
          float elev = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);
          vec3 zenithSrgb = pow(clamp(uZenithColor, 0.0, 1.0), vec3(1.0 / 2.2));
          vec3 horizonSrgb = pow(clamp(uHorizonColor, 0.0, 1.0), vec3(1.0 / 2.2));
          vec3 glowSrgb = pow(clamp(uGlowColor, 0.0, 1.0), vec3(1.0 / 2.2));
          vec3 baseCol = mix(horizonSrgb, zenithSrgb, smoothstep(0.12, 0.86, elev));
          float centerFocus = max(0.0, dot(dir, normalize(vec3(0.0, 0.08, -1.0))));
          float windowGlow = max(0.0, dot(dir, normalize(vec3(-0.48, 0.36, -0.78))));
          vec3 skyCol = mix(baseCol, uHaloColor, 0.38 * pow(centerFocus, 2.0)) + glowSrgb * pow(windowGlow, 3.5) * 0.065;
          skyCol = mix(uEdgeTintColor, skyCol, 0.48 + 0.52 * pow(centerFocus, 1.15));
          float ign = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
          skyCol += (ign - 0.5) * (1.8 / 255.0);
          gl_FragColor = vec4(clamp(skyCol, 0.0, 1.0), 1.0);
        }
      `,
    });
    const domeMesh = new THREE.Mesh(domeGeo, this.sanctuaryDomeMat);
    domeMesh.position.set(0, 1.24, -1.08);
    domeMesh.xb = {pointerEvents: 'none'};
    this.add(domeMesh);
  }

  /**
   * Builds subtle UE5 Volumetric Light Shafts (丁达尔体积光束) descending from the upper
   * conservatory skylight with smooth vertex-alpha radial and vertical attenuation.
   */
  private buildVolumetricGodRays(): void {
    const coneGeo = new THREE.CylinderGeometry(0.14, 0.54, 2.2, 32, 1, true);
    const pos = coneGeo.attributes.position;
    const colors = new Float32Array(pos.count * 3);

    for (let i = 0; i < pos.count; i++) {
      const yNorm = (pos.getY(i) + 1.1) / 2.2; // 0 at bottom, 1 at top
      const vFade = Math.sin(yNorm * Math.PI);
      const lum = vFade * vFade;
      colors[i * 3] = lum;
      colors[i * 3 + 1] = lum;
      colors[i * 3 + 2] = lum;
    }
    coneGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    this.godRayMat = new THREE.MeshBasicMaterial({
      color: this.currentSpec.keyLightHex,
      vertexColors: true,
      transparent: true,
      opacity: 0.04,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const rayConfigs = [
      {x: 0.18, y: 1.72, z: -1.12, rotZ: 0.36, rotX: 0.12, scale: 1.0},
      {x: -0.06, y: 1.78, z: -1.18, rotZ: 0.32, rotX: 0.08, scale: 0.82},
    ];
    for (const cfg of rayConfigs) {
      const ray = new THREE.Mesh(coneGeo, this.godRayMat);
      ray.position.set(cfg.x, cfg.y, cfg.z);
      ray.rotation.set(cfg.rotX, 0, cfg.rotZ);
      ray.scale.setScalar(cfg.scale);
      ray.xb = {pointerEvents: 'none'};
      this.add(ray);
      this.godRayMeshes.push(ray);
    }
  }

  /**
   * Synthesizes a custom UE5 Lumen-style HDRI Studio & Sky Atmosphere scene and bakes it
   * into a prefiltered PMREM environment map for physically accurate specular & SSS reflections.
   */
  private rebuildUE5LumenEnvironmentMap(spec: EnvironmentSpec): void {
    if (!this.pmremGenerator || !this.sceneRef) return;

    const lumenScene = new THREE.Scene();
    // Use a balanced studio reflection base so PBR specular highlights stay crisp without washing out petals
    lumenScene.background = new THREE.Color(0x28262e).lerp(
      new THREE.Color(spec.ambientHex),
      0.18,
    );

    const keyPanelGeo = new THREE.PlaneGeometry(4.2, 4.2);
    const keyPanelMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(spec.keyLightHex).multiplyScalar(0.92),
      side: THREE.DoubleSide,
    });
    const keyPanel = new THREE.Mesh(keyPanelGeo, keyPanelMat);
    keyPanel.position.set(3.5, 4.2, 2.5);
    keyPanel.lookAt(0, 0, 0);
    lumenScene.add(keyPanel);

    const rimPanelMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(spec.rimLightHex).multiplyScalar(0.82),
      side: THREE.DoubleSide,
    });
    const rimPanel = new THREE.Mesh(keyPanelGeo, rimPanelMat);
    rimPanel.position.set(-3.8, 3.2, -3.5);
    rimPanel.lookAt(0, 0, 0);
    lumenScene.add(rimPanel);

    const fillPanelMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(spec.fillLightHex).multiplyScalar(0.62),
      side: THREE.DoubleSide,
    });
    const fillPanel = new THREE.Mesh(keyPanelGeo, fillPanelMat);
    fillPanel.position.set(-3.2, 1.5, 2.8);
    fillPanel.lookAt(0, 0, 0);
    lumenScene.add(fillPanel);

    const skylightGeo = new THREE.RingGeometry(1.2, 3.6, 32);
    const skylightMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(spec.ambientHex).multiplyScalar(0.72),
      side: THREE.DoubleSide,
    });
    const skylight = new THREE.Mesh(skylightGeo, skylightMat);
    skylight.position.set(0, 5.2, 0);
    skylight.rotation.x = Math.PI / 2;
    lumenScene.add(skylight);

    if (this.envRenderTarget) {
      this.envRenderTarget.dispose();
    }
    this.envRenderTarget = this.pmremGenerator.fromScene(lumenScene, 0.04);
    this.sceneRef.environment = this.envRenderTarget.texture;
    if ('environmentIntensity' in this.sceneRef) {
      (
        this.sceneRef as THREE.Scene & {environmentIntensity: number}
      ).environmentIntensity =
        this.targetLightingProfile.environmentReflectionIntensity;
    }

    keyPanelGeo.dispose();
    skylightGeo.dispose();
    keyPanelMat.dispose();
    rimPanelMat.dispose();
    fillPanelMat.dispose();
    skylightMat.dispose();
  }

  initStudioEnvironment(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
  ): void {
    try {
      const isHeadless =
        typeof navigator !== 'undefined' &&
        (navigator.webdriver || /HeadlessChrome/i.test(navigator.userAgent));
      this.sceneRef = scene;
      this.rendererRef = renderer;
      renderer.setPixelRatio(
        isHeadless ? 1 : Math.min(window.devicePixelRatio || 1, 2),
      );
      renderer.shadowMap.enabled = !isHeadless;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure =
        this.currentLightingProfile.toneMappingExposure;

      this.pmremGenerator = new THREE.PMREMGenerator(renderer);
      this.pmremGenerator.compileEquirectangularShader();
      this.rebuildUE5LumenEnvironmentMap(this.currentSpec);

      scene.background = this.currentBgColor;
      scene.fog = new THREE.FogExp2(
        this.currentSpec.fogHex,
        this.currentLightingProfile.fogDensity,
      );
    } catch (e) {
      console.warn('Studio PMREM setup fallback:', e);
    }
  }

  private createRadialContactShadowTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 62);
      grad.addColorStop(0, 'rgba(92, 68, 42, 0.28)');
      grad.addColorStop(0.55, 'rgba(128, 96, 62, 0.12)');
      grad.addColorStop(1, 'rgba(165, 132, 92, 0.0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 128, 128);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }

  private createFeatheredSunbeamTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, 128, 128);
      // Horizontal feathering across beam width
      const hGrad = ctx.createLinearGradient(0, 0, 128, 0);
      hGrad.addColorStop(0, 'rgba(255, 246, 224, 0.0)');
      hGrad.addColorStop(0.25, 'rgba(255, 246, 224, 0.65)');
      hGrad.addColorStop(0.5, 'rgba(255, 250, 236, 1.0)');
      hGrad.addColorStop(0.75, 'rgba(255, 246, 224, 0.65)');
      hGrad.addColorStop(1, 'rgba(255, 246, 224, 0.0)');
      ctx.fillStyle = hGrad;
      ctx.fillRect(0, 0, 128, 128);

      // Vertical attenuation along beam length
      ctx.globalCompositeOperation = 'destination-in';
      const vGrad = ctx.createLinearGradient(0, 0, 0, 128);
      vGrad.addColorStop(0, 'rgba(255, 255, 255, 0.0)');
      vGrad.addColorStop(0.18, 'rgba(255, 255, 255, 0.95)');
      vGrad.addColorStop(0.75, 'rgba(255, 255, 255, 0.55)');
      vGrad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
      ctx.fillStyle = vGrad;
      ctx.fillRect(0, 0, 128, 128);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }

  private buildPedestalAndRipples(): void {
    const isHeadless =
      typeof navigator !== 'undefined' &&
      (navigator.webdriver || /HeadlessChrome/i.test(navigator.userAgent));

    // Soft Radial Contact Shadow under the Porcelain Basin so the foreground hero is grounded
    const shadowTex = this.createRadialContactShadowTexture();
    const shadowPlaneGeo = new THREE.PlaneGeometry(1.05, 1.05);
    shadowPlaneGeo.rotateX(-Math.PI / 2);
    const shadowPlaneMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    });
    const shadowPlane = new THREE.Mesh(shadowPlaneGeo, shadowPlaneMat);
    shadowPlane.position.y = -0.044;
    this.pedestalGroup.add(shadowPlane);

    // Sculpted Warm-White Mutton-Fat Jade Porcelain Ikebana Basin (暖白羊脂玉瓷花器)
    const basinProfile = [
      new THREE.Vector2(0.0, -0.044),
      new THREE.Vector2(0.35, -0.044),
      new THREE.Vector2(0.405, -0.016),
      new THREE.Vector2(0.425, 0.008),
      new THREE.Vector2(0.402, 0.015),
      new THREE.Vector2(0.386, 0.002),
      new THREE.Vector2(0.0, 0.002),
    ];
    const basinGeo = new THREE.LatheGeometry(basinProfile, 64);
    this.basinMat = new THREE.MeshPhysicalMaterial({
      color: this.currentLightingProfile.basinBaseHex,
      emissive: new THREE.Color(this.currentLightingProfile.basinEmissiveHex),
      emissiveIntensity: 0.34,
      roughness: 0.18,
      metalness: 0.04,
      clearcoat: 0.85,
      clearcoatRoughness: 0.14,
      sheen: 0.35,
      sheenColor: new THREE.Color('#fff9ee'),
    });
    const basinMesh = new THREE.Mesh(basinGeo, this.basinMat);
    basinMesh.receiveShadow = true;
    this.pedestalGroup.add(basinMesh);

    // Translucent Crystal Water Surface inside the Porcelain Basin
    const waterGeo = new THREE.CylinderGeometry(0.386, 0.386, 0.008, 64);
    this.waterDiscMat = new THREE.MeshPhysicalMaterial({
      color: this.currentSpec.groundHex,
      emissive: new THREE.Color(0xfbe5c4),
      emissiveIntensity: 0.28,
      roughness: 0.06,
      metalness: 0.06,
      transmission: isHeadless ? 0.0 : 0.28,
      ior: 1.333,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      transparent: true,
      opacity: 0.88,
    });
    const waterDisc = new THREE.Mesh(waterGeo, this.waterDiscMat);
    waterDisc.position.y = 0.004;
    waterDisc.receiveShadow = true;
    this.pedestalGroup.add(waterDisc);

    // Brushed Champagne-Gold Rim & Central Ikebana Kenzan Holder (花道剑山底座)
    this.goldTrimMat = new THREE.MeshPhysicalMaterial({
      color: 0xd4af37,
      roughness: 0.24,
      metalness: 0.84,
      clearcoat: 0.5,
    });
    const outerRimGeo = new THREE.TorusGeometry(0.406, 0.0036, 16, 72);
    outerRimGeo.rotateX(Math.PI / 2);
    const outerRimMesh = new THREE.Mesh(outerRimGeo, this.goldTrimMat);
    outerRimMesh.position.y = 0.012;
    this.pedestalGroup.add(outerRimMesh);

    const kenzanGeo = new THREE.CylinderGeometry(0.032, 0.042, 0.022, 32);
    const kenzanMesh = new THREE.Mesh(kenzanGeo, this.goldTrimMat);
    kenzanMesh.position.set(0, 0.01, 0);
    this.pedestalGroup.add(kenzanMesh);

    // Subtle Celadon-Jade Floating Botanical Leaves on the Water Mirror
    const padMat = new THREE.MeshPhysicalMaterial({
      color: 0x5c8d73,
      roughness: 0.38,
      metalness: 0.02,
      clearcoat: 0.42,
      clearcoatRoughness: 0.25,
      sheen: 0.35,
      sheenColor: new THREE.Color('#b7e4c7'),
    });
    const padConfigs = [
      {x: -0.18, z: 0.11, r: 0.088, rotY: 0.45},
      {x: 0.17, z: -0.1, r: 0.076, rotY: -1.75},
      {x: -0.12, z: -0.16, r: 0.062, rotY: 2.1},
    ];
    for (const cfg of padConfigs) {
      const padGeo = new THREE.CylinderGeometry(
        cfg.r,
        cfg.r * 0.96,
        0.0035,
        36,
        1,
        false,
        0.24,
        Math.PI * 2 - 0.48,
      );
      const padMesh = new THREE.Mesh(padGeo, padMat);
      padMesh.position.set(cfg.x, 0.0085, cfg.z);
      padMesh.rotation.y = cfg.rotY;
      padMesh.receiveShadow = true;
      this.pedestalGroup.add(padMesh);
    }

    // Harmonic Concentric Water Ripples
    const ringGeo = new THREE.RingGeometry(0.058, 0.063, 64);
    ringGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < 3; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: this.currentSpec.particleHex,
        transparent: true,
        opacity: 0.18,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(ringGeo, mat);
      ring.position.y = 0.009 + i * 0.0008;
      this.pedestalGroup.add(ring);
      this.rippleRings.push(ring);
    }
  }

  /**
   * Builds the "Warm Translucent Living Room" (白透温馨客厅) 3D architectural environment
   * with strict Primary-Secondary Visual Hierarchy (主次分明) and moderately saturated warm-white tones (具有一定饱和度的暖白色):
   * - PRIMARY FOREGROUND (主 · 近景聚焦 z = -1.08): Sculpted warm travertine coffee table & porcelain vessel supporting the hero flower.
   * - SECONDARY BACKGROUND (次 · 远景温馨客厅衬景 z = -2.35 .. -2.95): Full-width sunlit warm-cream wall (#fcecd2), floor-to-ceiling
   *   translucent sheer window with feathered sunbeams on the left, minimalist warm oatmeal-linen sofa with cushions on the right,
   *   and a subtle framed relief artwork—creating a luminous, cozy warm-white home living room while keeping 100% focus on the flower.
   */
  private buildWarmSunlitLivingRoom(): void {
    // 1. FOREGROUND COFFEE TABLE TOP (主景承托: 暖白洞石与温润浅橡木茶几, y = -0.062 relative to pedestal at y = 0.68)
    const tableTopGeo = new THREE.CylinderGeometry(0.66, 0.63, 0.034, 64);
    const tableTopMat = new THREE.MeshPhysicalMaterial({
      color: 0xfff3de,
      emissive: new THREE.Color(0xf8e0bc),
      emissiveIntensity: 0.48,
      roughness: 0.38,
      metalness: 0.02,
      clearcoat: 0.28,
      clearcoatRoughness: 0.35,
    });
    const tableTop = new THREE.Mesh(tableTopGeo, tableTopMat);
    tableTop.position.set(0, -0.062, 0);
    tableTop.receiveShadow = true;
    this.coffeeTableGroup.add(tableTop);

    const tableBaseGeo = new THREE.CylinderGeometry(0.24, 0.31, 0.42, 48);
    const warmOakMat = new THREE.MeshStandardMaterial({
      color: 0xe6caa4,
      emissive: new THREE.Color(0xdcb888),
      emissiveIntensity: 0.42,
      roughness: 0.65,
      metalness: 0.02,
    });
    const tableBase = new THREE.Mesh(tableBaseGeo, warmOakMat);
    tableBase.position.set(0, -0.285, 0);
    this.coffeeTableGroup.add(tableBase);
    this.coffeeTableGroup.visible =
      this.currentSpec.id === 'warm-living-room';

    // 2. SECONDARY BACKGROUND LIVING ROOM ARCHITECTURE (次景远景衬托: 具有一定饱和度的暖白色 z = -2.35 .. -2.95)
    const warmWallMat = new THREE.MeshStandardMaterial({
      color: 0xffefd2,
      emissive: new THREE.Color(0xfbe0b4),
      emissiveIntensity: 0.84,
      roughness: 0.9,
      metalness: 0.0,
    });
    const wainscotMat = new THREE.MeshStandardMaterial({
      color: 0xfbe5c2,
      emissive: new THREE.Color(0xf4d6a4),
      emissiveIntensity: 0.74,
      roughness: 0.86,
      metalness: 0.0,
    });
    const linenSofaMat = new THREE.MeshStandardMaterial({
      color: 0xffeeda,
      emissive: new THREE.Color(0xf7dbb4),
      emissiveIntensity: 0.7,
      roughness: 0.88,
      metalness: 0.0,
    });
    const pillowWarmMat = new THREE.MeshStandardMaterial({
      color: 0xf4dec0,
      emissive: new THREE.Color(0xebd0aa),
      emissiveIntensity: 0.56,
      roughness: 0.84,
      metalness: 0.0,
    });
    const pillowAccentMat = new THREE.MeshStandardMaterial({
      color: 0xe8c9a4,
      emissive: new THREE.Color(0xdfb98c),
      emissiveIntensity: 0.5,
      roughness: 0.84,
      metalness: 0.0,
    });
    const sheerCurtainMat = new THREE.MeshBasicMaterial({
      color: 0xfff9ee,
      transparent: true,
      opacity: 0.68,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    const sunlitWindowGlassMat = new THREE.MeshBasicMaterial({
      color: 0xfffdf6,
      toneMapped: false,
    });

    // Full-Width Back Living Room Wall & Subtle Dado Moulding (14m wide so no side edges ever clip)
    const backWallGeo = new THREE.PlaneGeometry(14.0, 6.2);
    const backWall = new THREE.Mesh(backWallGeo, warmWallMat);
    backWall.position.set(0, 1.65, -2.96);
    this.livingRoomGroup.add(backWall);

    const dadoRailGeo = new THREE.BoxGeometry(14.0, 0.028, 0.03);
    const dadoRail = new THREE.Mesh(dadoRailGeo, wainscotMat);
    dadoRail.position.set(0, 0.96, -2.94);
    this.livingRoomGroup.add(dadoRail);

    // Warm Honey-Cream Living Room Floor & Soft Woven Cream Area Rug
    const floorGeo = new THREE.PlaneGeometry(14.0, 5.2);
    floorGeo.rotateX(-Math.PI / 2);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0xf4dec0,
      emissive: new THREE.Color(0xebd0ab),
      emissiveIntensity: 0.62,
      roughness: 0.74,
      metalness: 0.02,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.position.set(0, 0.18, -2.1);
    this.livingRoomGroup.add(floorMesh);

    const rugGeo = new THREE.CylinderGeometry(1.75, 1.75, 0.008, 64);
    const rugMat = new THREE.MeshStandardMaterial({
      color: 0xfff4e0,
      emissive: new THREE.Color(0xfbe6c6),
      emissiveIntensity: 0.7,
      roughness: 0.95,
      metalness: 0.0,
    });
    const rugMesh = new THREE.Mesh(rugGeo, rugMat);
    rugMesh.position.set(0.15, 0.186, -2.15);
    this.livingRoomGroup.add(rugMesh);

    // LEFT-BACK: Floor-to-Ceiling Sunlit Window + Translucent Warm-White Sheer Curtains (落地暖白纱窗)
    const windowGroup = new THREE.Group();
    windowGroup.position.set(-1.18, 1.55, -2.88);
    this.livingRoomGroup.add(windowGroup);

    const glassGeo = new THREE.PlaneGeometry(1.38, 2.35);
    const glassMesh = new THREE.Mesh(glassGeo, sunlitWindowGlassMat);
    glassMesh.position.z = 0.01;
    windowGroup.add(glassMesh);

    // Window mullions (slender warm-oak architectural grid)
    const mullionVGeo = new THREE.BoxGeometry(0.026, 2.38, 0.035);
    for (const mx of [-0.69, 0.0, 0.69]) {
      const m = new THREE.Mesh(mullionVGeo, warmOakMat);
      m.position.set(mx, 0, 0.02);
      windowGroup.add(m);
    }
    const mullionHGeo = new THREE.BoxGeometry(1.4, 0.026, 0.035);
    for (const my of [-1.18, -0.38, 0.42, 1.18]) {
      const m = new THREE.Mesh(mullionHGeo, warmOakMat);
      m.position.set(0, my, 0.02);
      windowGroup.add(m);
    }

    // Softly pleated translucent warm-white sheer curtains flanking the window
    const pleatGeo = new THREE.CylinderGeometry(0.055, 0.065, 2.42, 16);
    for (let i = 0; i < 5; i++) {
      const leftPleat = new THREE.Mesh(pleatGeo, sheerCurtainMat);
      leftPleat.scale.set(1.0, 1.0, 0.45);
      leftPleat.position.set(-0.72 + i * 0.075, -0.02, 0.06 + (i % 2) * 0.012);
      windowGroup.add(leftPleat);

      const rightPleat = new THREE.Mesh(pleatGeo, sheerCurtainMat);
      rightPleat.scale.set(1.0, 1.0, 0.45);
      rightPleat.position.set(0.42 + i * 0.075, -0.02, 0.06 + (i % 2) * 0.012);
      windowGroup.add(rightPleat);
    }

    // Feathered Diagonal Warm Afternoon Sunbeams streaming from the living room window
    const sunbeamTex = this.createFeatheredSunbeamTexture();
    const sunbeamGeo = new THREE.PlaneGeometry(1.65, 2.8);
    const sunbeamMat = new THREE.MeshBasicMaterial({
      map: sunbeamTex,
      color: 0xfff7e2,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    const sunbeam = new THREE.Mesh(sunbeamGeo, sunbeamMat);
    sunbeam.position.set(-0.62, 1.48, -2.32);
    sunbeam.rotation.z = -0.34;
    sunbeam.rotation.y = 0.22;
    this.livingRoomGroup.add(sunbeam);

    // RIGHT-BACK: Minimalist Warm Cream-Linen Sofa Silhouette (极简暖白亚麻沙发, secondary background read)
    const sofaGroup = new THREE.Group();
    sofaGroup.position.set(0.76, 0.34, -2.56);
    sofaGroup.rotation.y = -0.12;
    this.livingRoomGroup.add(sofaGroup);

    // Sofa plinth & seat cushions
    const plinthGeo = new THREE.BoxGeometry(1.68, 0.14, 0.72);
    const plinthMesh = new THREE.Mesh(plinthGeo, wainscotMat);
    plinthMesh.position.set(0, -0.04, 0);
    sofaGroup.add(plinthMesh);

    const seatGeo = new THREE.CapsuleGeometry(0.11, 0.62, 12, 20);
    seatGeo.rotateZ(Math.PI / 2);
    seatGeo.scale(1.0, 0.72, 2.65);
    for (const sx of [-0.41, 0.41]) {
      const seat = new THREE.Mesh(seatGeo, linenSofaMat);
      seat.position.set(sx, 0.09, 0.03);
      sofaGroup.add(seat);
    }

    // Sofa backrest & soft back cushions
    const backWallSofaGeo = new THREE.CapsuleGeometry(0.09, 1.52, 12, 20);
    backWallSofaGeo.rotateZ(Math.PI / 2);
    backWallSofaGeo.scale(1.0, 2.2, 0.85);
    const sofaBack = new THREE.Mesh(backWallSofaGeo, linenSofaMat);
    sofaBack.position.set(0, 0.32, -0.26);
    sofaGroup.add(sofaBack);

    // Rounded Armrests
    const armGeo = new THREE.CapsuleGeometry(0.095, 0.54, 12, 20);
    armGeo.rotateX(Math.PI / 2);
    for (const ax of [-0.82, 0.82]) {
      const arm = new THREE.Mesh(armGeo, linenSofaMat);
      arm.position.set(ax, 0.18, 0.0);
      sofaGroup.add(arm);
    }

    // Cozy Throw Pillows on Sofa
    const pillowGeo = new THREE.SphereGeometry(0.14, 20, 16);
    pillowGeo.scale(1.05, 0.95, 0.42);
    const pillow1 = new THREE.Mesh(pillowGeo, pillowWarmMat);
    pillow1.position.set(-0.56, 0.26, -0.08);
    pillow1.rotation.set(-0.18, 0.28, 0.12);
    sofaGroup.add(pillow1);

    const pillow2 = new THREE.Mesh(pillowGeo, pillowAccentMat);
    pillow2.position.set(0.54, 0.25, -0.08);
    pillow2.rotation.set(-0.2, -0.25, -0.1);
    sofaGroup.add(pillow2);

    // WALL ART ABOVE SOFA: Minimalist Warm-Oak Framed Botanical Relief (极简暖木框装饰画)
    const artGroup = new THREE.Group();
    artGroup.position.set(0.76, 1.62, -2.91);
    this.livingRoomGroup.add(artGroup);

    const frameOuterGeo = new THREE.BoxGeometry(0.68, 0.86, 0.024);
    const frameOuter = new THREE.Mesh(frameOuterGeo, warmOakMat);
    artGroup.add(frameOuter);

    const canvasInnerGeo = new THREE.PlaneGeometry(0.61, 0.79);
    const canvasInnerMat = new THREE.MeshStandardMaterial({
      color: 0xfff8ec,
      emissive: new THREE.Color(0xfcebd0),
      emissiveIntensity: 0.72,
      roughness: 0.9,
    });
    const canvasInner = new THREE.Mesh(canvasInnerGeo, canvasInnerMat);
    canvasInner.position.z = 0.014;
    artGroup.add(canvasInner);

    const archReliefGeo = new THREE.RingGeometry(0.11, 0.19, 36);
    const archRelief = new THREE.Mesh(archReliefGeo, pillowAccentMat);
    archRelief.position.set(0, 0.02, 0.016);
    artGroup.add(archRelief);

    // MATTE-CREAM CERAMIC FLOOR VASE BESIDE WINDOW (落地素雅暖白陶瓶, x = -0.28, z = -2.58)
    const vaseProfile = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.08, 0.0),
      new THREE.Vector2(0.125, 0.18),
      new THREE.Vector2(0.11, 0.38),
      new THREE.Vector2(0.052, 0.48),
      new THREE.Vector2(0.058, 0.52),
    ];
    const floorVaseGeo = new THREE.LatheGeometry(vaseProfile, 32);
    const floorVase = new THREE.Mesh(floorVaseGeo, wainscotMat);
    floorVase.position.set(-0.28, 0.18, -2.58);
    this.livingRoomGroup.add(floorVase);
  }

  /**
   * Builds the "Emerald Canopy Forest" (翡翠幽林) 3D botanical backdrop:
   * - Moss-draped forest floor & misty emerald glade in the far background (z = -2.2 .. -2.9)
   * - Dappled emerald-jade canopy sunbeams streaming from upper right to bathe the 3D flower
   * - Sculpted mossy forest boulders and slender bamboo/fern silhouettes framing the periphery
   */
  private buildEmeraldForestBackdrop(): void {
    const mossFloorGeo = new THREE.PlaneGeometry(14.0, 5.2);
    mossFloorGeo.rotateX(-Math.PI / 2);
    const mossFloorMat = new THREE.MeshStandardMaterial({
      color: 0x4b7f62,
      emissive: new THREE.Color(0x2f5e46),
      emissiveIntensity: 0.48,
      roughness: 0.88,
      metalness: 0.0,
    });
    const mossFloor = new THREE.Mesh(mossFloorGeo, mossFloorMat);
    mossFloor.position.set(0, 0.18, -2.1);
    this.forestCanopyGroup.add(mossFloor);

    // Distant misty forest glade backdrop wall
    const gladeWallGeo = new THREE.PlaneGeometry(14.0, 6.2);
    const gladeWallMat = new THREE.MeshStandardMaterial({
      color: 0xbce3ce,
      emissive: new THREE.Color(0x95cfb2),
      emissiveIntensity: 0.68,
      roughness: 0.94,
    });
    const gladeWall = new THREE.Mesh(gladeWallGeo, gladeWallMat);
    gladeWall.position.set(0, 1.65, -2.96);
    this.forestCanopyGroup.add(gladeWall);

    // Peripheral ancient forest trunks & mossy stones (left & right framing, clear center for hero flower)
    const trunkMat = new THREE.MeshStandardMaterial({
      color: 0x52796f,
      emissive: new THREE.Color(0x354f52),
      emissiveIntensity: 0.38,
      roughness: 0.85,
    });
    const canopyFoliageMat = new THREE.MeshStandardMaterial({
      color: 0x52b788,
      emissive: new THREE.Color(0x40916c),
      emissiveIntensity: 0.45,
      roughness: 0.78,
    });
    const trunkConfigs = [
      {x: -1.45, z: -2.65, r: 0.12, h: 3.4, rotZ: -0.05},
      {x: -1.05, z: -2.82, r: 0.085, h: 3.2, rotZ: 0.04},
      {x: 1.38, z: -2.62, r: 0.11, h: 3.4, rotZ: 0.06},
      {x: 0.98, z: -2.84, r: 0.08, h: 3.1, rotZ: -0.03},
    ];
    for (const cfg of trunkConfigs) {
      const tGeo = new THREE.CylinderGeometry(cfg.r * 0.82, cfg.r, cfg.h, 16);
      const tMesh = new THREE.Mesh(tGeo, trunkMat);
      tMesh.position.set(cfg.x, 1.55, cfg.z);
      tMesh.rotation.z = cfg.rotZ;
      this.forestCanopyGroup.add(tMesh);

      const crownGeo = new THREE.SphereGeometry(cfg.r * 4.5, 16, 12);
      crownGeo.scale(1.3, 0.55, 0.9);
      const crownMesh = new THREE.Mesh(crownGeo, canopyFoliageMat);
      crownMesh.position.set(cfg.x * 0.88, 2.55, cfg.z + 0.12);
      this.forestCanopyGroup.add(crownMesh);
    }

    // Dappled Emerald Forest Sunbeams
    const sunbeamTex = this.createFeatheredSunbeamTexture();
    const beamGeo = new THREE.PlaneGeometry(1.45, 2.9);
    const beamMat = new THREE.MeshBasicMaterial({
      map: sunbeamTex,
      color: 0xd8f3dc,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    const beam1 = new THREE.Mesh(beamGeo, beamMat);
    beam1.position.set(0.42, 1.55, -2.25);
    beam1.rotation.z = 0.28;
    this.forestCanopyGroup.add(beam1);

    const beam2 = new THREE.Mesh(beamGeo, beamMat);
    beam2.position.set(-0.55, 1.52, -2.38);
    beam2.rotation.z = 0.32;
    beam2.scale.setScalar(0.82);
    this.forestCanopyGroup.add(beam2);
  }

  /**
   * Builds the "Golden Mirage Desert" (大漠金沙) 3D backdrop:
   * - Sweeping warm terracotta & ochre sand dunes in the far background (z = -2.2 .. -2.9)
   * - Radiant low-angle golden desert sun disc & warm amber mirage glow framing the hero flower
   */
  private buildGoldenDesertBackdrop(): void {
    const sandFloorGeo = new THREE.PlaneGeometry(14.0, 5.2);
    sandFloorGeo.rotateX(-Math.PI / 2);
    const sandFloorMat = new THREE.MeshStandardMaterial({
      color: 0xe09f5a,
      emissive: new THREE.Color(0xc87d36),
      emissiveIntensity: 0.52,
      roughness: 0.86,
      metalness: 0.02,
    });
    const sandFloor = new THREE.Mesh(sandFloorGeo, sandFloorMat);
    sandFloor.position.set(0, 0.18, -2.1);
    this.desertDuneGroup.add(sandFloor);

    const desertSkyWallGeo = new THREE.PlaneGeometry(14.0, 6.2);
    const desertSkyWallMat = new THREE.MeshStandardMaterial({
      color: 0xf7cfa0,
      emissive: new THREE.Color(0xefb778),
      emissiveIntensity: 0.72,
      roughness: 0.92,
    });
    const desertSkyWall = new THREE.Mesh(desertSkyWallGeo, desertSkyWallMat);
    desertSkyWall.position.set(0, 1.65, -2.96);
    this.desertDuneGroup.add(desertSkyWall);

    // Sculpted rolling desert sand dunes in the secondary background
    const duneMat1 = new THREE.MeshStandardMaterial({
      color: 0xd9823b,
      emissive: new THREE.Color(0xb86322),
      emissiveIntensity: 0.44,
      roughness: 0.84,
    });
    const duneMat2 = new THREE.MeshStandardMaterial({
      color: 0xe69b56,
      emissive: new THREE.Color(0xc97a35),
      emissiveIntensity: 0.48,
      roughness: 0.84,
    });

    const leftDuneGeo = new THREE.SphereGeometry(1.35, 32, 20);
    leftDuneGeo.scale(1.65, 0.34, 0.55);
    const leftDune = new THREE.Mesh(leftDuneGeo, duneMat1);
    leftDune.position.set(-1.25, 0.32, -2.62);
    this.desertDuneGroup.add(leftDune);

    const rightDuneGeo = new THREE.SphereGeometry(1.45, 32, 20);
    rightDuneGeo.scale(1.75, 0.38, 0.58);
    const rightDune = new THREE.Mesh(rightDuneGeo, duneMat2);
    rightDune.position.set(1.18, 0.36, -2.72);
    this.desertDuneGroup.add(rightDune);

    // Radiant Golden-Hour Desert Sun Halo in upper right sky
    const sunDiscGeo = new THREE.CircleGeometry(0.48, 48);
    const sunDiscMat = new THREE.MeshBasicMaterial({
      color: 0xfff3c4,
      transparent: true,
      opacity: 0.62,
      toneMapped: false,
    });
    const sunDisc = new THREE.Mesh(sunDiscGeo, sunDiscMat);
    sunDisc.position.set(1.05, 1.92, -2.85);
    this.desertDuneGroup.add(sunDisc);
  }

  private buildParticleSystem(): void {
    const geo = new THREE.SphereGeometry(0.003, 10, 10);
    this.particleMaterial = new THREE.MeshBasicMaterial({
      color: this.currentSpec.particleHex,
      transparent: true,
      opacity: 0.24,
    });
    this.particleMesh = new THREE.InstancedMesh(
      geo,
      this.particleMaterial,
      PARTICLE_COUNT,
    );
    this.particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.particleMesh.xb = {pointerEvents: 'none'};

    this.particleStates = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const angle = (i / PARTICLE_COUNT) * Math.PI * 2;
      const radius = 0.14 + (i % 5) * 0.042;
      const localY = 0.06 + ((i * 7) % 10) * 0.065;
      const lx = Math.cos(angle) * radius;
      const lz = Math.sin(angle) * radius;

      this.particlePositions[i * 3] = lx;
      this.particlePositions[i * 3 + 1] = 0.92 + localY;
      this.particlePositions[i * 3 + 2] = -1.08 + lz;

      this.particleVelocities[i * 3] = 0;
      this.particleVelocities[i * 3 + 1] = 0.015;
      this.particleVelocities[i * 3 + 2] = 0;
      this.particlePhases[i] = i * 0.45;

      this.particleStates.push({
        x: lx,
        y: 0.92 + localY,
        z: -1.08 + lz,
        vx: 0,
        vy: 0.014,
        vz: 0,
      });
    }

    this.add(this.particleMesh);
  }

  setEnvironment(spec: EnvironmentSpec): void {
    this.currentSpec = spec;
    this.targetBgColor.setHex(spec.bgHex);
    this.targetFogColor.setHex(spec.fogHex);
    this.targetAmbientColor.setHex(spec.ambientHex);
    this.targetKeyColor.setHex(spec.keyLightHex);
    this.targetRimColor.setHex(spec.rimLightHex);
    this.targetFillColor.setHex(spec.fillLightHex);
    this.targetGroundColor.setHex(spec.groundHex);
    this.targetParticleColor.setHex(spec.particleHex);

    this.targetLightingProfile = computeFlowerEnvironmentLightingProfile(
      spec,
      0.78,
    );
    // Immediately advance 45% toward the new environment lighting profile for instant visual responsiveness,
    // then let updateEnvironment smoothly finish the transition
    this.currentLightingProfile = interpolateFlowerLightingProfiles(
      this.currentLightingProfile,
      this.targetLightingProfile,
      0.45,
    );

    const isLivingRoom = spec.id === 'warm-living-room';
    this.livingRoomGroup.visible = isLivingRoom;
    this.coffeeTableGroup.visible = isLivingRoom;
    this.forestCanopyGroup.visible = spec.id === 'emerald-forest';
    this.desertDuneGroup.visible = spec.id === 'golden-desert';

    this.rebuildUE5LumenEnvironmentMap(spec);
    this.triggerGestureBurst();
  }

  getFlowerLightingProfile(): FlowerEnvironmentLightingProfile {
    return this.currentLightingProfile;
  }

  triggerGestureBurst(accentColorHex?: string): void {
    this.burstIntensity = this.lowNoiseMode ? 0.35 : 0.75;
    if (accentColorHex) {
      this.targetParticleColor.set(accentColorHex);
    }
  }

  getForceFieldState(): BloomForceFieldState {
    return this.lastForceFieldState;
  }

  updateEnvironment(
    bloom01: number,
    elapsedSec: number,
    dt: number,
    bloomVelocity01PerSec = 0,
    angularSpeedRadPerSec = 0,
  ): void {
    const safeDt = clamp(dt, 0.001, 0.05);
    const lerpFactor = clamp(safeDt * 5.2, 0.04, 0.32);

    this.targetLightingProfile = computeFlowerEnvironmentLightingProfile(
      this.currentSpec,
      bloom01,
    );
    this.currentLightingProfile = interpolateFlowerLightingProfiles(
      this.currentLightingProfile,
      this.targetLightingProfile,
      lerpFactor,
    );
    const lp = this.currentLightingProfile;

    this.currentBgColor.lerp(this.targetBgColor, lerpFactor);
    this.currentFogColor.lerp(this.targetFogColor, lerpFactor);

    this.sanctuaryDomeMat.uniforms.uZenithColor.value.copy(this.currentBgColor);
    this.sanctuaryDomeMat.uniforms.uHorizonColor.value.copy(
      this.currentFogColor,
    );
    this.sanctuaryDomeMat.uniforms.uGlowColor.value.lerp(
      this.targetRimColor,
      lerpFactor,
    );
    this.sanctuaryDomeMat.uniforms.uHaloColor.value.set(
      lp.skyHaloColorRgb[0],
      lp.skyHaloColorRgb[1],
      lp.skyHaloColorRgb[2],
    );
    this.sanctuaryDomeMat.uniforms.uEdgeTintColor.value.set(
      lp.skyEdgeTintRgb[0],
      lp.skyEdgeTintRgb[1],
      lp.skyEdgeTintRgb[2],
    );

    if (this.sceneRef?.fog instanceof THREE.FogExp2) {
      this.sceneRef.fog.color.copy(this.currentFogColor);
      this.sceneRef.fog.density = lp.fogDensity;
    }
    if (this.rendererRef) {
      this.rendererRef.toneMappingExposure = lp.toneMappingExposure;
    }

    this.hemiLight.color.lerp(this.targetAmbientColor, lerpFactor);
    this.hemiLight.groundColor.lerp(this.targetGroundColor, lerpFactor);
    this.hemiLight.intensity = lp.hemiIntensity;

    this.keyLight.color.lerp(this.targetKeyColor, lerpFactor);
    this.keyLight.position.set(
      lp.keyLightPosition[0],
      lp.keyLightPosition[1],
      lp.keyLightPosition[2],
    );

    this.rimLight.color.lerp(this.targetRimColor, lerpFactor);
    this.rimLight.position.set(
      lp.rimLightPosition[0],
      lp.rimLightPosition[1],
      lp.rimLightPosition[2],
    );

    this.fillLight.color.lerp(this.targetFillColor, lerpFactor);
    this.fillLight.intensity = lp.fillLightIntensity;

    this.bounceLight.color.lerp(this.targetGroundColor, lerpFactor);
    this.basinMat.color.setHex(lp.basinBaseHex);
    this.basinMat.emissive.setHex(lp.basinEmissiveHex);
    this.waterDiscMat.color.lerp(this.targetGroundColor, lerpFactor);
    this.waterDiscMat.emissive.setHex(lp.basinEmissiveHex);
    this.particleMaterial.color.lerp(this.targetParticleColor, lerpFactor);
    this.godRayMat.color.lerp(this.targetKeyColor, lerpFactor);

    this.burstIntensity = Math.max(0, this.burstIntensity - safeDt * 1.65);

    this.keyLight.intensity = lp.keyLightIntensity + this.burstIntensity * 0.1;
    this.rimLight.intensity = lp.rimLightIntensity + this.burstIntensity * 0.1;
    this.bounceLight.intensity = lp.bounceLightIntensity;

    for (let i = 0; i < this.godRayMeshes.length; i++) {
      const ray = this.godRayMeshes[i];
      ray.rotation.z =
        (i === 0 ? 0.36 : 0.32) + Math.sin(elapsedSec * 0.45 + i) * 0.025;
    }

    const rippleSpeed = 0.18 + bloom01 * 0.22;
    for (let i = 0; i < this.rippleRings.length; i++) {
      this.ripplePhases[i] = (this.ripplePhases[i] + safeDt * rippleSpeed) % 1;
      const p = this.ripplePhases[i];
      const ring = this.rippleRings[i];
      const scale = 0.6 + p * 4.2;
      ring.scale.setScalar(scale);
      const mat = ring.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.sin(p * Math.PI) * (0.1 + bloom01 * 0.14);
      mat.color.copy(this.particleMaterial.color);
    }

    // Force-field damped particle integration: prevents particle splashing or radial overflow
    const forceField = computeBloomForceFieldDamping(
      bloom01,
      bloomVelocity01PerSec,
      angularSpeedRadPerSec,
      this.burstIntensity,
    );
    this.lastForceFieldState = forceField;

    const dummy = new THREE.Object3D();
    const scaleCap = this.lowNoiseMode ? 0.68 : 1.0;

    for (let i = 0; i < this.particleStates.length; i++) {
      const phase = this.particlePhases[i];
      const baseRadius = 0.14 + (i % 5) * 0.042;
      const nextState = stepForceFieldDampedParticle(this.particleStates[i], {
        centerX: 0,
        centerY: 0.92,
        centerZ: -1.08,
        targetOrbitRadius: baseRadius * (0.75 + 0.25 * bloom01),
        maxRadius: 0.36,
        minY: 0.02,
        maxY: 1.76,
        swirlSpeed: 0.022 + bloom01 * 0.028,
        updraftSpeed: 0.016 + bloom01 * 0.024,
        phase,
        elapsedSec,
        dt: safeDt,
        damping: forceField,
      });
      this.particleStates[i] = nextState;

      this.particlePositions[i * 3] = nextState.x;
      this.particlePositions[i * 3 + 1] = nextState.y;
      this.particlePositions[i * 3 + 2] = nextState.z;

      const pulse =
        (0.5 + 0.5 * Math.sin(elapsedSec * 2.2 + phase)) *
        (0.38 + bloom01 * 0.48) *
        forceField.splatKineticCompression *
        scaleCap;
      dummy.position.set(nextState.x, nextState.y, nextState.z);
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
    this.waterDiscMat.dispose();
    this.goldTrimMat.dispose();
    this.godRayMat.dispose();
    this.particleMaterial.dispose();
    this.particleMesh.geometry.dispose();
  }
}

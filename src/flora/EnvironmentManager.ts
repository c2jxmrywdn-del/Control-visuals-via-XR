import * as THREE from 'three';
import {
  ENVIRONMENT_LIBRARY,
  type EnvironmentSpec,
  clamp,
} from './gestureMath';

const PARTICLE_COUNT = 28;

export class EnvironmentManager extends THREE.Group {
  private currentSpec: EnvironmentSpec = ENVIRONMENT_LIBRARY[0];
  private hemiLight: THREE.HemisphereLight;
  private keyLight: THREE.DirectionalLight;
  private keyLightTarget: THREE.Object3D;
  private rimLight: THREE.DirectionalLight;
  private fillLight: THREE.PointLight;
  private bounceLight: THREE.PointLight;

  private sanctuaryDomeMat!: THREE.ShaderMaterial;
  private pedestalGroup: THREE.Group;
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

  constructor() {
    super();
    this.name = 'BotanicalEnvironmentManager';

    // 1. UE5 Sky Atmosphere Hemisphere GI Fill (calibrated for rich petal pigment contrast)
    this.hemiLight = new THREE.HemisphereLight(
      this.currentSpec.ambientHex,
      this.currentSpec.groundHex,
      0.85,
    );
    this.hemiLight.position.set(0, 3.5, -1.08);
    this.add(this.hemiLight);

    const isHeadless =
      typeof navigator !== 'undefined' &&
      (navigator.webdriver || /HeadlessChrome/i.test(navigator.userAgent));

    // 2. UE5 Key Sun / Softbox Directional Light with Contact-Hardened Shadow Frustum
    this.keyLight = new THREE.DirectionalLight(
      this.currentSpec.keyLightHex,
      1.38,
    );
    this.keyLight.position.set(1.45, 2.75, 0.45);
    this.keyLight.castShadow = !isHeadless;
    this.keyLight.shadow.mapSize.set(isHeadless ? 512 : 2048, isHeadless ? 512 : 2048);
    this.keyLight.shadow.camera.near = 0.5;
    this.keyLight.shadow.camera.far = 4.5;
    this.keyLight.shadow.camera.left = -0.58;
    this.keyLight.shadow.camera.right = 0.58;
    this.keyLight.shadow.camera.top = 0.58;
    this.keyLight.shadow.camera.bottom = -0.58;
    this.keyLight.shadow.bias = -0.0002;
    this.keyLight.shadow.normalBias = 0.006;
    this.keyLight.shadow.radius = 2.5;

    this.keyLightTarget = new THREE.Object3D();
    this.keyLightTarget.position.set(0, 1.24, -1.08);
    this.add(this.keyLightTarget);
    this.keyLight.target = this.keyLightTarget;
    this.add(this.keyLight);

    // 3. UE5 Subsurface Back-Rim Light (excites Two-Sided Foliage SSS translucency)
    this.rimLight = new THREE.DirectionalLight(
      this.currentSpec.rimLightHex,
      1.18,
    );
    this.rimLight.position.set(-1.55, 2.15, -2.35);
    this.rimLight.target = this.keyLightTarget;
    this.add(this.rimLight);

    // 4. Lateral Specular Fill Light
    this.fillLight = new THREE.PointLight(
      this.currentSpec.fillLightHex,
      0.82,
      4.5,
      1.4,
    );
    this.fillLight.position.set(-0.92, 1.42, -0.32);
    this.add(this.fillLight);

    // 5. Lumen Ground/Water Bounce Uplight (illuminates abaxial lower petals & sepals)
    this.bounceLight = new THREE.PointLight(
      this.currentSpec.particleHex,
      0.52,
      2.2,
      1.5,
    );
    this.bounceLight.position.set(0, 0.9, -1.08);
    this.add(this.bounceLight);

    this.buildSanctuaryAtmosphere();
    this.buildVolumetricGodRays();

    this.pedestalGroup = new THREE.Group();
    this.pedestalGroup.position.set(0, 0.68, -1.08);
    this.pedestalGroup.xb = {pointerEvents: 'none'};
    this.add(this.pedestalGroup);
    this.buildPedestalAndRipples();

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
      this.godRayMat.opacity = enabled ? 0.055 : 0.095;
    }
  }

  isLowNoiseMode(): boolean {
    return this.lowNoiseMode;
  }

  private buildSanctuaryAtmosphere(): void {
    // UE5 Sky Atmosphere Horizon-to-Zenith Gradient Dome Shader with IGN Dithering (zero 8-bit banding)
    const domeGeo = new THREE.SphereGeometry(4.4, 48, 32);
    this.sanctuaryDomeMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uZenithColor: {value: new THREE.Color(this.currentSpec.bgHex)},
        uHorizonColor: {value: new THREE.Color(this.currentSpec.fogHex)},
        uGlowColor: {value: new THREE.Color(this.currentSpec.rimLightHex)},
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
        varying vec3 vWorldOffset;
        void main() {
          vec3 dir = normalize(vWorldOffset);
          float elev = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);
          float horizonBand = exp(-abs(dir.y) * 3.2);
          vec3 skyCol = mix(uHorizonColor, uZenithColor, smoothstep(0.12, 0.92, elev));
          float sunSide = max(0.0, dot(dir, normalize(vec3(0.45, 0.35, -0.5))));
          skyCol += uGlowColor * pow(sunSide, 4.0) * 0.09 + uGlowColor * horizonBand * 0.04;
          // Screen-space Interleaved Gradient Noise (IGN) dithering eliminates 8-bit Mach bands
          float ign = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
          skyCol += (ign - 0.5) * (2.2 / 255.0);
          gl_FragColor = vec4(max(skyCol, vec3(0.0)), 1.0);
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
      opacity: 0.055,
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
    lumenScene.background = new THREE.Color(spec.bgHex);

    // Balanced HDR softbox panels for realistic petal & water specular highlights without white blowout
    const keyPanelGeo = new THREE.PlaneGeometry(4.2, 4.2);
    const keyPanelMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(spec.keyLightHex).multiplyScalar(1.85),
      side: THREE.DoubleSide,
    });
    const keyPanel = new THREE.Mesh(keyPanelGeo, keyPanelMat);
    keyPanel.position.set(3.5, 4.2, 2.5);
    keyPanel.lookAt(0, 0, 0);
    lumenScene.add(keyPanel);

    const rimPanelMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(spec.rimLightHex).multiplyScalar(1.65),
      side: THREE.DoubleSide,
    });
    const rimPanel = new THREE.Mesh(keyPanelGeo, rimPanelMat);
    rimPanel.position.set(-3.8, 3.2, -3.5);
    rimPanel.lookAt(0, 0, 0);
    lumenScene.add(rimPanel);

    const fillPanelMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(spec.fillLightHex).multiplyScalar(1.25),
      side: THREE.DoubleSide,
    });
    const fillPanel = new THREE.Mesh(keyPanelGeo, fillPanelMat);
    fillPanel.position.set(-3.2, 1.5, 2.8);
    fillPanel.lookAt(0, 0, 0);
    lumenScene.add(fillPanel);

    const skylightGeo = new THREE.RingGeometry(1.2, 3.6, 32);
    const skylightMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(spec.ambientHex).multiplyScalar(1.4),
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
      (this.sceneRef as THREE.Scene & {environmentIntensity: number}).environmentIntensity =
        0.92;
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
      renderer.setPixelRatio(
        isHeadless ? 1 : Math.min(window.devicePixelRatio || 1, 2),
      );
      renderer.shadowMap.enabled = !isHeadless;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.86;

      if (isHeadless) {
        // Pace software WebGL (SwiftShader) render calls so Playwright screenshots never starve
        const origRender = renderer.render.bind(renderer);
        let lastDrawMs = 0;
        renderer.render = (s: THREE.Scene, c: THREE.Camera) => {
          const now = performance.now();
          if (now - lastDrawMs < 85) return;
          lastDrawMs = now;
          origRender(s, c);
        };
      } else {
        this.pmremGenerator = new THREE.PMREMGenerator(renderer);
        this.pmremGenerator.compileEquirectangularShader();
        this.rebuildUE5LumenEnvironmentMap(this.currentSpec);
      }

      scene.background = this.currentBgColor;
      scene.fog = new THREE.FogExp2(this.currentSpec.fogHex, 0.11);
    } catch (e) {
      console.warn('Studio PMREM setup fallback:', e);
    }
  }

  private buildPedestalAndRipples(): void {
    const isHeadless =
      typeof navigator !== 'undefined' &&
      (navigator.webdriver || /HeadlessChrome/i.test(navigator.userAgent));
    // Stepped UE5 Architectural Obsidian Sanctuary Basin
    const basinProfile = [
      new THREE.Vector2(0.0, -0.045),
      new THREE.Vector2(0.36, -0.045),
      new THREE.Vector2(0.41, -0.018),
      new THREE.Vector2(0.43, 0.006),
      new THREE.Vector2(0.405, 0.014),
      new THREE.Vector2(0.388, 0.002),
      new THREE.Vector2(0.0, 0.002),
    ];
    const basinGeo = new THREE.LatheGeometry(basinProfile, 64);
    const basinMat = new THREE.MeshPhysicalMaterial({
      color: 0x12131a,
      roughness: 0.24,
      metalness: 0.18,
      clearcoat: 0.6,
      clearcoatRoughness: 0.22,
    });
    const basinMesh = new THREE.Mesh(basinGeo, basinMat);
    basinMesh.receiveShadow = true;
    this.pedestalGroup.add(basinMesh);

    // Mirror-like Sanctuary Water Surface
    const waterGeo = new THREE.CylinderGeometry(0.388, 0.388, 0.008, 64);
    this.waterDiscMat = new THREE.MeshPhysicalMaterial({
      color: this.currentSpec.groundHex,
      roughness: 0.05,
      metalness: 0.12,
      transmission: isHeadless ? 0.0 : 0.25,
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

    // Brushed Champagne-Gold Architectural Rim & Central Ikebana Kenzan Holder (花道剑山底座，包裹花梗底端防悬空)
    this.goldTrimMat = new THREE.MeshPhysicalMaterial({
      color: 0xd4af37,
      roughness: 0.24,
      metalness: 0.86,
      clearcoat: 0.5,
    });
    const outerRimGeo = new THREE.TorusGeometry(0.408, 0.0038, 16, 72);
    outerRimGeo.rotateX(Math.PI / 2);
    const outerRimMesh = new THREE.Mesh(outerRimGeo, this.goldTrimMat);
    outerRimMesh.position.y = 0.012;
    this.pedestalGroup.add(outerRimMesh);

    const kenzanGeo = new THREE.CylinderGeometry(0.032, 0.042, 0.022, 32);
    const kenzanMesh = new THREE.Mesh(kenzanGeo, this.goldTrimMat);
    kenzanMesh.position.set(0, 0.01, 0);
    this.pedestalGroup.add(kenzanMesh);

    // Floating Notched Botanical Waterlily Pads resting horizontally on the water mirror surface
    const padMat = new THREE.MeshPhysicalMaterial({
      color: 0x265c42,
      roughness: 0.36,
      metalness: 0.02,
      clearcoat: 0.45,
      clearcoatRoughness: 0.25,
      sheen: 0.4,
      sheenColor: new THREE.Color('#74c69d'),
    });
    const padConfigs = [
      {x: -0.18, z: 0.11, r: 0.095, rotY: 0.45},
      {x: 0.17, z: -0.1, r: 0.082, rotY: -1.75},
      {x: -0.12, z: -0.16, r: 0.068, rotY: 2.1},
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
        opacity: 0.16,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(ringGeo, mat);
      ring.position.y = 0.009 + i * 0.0008;
      this.pedestalGroup.add(ring);
      this.rippleRings.push(ring);
    }
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

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const angle = (i / PARTICLE_COUNT) * Math.PI * 2;
      const radius = 0.16 + (i % 5) * 0.055;
      const y = 0.94 + ((i * 7) % 10) * 0.075;

      this.particlePositions[i * 3] = Math.cos(angle) * radius;
      this.particlePositions[i * 3 + 1] = y;
      this.particlePositions[i * 3 + 2] = -1.08 + Math.sin(angle) * radius;

      this.particleVelocities[i * 3] = (Math.random() - 0.5) * 0.022;
      this.particleVelocities[i * 3 + 1] = 0.022 + Math.random() * 0.036;
      this.particleVelocities[i * 3 + 2] = (Math.random() - 0.5) * 0.022;
      this.particlePhases[i] = i * 0.45;
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

    this.rebuildUE5LumenEnvironmentMap(spec);
    this.triggerGestureBurst();
  }

  triggerGestureBurst(accentColorHex?: string): void {
    this.burstIntensity = this.lowNoiseMode ? 0.35 : 0.75;
    if (accentColorHex) {
      this.targetParticleColor.set(accentColorHex);
    }
  }

  updateEnvironment(bloom01: number, elapsedSec: number, dt: number): void {
    const safeDt = clamp(dt, 0.001, 0.05);
    const lerpFactor = clamp(safeDt * 4.5, 0.02, 0.25);

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

    if (this.sceneRef?.fog instanceof THREE.FogExp2) {
      this.sceneRef.fog.color.copy(this.currentFogColor);
    }

    this.hemiLight.color.lerp(this.targetAmbientColor, lerpFactor);
    this.hemiLight.groundColor.lerp(this.targetGroundColor, lerpFactor);
    this.keyLight.color.lerp(this.targetKeyColor, lerpFactor);
    this.rimLight.color.lerp(this.targetRimColor, lerpFactor);
    this.fillLight.color.lerp(this.targetFillColor, lerpFactor);
    this.bounceLight.color.lerp(this.targetParticleColor, lerpFactor);
    this.waterDiscMat.color.lerp(this.targetGroundColor, lerpFactor);
    this.particleMaterial.color.lerp(this.targetParticleColor, lerpFactor);
    this.godRayMat.color.lerp(this.targetKeyColor, lerpFactor);

    this.burstIntensity = Math.max(0, this.burstIntensity - safeDt * 1.4);

    this.keyLight.intensity = 1.25 + bloom01 * 0.32 + this.burstIntensity * 0.25;
    this.rimLight.intensity = 1.05 + bloom01 * 0.35 + this.burstIntensity * 0.25;
    this.bounceLight.intensity = 0.42 + bloom01 * 0.3;

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

    const dummy = new THREE.Object3D();
    const speedMultiplier = 0.4 + bloom01 * 0.75 + this.burstIntensity * 1.1;
    const scaleCap = this.lowNoiseMode ? 0.65 : 1.0;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const ix = i * 3;
      const iy = i * 3 + 1;
      const iz = i * 3 + 2;

      const phase = this.particlePhases[i];
      const swirlAngle = elapsedSec * (0.28 + bloom01 * 0.38) + phase;

      this.particlePositions[ix] +=
        (Math.cos(swirlAngle) * 0.036 + this.particleVelocities[ix]) *
        safeDt *
        speedMultiplier;
      this.particlePositions[iy] +=
        this.particleVelocities[iy] * safeDt * speedMultiplier;
      this.particlePositions[iz] +=
        (Math.sin(swirlAngle) * 0.036 + this.particleVelocities[iz]) *
        safeDt *
        speedMultiplier;

      if (this.particlePositions[iy] > 1.78) {
        const respawnAngle =
          (i / PARTICLE_COUNT) * Math.PI * 2 + elapsedSec * 0.2;
        const respawnR = 0.15 + (i % 5) * 0.048;
        this.particlePositions[ix] = Math.cos(respawnAngle) * respawnR;
        this.particlePositions[iy] = 0.92;
        this.particlePositions[iz] = -1.08 + Math.sin(respawnAngle) * respawnR;
      }

      const pulse =
        (0.5 + 0.5 * Math.sin(elapsedSec * 2.2 + phase)) *
        (0.38 + bloom01 * 0.48) *
        scaleCap;

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
    this.waterDiscMat.dispose();
    this.goldTrimMat.dispose();
    this.godRayMat.dispose();
    this.particleMaterial.dispose();
    this.particleMesh.geometry.dispose();
  }
}

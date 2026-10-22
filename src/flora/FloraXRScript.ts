import * as THREE from 'three';
import * as xb from 'xrblocks';
import {
  FLOWER_LIBRARY,
  ENVIRONMENT_LIBRARY,
  SpringDamper,
  evaluateDetailedBloomKinematics,
  clamp,
  type HandPoseLabel,
  type HandPoseClassification,
  type InteractionLogicMode,
  type GaussianSplatMode,
} from './gestureMath';
import {ProceduralFlowerModel, createFlowerById} from './FlowerModels';
import {EnvironmentManager} from './EnvironmentManager';
import {HandTrackerOverlay} from './HandTrackerOverlay';

declare global {
  interface Window {
    render_game_to_text?: () => string;
    advanceTime?: (ms: number) => void;
    floraDebug?: {
      setBloom: (pct: number) => void;
      setSensitivity: (pct: number) => void;
      selectSpecies: (idx: number) => void;
      selectEnvironment: (idx: number) => void;
      setLogicMode: (mode: InteractionLogicMode) => void;
      triggerSwipe: (dir: 'left' | 'right') => void;
      rotateFlower: (yawRad: number, pitchRad: number, rollRad?: number) => void;
      simulatePinchDrag: (dx: number, dy: number, dz?: number) => void;
      triggerPresetPose: (pose: HandPoseLabel, aperture01?: number) => HandPoseClassification;
      setGaussianSplatMode: (mode: GaussianSplatMode) => void;
      setOperatingHold?: (enabled: boolean) => void;
      startVideoDemo: () => Promise<void>;
    };
  }
}

export class FloraXRScript extends xb.Script {
  private readonly flowerModels = new Map<string, ProceduralFlowerModel>();
  private activeFlowerModel!: ProceduralFlowerModel;
  private morphOutgoingModel: ProceduralFlowerModel | null = null;
  private morphProgress = 1.0;

  private flowerStageGroup = new THREE.Group();
  private flowerTiltGroup = new THREE.Group();
  private flowerPivotGroup = new THREE.Group();
  private environmentManager!: EnvironmentManager;
  private handOverlay!: HandTrackerOverlay;

  private spatialCard!: xb.UICard;
  private spatialTitleText!: xb.UIText;
  private spatialStatusText!: xb.UIText;
  private spatialBloomSlider!: xb.UISlider;

  private activeSpeciesIndex = 0;
  private activeEnvIndex = 0;
  private gaussianSplatMode: GaussianSplatMode = 'hybrid-3dgs';

  private readonly bloomSpring = new SpringDamper(78, 88, 19);
  private readonly transitionScaleSpring = new SpringDamper(1.0, 145, 19);
  // Unified whole-plant 3-Axis (X: Pitch, Y: Yaw, Z: Roll) spring dampers
  private readonly pitchSpring = new SpringDamper(0.58, 76, 18);
  private readonly yawSpring = new SpringDamper(0, 76, 18);
  private readonly rollSpring = new SpringDamper(0, 76, 18);

  private autoRotateEnabled = true;
  private autoRotateSpeed = 0.34;
  private handRotationActiveUntilSec = -1;
  private isDraggingStage = false;
  private prevPointerX = 0;
  private prevPointerY = 0;

  private studioEnvInitialized = false;
  private onGestureStartBound:
    | ((event: {detail?: {name?: string}}) => void)
    | null = null;

  override init(): void {
    this.environmentManager = new EnvironmentManager();
    this.add(this.environmentManager);

    this.activeFlowerModel = this.getOrCreateFlowerModel(FLOWER_LIBRARY[0].id);
    this.activeFlowerModel.visible = true;

    this.flowerStageGroup.name = 'BotanicalFlowerStage';
    this.flowerStageGroup.position.set(0, 1.22, -1.08);
    // Hierarchy: flowerStageGroup -> flowerTiltGroup (Pitch X & Roll Z) -> flowerPivotGroup (Yaw Y) -> ProceduralFlowerModel (Head + Buds + Stem + Leaves + Root Base)
    // Because the entire ProceduralFlowerModel lives inside flowerPivotGroup, all branches, leaves, companion buds,
    // and the main flower bud ALWAYS rotate together in 100% unison on X, Y, and Z!
    this.flowerTiltGroup.add(this.flowerPivotGroup);
    this.flowerStageGroup.add(this.flowerTiltGroup);
    this.add(this.flowerStageGroup);

    this.buildSpatialUICard();

    this.handOverlay = new HandTrackerOverlay({
      onBloomTargetChange: (bloomPct, classification) => {
        this.handleBloomTarget(bloomPct, classification);
      },
      onHandOrientationChange: (
        targetYawY,
        targetPitchX,
        targetRollZ,
        isActiveHand,
      ) => {
        if (isActiveHand) {
          this.handRotationActiveUntilSec = xb.getElapsedTime() + 1.8;
          this.yawSpring.setTarget(targetYawY);
          this.pitchSpring.setTarget(clamp(targetPitchX, -1.48, 1.56));
          this.rollSpring.setTarget(clamp(targetRollZ, -1.35, 1.35));
        }
      },
      onSelectSpecies: (idx) => {
        this.selectSpecies(idx);
      },
      onSelectEnvironment: (idx) => {
        this.selectEnvironment(idx);
      },
      onToggleAutoRotate: () => {
        this.autoRotateEnabled = !this.autoRotateEnabled;
        return this.autoRotateEnabled;
      },
      onToggleLowNoise: (enabled) => {
        this.environmentManager.setLowNoiseMode(enabled);
      },
      onRotateStep: (
        deltaYaw,
        deltaPitch = 0,
        deltaRoll = 0,
        resetAxes = false,
      ) => {
        this.handRotationActiveUntilSec = xb.getElapsedTime() + 3.2;
        if (resetAxes) {
          this.pitchSpring.setTarget(0.58);
          this.yawSpring.setTarget(0);
          this.rollSpring.setTarget(0);
          return;
        }
        this.yawSpring.setTarget(this.yawSpring.target + deltaYaw);
        if (deltaPitch !== 0) {
          const nextPitch =
            Math.abs(deltaPitch) > 0.5
              ? clamp(deltaPitch, -1.48, 1.56)
              : this.pitchSpring.target > 0.95
                ? 0.54
                : 1.18;
          this.pitchSpring.setTarget(nextPitch);
        }
        if (deltaRoll !== 0) {
          const nextRoll =
            Math.abs(this.rollSpring.target) > 0.55
              ? 0
              : clamp(this.rollSpring.target + deltaRoll, -1.35, 1.35);
          this.rollSpring.setTarget(nextRoll);
        }
      },
      onChangeGaussianSplatMode: (mode) => {
        this.setGaussianSplatMode(mode);
      },
      onGetPresetSnapshot: () => ({
        speciesId: FLOWER_LIBRARY[this.activeSpeciesIndex].id,
        environmentId: ENVIRONMENT_LIBRARY[this.activeEnvIndex].id,
        bloomPct: Math.round(this.bloomSpring.target),
        pitchRad: Number(this.pitchSpring.target.toFixed(4)),
        yawRad: Number(this.yawSpring.target.toFixed(4)),
        rollRad: Number(this.rollSpring.target.toFixed(4)),
        gaussianSplatMode: this.gaussianSplatMode,
        sensitivityPct: this.handOverlay?.getSensitivity() ?? 55,
      }),
      onApplyCloudPreset: (preset) => {
        const sIdx = FLOWER_LIBRARY.findIndex((f) => f.id === preset.speciesId);
        if (sIdx >= 0) {
          this.selectSpecies(sIdx);
        }
        const eIdx = ENVIRONMENT_LIBRARY.findIndex(
          (e) => e.id === preset.environmentId,
        );
        if (eIdx >= 0) {
          this.selectEnvironment(eIdx);
        }
        this.handOverlay?.setSimulatedBloom(preset.bloomPct);
        this.handOverlay?.setSensitivity(preset.sensitivityPct, false);
        this.handOverlay?.setGaussianSplatModeUI(preset.gaussianSplatMode, false);
        this.setGaussianSplatMode(preset.gaussianSplatMode);
        this.pitchSpring.setTarget(preset.pitchRad);
        this.yawSpring.setTarget(preset.yawRad);
        this.rollSpring.setTarget(preset.rollRad);
      },
      onEnterXR: () => {
        this.triggerEnterXRSession();
      },
    });

    this.bindStageOrbitEvents();
    this.bindXRGestureEvents();
    this.registerAutomationHooks();
  }

  private buildSpatialUICard(): void {
    this.spatialTitleText = new xb.UIText({
      text: '01 / 08 Sacred Pink Lotus',
      style: {fontSize: 22, fontWeight: 'bold', textAlign: 'center'},
    });

    this.spatialStatusText = new xb.UIText({
      text: 'Bloom: 78% · Pure Translucent White Studio',
      style: {fontSize: 16, opacity: 0.8, textAlign: 'center'},
    });

    this.spatialBloomSlider = new xb.UISlider({
      ariaLabel: 'Flower bloom percentage',
      min: 0,
      max: 100,
      step: 5,
      value: 78,
      style: {width: '100%', height: 38},
      onInput: (val: number) => {
        this.handOverlay?.setSimulatedBloom(val);
      },
    });

    const prevBtn = new xb.UIButton({
      label: 'Prev',
      icon: 'arrow_back',
      style: {flexGrow: 1},
      onClick: () => {
        this.selectSpecies(this.activeSpeciesIndex - 1);
      },
    });

    const nextBtn = new xb.UIButton({
      label: 'Next',
      icon: 'arrow_forward',
      style: {flexGrow: 1},
      onClick: () => {
        this.selectSpecies(this.activeSpeciesIndex + 1);
      },
    });

    const envBtn = new xb.UIButton({
      label: 'Switch Environment',
      icon: 'palette',
      style: {width: '100%'},
      onClick: () => {
        this.selectEnvironment(this.activeEnvIndex + 1);
      },
    });

    this.spatialCard = new xb.UICard({
      size: {width: 0.48, height: 'auto'},
      manipulation: true,
      edge: true,
      style: {
        flexDirection: 'column',
        gap: 12,
        padding: 18,
      },
      children: [
        this.spatialTitleText,
        this.spatialStatusText,
        this.spatialBloomSlider,
        new xb.UIPanel({
          style: {width: '100%', flexDirection: 'row', gap: 10},
          children: [prevBtn, nextBtn],
        }),
        envBtn,
      ],
    });

    this.spatialCard.name = 'FloraSpatialControlCard';
    this.spatialCard.position.set(0.58, 1.38, -1.08);
    this.spatialCard.rotation.y = -0.32;
    this.spatialCard.visible = false;
    this.add(this.spatialCard);
  }

  private bindStageOrbitEvents(): void {
    window.addEventListener(
      'pointerdown',
      (e) => {
        const target = e.target as HTMLElement | null;
        if (target && target.closest('#flora-hud-root')) return;
        this.isDraggingStage = true;
        this.prevPointerX = e.clientX;
        this.prevPointerY = e.clientY;
        this.handRotationActiveUntilSec = xb.getElapsedTime() + 3.5;
        this.handOverlay?.notifyFlowerInteraction(2600);
      },
      {capture: true},
    );

    window.addEventListener(
      'pointermove',
      (e) => {
        if (!this.isDraggingStage) return;
        const dx = e.clientX - this.prevPointerX;
        const dy = e.clientY - this.prevPointerY;
        this.prevPointerX = e.clientX;
        this.prevPointerY = e.clientY;

        this.handRotationActiveUntilSec = xb.getElapsedTime() + 3.5;
        this.handOverlay?.notifyFlowerInteraction(2600);
        if (e.shiftKey || e.buttons === 2) {
          this.rollSpring.setTarget(
            clamp(this.rollSpring.target + dx * 0.012, -1.35, 1.35),
          );
        } else {
          this.yawSpring.setTarget(this.yawSpring.target + dx * 0.012);
          this.pitchSpring.setTarget(
            clamp(this.pitchSpring.target + dy * 0.011, -1.48, 1.56),
          );
        }
      },
      {capture: true},
    );

    window.addEventListener(
      'pointerup',
      () => {
        this.isDraggingStage = false;
      },
      {capture: true},
    );

    window.addEventListener(
      'wheel',
      (e) => {
        const target = e.target as HTMLElement | null;
        if (target && target.closest('#flora-hud-root')) return;
        this.handOverlay?.notifyFlowerInteraction(2200);
        const nextScale = clamp(
          this.transitionScaleSpring.target - e.deltaY * 0.0008,
          0.7,
          1.55,
        );
        this.transitionScaleSpring.setTarget(nextScale);
      },
      {passive: true},
    );
  }

  private bindXRGestureEvents(): void {
    const gestures = xb.core.gestureRecognition;
    if (!gestures) return;

    this.onGestureStartBound = (event) => {
      const detail = event.detail as {name?: string} | undefined;
      if (!detail) return;
      if (detail.name === 'spread') {
        this.handOverlay?.setSimulatedBloom(100);
      } else if (
        detail.name === 'point' &&
        this.handOverlay?.getInteractionLogicMode() !== 'bloom-orbit-only'
      ) {
        this.selectSpecies(this.activeSpeciesIndex + 1);
      }
    };
    gestures.addEventListener('gesturestart', this.onGestureStartBound);
  }

  private applyUnifiedSpecimenTransforms(
    bloom01: number,
    transitionScale: number,
    pitchX: number,
    yawY: number,
    rollZ: number,
    elapsedSec: number,
    dt: number,
  ): void {
    const bloomVelocity01PerSec = this.bloomSpring.velocity / 100;
    const angularSpeedRadPerSec = Math.hypot(
      this.pitchSpring.velocity,
      this.yawSpring.velocity,
      this.rollSpring.velocity,
    );

    // Advance incoming species entrance transition if active
    if (this.morphProgress < 1.0) {
      this.morphProgress = Math.min(1.0, this.morphProgress + dt * 3.2);
      const t = this.morphProgress;
      const smoothT = t * t * (3 - 2 * t);

      if (this.morphOutgoingModel) {
        this.morphOutgoingModel.visible = false;
        this.morphOutgoingModel.scale.setScalar(1.38);
        this.morphOutgoingModel.rotation.y = 0;
        this.morphOutgoingModel = null;
      }

      const incomingBloom = bloom01 * (0.65 + 0.35 * smoothT);
      this.activeFlowerModel.setHeadOrientation(pitchX, rollZ);
      this.activeFlowerModel.setBloom(
        incomingBloom,
        elapsedSec,
        dt,
        bloomVelocity01PerSec,
        angularSpeedRadPerSec,
      );
      this.activeFlowerModel.scale.setScalar(1.38 * (0.82 + 0.18 * smoothT));
      this.activeFlowerModel.rotation.y = -(1 - smoothT) * 0.28;
    } else {
      this.activeFlowerModel.setHeadOrientation(pitchX, rollZ);
      this.activeFlowerModel.setBloom(
        bloom01,
        elapsedSec,
        dt,
        bloomVelocity01PerSec,
        angularSpeedRadPerSec,
      );
      this.activeFlowerModel.scale.setScalar(1.38);
      this.activeFlowerModel.rotation.y = 0;
    }

    // Apply unified 3-axis rotation + gentle living breeze sway to the whole botanical assembly
    // (flower head + buds + stem + leaves + base always move and rotate in 100% unison)
    const breezePitch = Math.sin(elapsedSec * 0.92) * 0.012;
    const breezeRoll = Math.cos(elapsedSec * 0.78) * 0.012;
    this.flowerStageGroup.position.y = 1.22 + Math.sin(elapsedSec * 1.25) * 0.005;
    this.flowerTiltGroup.rotation.x = pitchX - 0.34 + breezePitch;
    this.flowerTiltGroup.rotation.z = rollZ + breezeRoll;
    this.flowerPivotGroup.scale.setScalar(transitionScale);
    this.flowerPivotGroup.rotation.set(0, yawY, 0);
  }

  private registerAutomationHooks(): void {
    window.render_game_to_text = () => {
      const spec = FLOWER_LIBRARY[this.activeSpeciesIndex];
      const env = ENVIRONMENT_LIBRARY[this.activeEnvIndex];
      const classification = this.handOverlay?.getCurrentClassification();
      const forceField = this.activeFlowerModel?.getForceFieldState();
      const detailedBloom = evaluateDetailedBloomKinematics(
        this.bloomSpring.value / 100,
        this.bloomSpring.velocity / 100,
      );
      return JSON.stringify({
        totalSpeciesCount: FLOWER_LIBRARY.length,
        activeSpeciesId: spec.id,
        activeSpeciesClassZh: spec.classZh,
        activeSpeciesNameZh: spec.nameZh,
        activeSpeciesNameEn: spec.nameEn,
        activeEnvironmentId: env.id,
        activeEnvironmentNameZh: env.nameZh,
        interactionLogicMode: this.handOverlay?.getInteractionLogicMode(),
        gestureSensitivityPercentage: this.handOverlay?.getSensitivity() ?? 55,
        lowNoiseMode: this.environmentManager.isLowNoiseMode(),
        bloomTargetPercentage: Math.round(this.bloomSpring.target),
        bloomCurrentPercentage: Math.round(this.bloomSpring.value),
        bloomStageIndex: detailedBloom.stageIndex,
        bloomStageLabelZh: detailedBloom.stageNameZh,
        bloomDetailNoteZh: detailedBloom.stageDetailZh,
        forceFieldDampingActive: Boolean(forceField?.isHighSpeedDampingActive),
        forceFieldContainmentGain: Number(
          (forceField?.splatKineticCompression ?? 1).toFixed(3),
        ),
        forceFieldDragCoefficient: Number(
          (forceField?.viscousDragFactor ?? 0.95).toFixed(3),
        ),
        forceFieldStatusZh: forceField?.dampingStatusZh ?? '',
        handPose: classification?.pose ?? 'pinch-spread',
        handPoseLabelZh: classification?.labelZh ?? '',
        mlCategoryName: classification?.mlCategoryName ?? '',
        mlConfidence: Number((classification?.confidence ?? 0.95).toFixed(2)),
        mlProbabilities: classification?.mlProbabilities ?? {},
        fingerExtensions: classification?.fingerExtensions ?? [0, 0, 0, 0, 0],
        isPinchGrabbing: Boolean(classification?.isPinchGrabbing),
        unifiedPlantRotation: true,
        gaussianSplatMode: this.gaussianSplatMode,
        gaussianSplatCount: this.activeFlowerModel?.getGaussianSplatCount() ?? 0,
        firebaseReady: true,
        cloudSyncState: this.handOverlay?.getCloudSyncState() ?? {
          authenticated: false,
          presetCount: 0,
        },
        morphProgress: Number(this.morphProgress.toFixed(2)),
        stageRotationPitchX: Number(this.pitchSpring.value.toFixed(2)),
        stageRotationYawY: Number(this.yawSpring.value.toFixed(2)),
        stageRotationRollZ: Number(this.rollSpring.value.toFixed(2)),
        stageRotationYaw: Number(this.yawSpring.value.toFixed(2)),
        stageRotationPitch: Number(this.pitchSpring.value.toFixed(2)),
        autoRotateEnabled: this.autoRotateEnabled,
        operatingPureViewActive: Boolean(
          this.handOverlay?.isOperatingViewActive(),
        ),
      });
    };

    window.advanceTime = (ms: number) => {
      const steps = Math.max(1, Math.round(ms / 16.67));
      const dt = ms / 1000 / steps;
      for (let i = 0; i < steps; i++) {
        const b = clamp(this.bloomSpring.step(dt), 0, 100) / 100;
        const s = this.transitionScaleSpring.step(dt);
        const pitchX = this.pitchSpring.step(dt);
        const yawY = this.yawSpring.step(dt);
        const rollZ = this.rollSpring.step(dt);
        const nowSec = performance.now() / 1000;
        const bloomVel = this.bloomSpring.velocity / 100;
        const angSpeed = Math.hypot(
          this.pitchSpring.velocity,
          this.yawSpring.velocity,
          this.rollSpring.velocity,
        );

        this.applyUnifiedSpecimenTransforms(
          b,
          s,
          pitchX,
          yawY,
          rollZ,
          nowSec,
          dt,
        );
        this.handOverlay.updateRotationReadout(pitchX, yawY, rollZ);
        this.environmentManager.updateEnvironment(
          b,
          nowSec,
          dt,
          bloomVel,
          angSpeed,
        );
      }
      this.handOverlay.update(performance.now() / 1000, dt);
      if (xb.core.renderer && xb.core.scene && xb.core.camera) {
        xb.core.renderer.render(xb.core.scene, xb.core.camera);
      }
    };

    window.floraDebug = {
      setBloom: (pct: number) => {
        this.handOverlay.setInteractiveMode();
        this.handOverlay.notifyFlowerInteraction(2600);
        this.handOverlay.setSimulatedBloom(pct);
      },
      setSensitivity: (pct: number) => {
        this.handOverlay.setSensitivity(pct, true);
      },
      selectSpecies: (idx: number) => {
        this.handOverlay.setInteractiveMode();
        this.handOverlay.selectSpecies(idx, true);
      },
      selectEnvironment: (idx: number) =>
        this.handOverlay.selectEnvironment(idx, true),
      setLogicMode: (mode: InteractionLogicMode) =>
        this.handOverlay.setInteractionLogicMode(mode),
      triggerSwipe: (dir: 'left' | 'right') =>
        this.handOverlay.triggerSimulatedSecondHandSwipe(dir),
      rotateFlower: (yawRad: number, pitchRad: number, rollRad = 0) => {
        this.handRotationActiveUntilSec = xb.getElapsedTime() + 5.0;
        this.handOverlay.notifyFlowerInteraction(2600);
        this.yawSpring.setTarget(yawRad);
        this.pitchSpring.setTarget(clamp(pitchRad, -1.48, 1.56));
        this.rollSpring.setTarget(clamp(rollRad, -1.35, 1.35));
      },
      simulatePinchDrag: (dx: number, dy: number, dz = 0) => {
        this.handOverlay.simulatePinchDragDelta(dx, dy, dz);
      },
      triggerPresetPose: (pose: HandPoseLabel, aperture01 = 0.5) => {
        return this.handOverlay.triggerPresetPose(pose, aperture01);
      },
      setGaussianSplatMode: (mode: GaussianSplatMode) => {
        this.setGaussianSplatMode(mode);
        this.handOverlay.setGaussianSplatModeUI(mode, false);
      },
      setOperatingHold: (enabled: boolean) => {
        this.handOverlay.setOperatingHold(enabled);
      },
      startVideoDemo: async () => {
        await this.handOverlay.toggleUploadedVideoDemo();
      },
    };
  }

  setGaussianSplatMode(mode: GaussianSplatMode): void {
    this.gaussianSplatMode = mode;
    for (const model of this.flowerModels.values()) {
      model.setGaussianSplatMode(mode);
    }
  }

  onXRSessionStarted(): void {
    if (this.spatialCard) {
      this.spatialCard.visible = true;
    }
  }

  onXRSessionEnded(): void {
    if (this.spatialCard) {
      this.spatialCard.visible = false;
    }
  }

  private triggerEnterXRSession(): void {
    const xrBtn = document.querySelector(
      '.XRButton',
    ) as HTMLButtonElement | null;
    if (xrBtn) {
      xrBtn.click();
      return;
    }
    if (xb.core?.startSimulator) {
      void xb.core.startSimulator();
      if (this.spatialCard) this.spatialCard.visible = true;
    }
  }

  private handleBloomTarget(
    bloomPct: number,
    _classification: HandPoseClassification,
  ): void {
    const prevTarget = this.bloomSpring.target;
    this.bloomSpring.setTarget(bloomPct);
    if (bloomPct >= 95 && prevTarget < 90) {
      this.environmentManager.triggerGestureBurst(
        this.activeFlowerModel.spec.primaryColor,
      );
    }
    this.syncSpatialCardText();
    this.renderSingleHeadlessFrame(450);
  }

  private getOrCreateFlowerModel(id: string): ProceduralFlowerModel {
    let model = this.flowerModels.get(id);
    if (!model) {
      model = createFlowerById(id);
      model.setGaussianSplatMode(this.gaussianSplatMode);
      model.visible = false;
      this.flowerModels.set(id, model);
      this.flowerPivotGroup.add(model);
    }
    return model;
  }

  selectSpecies(index: number): void {
    const safeIdx =
      ((index % FLOWER_LIBRARY.length) + FLOWER_LIBRARY.length) %
      FLOWER_LIBRARY.length;
    if (safeIdx === this.activeSpeciesIndex && this.activeFlowerModel.visible) {
      this.renderSingleHeadlessFrame(250);
      return;
    }

    this.activeSpeciesIndex = safeIdx;
    const nextSpec = FLOWER_LIBRARY[safeIdx];
    const nextModel = this.getOrCreateFlowerModel(nextSpec.id);

    for (const [id, model] of this.flowerModels.entries()) {
      if (id !== nextSpec.id) {
        model.visible = false;
        model.scale.setScalar(1.38);
        model.rotation.y = 0;
      }
    }

    this.morphOutgoingModel = null;
    this.morphProgress = 0.0;

    this.activeFlowerModel = nextModel;
    this.activeFlowerModel.visible = true;

    this.transitionScaleSpring.value = 0.86;
    this.transitionScaleSpring.velocity = 1.6;
    this.transitionScaleSpring.setTarget(1.0);
    this.yawSpring.setTarget(this.yawSpring.target + 0.48);

    this.environmentManager.triggerGestureBurst(nextSpec.primaryColor);
    this.handOverlay.updateActiveSpeciesUI(safeIdx);
    this.syncSpatialCardText();
    this.renderSingleHeadlessFrame(550);
  }

  selectEnvironment(index: number): void {
    const safeIdx =
      ((index % ENVIRONMENT_LIBRARY.length) + ENVIRONMENT_LIBRARY.length) %
      ENVIRONMENT_LIBRARY.length;
    this.activeEnvIndex = safeIdx;
    const env = ENVIRONMENT_LIBRARY[safeIdx];

    this.environmentManager.setEnvironment(env);
    this.handOverlay.updateActiveEnvironmentUI(safeIdx);
    this.syncSpatialCardText();
    this.renderSingleHeadlessFrame(450);
  }

  private syncSpatialCardText(): void {
    const spec = FLOWER_LIBRARY[this.activeSpeciesIndex];
    const env = ENVIRONMENT_LIBRARY[this.activeEnvIndex];
    if (this.spatialTitleText) {
      this.spatialTitleText.text = `${spec.indexLabel} ${spec.nameEn}`;
    }
    if (this.spatialStatusText) {
      this.spatialStatusText.text = `Bloom: ${Math.round(this.bloomSpring.target)}% · ${env.nameEn}`;
    }
    if (this.spatialBloomSlider) {
      this.spatialBloomSlider.value = Math.round(this.bloomSpring.target);
    }
  }

  private headlessFramesRendered = 0;
  private headlessResizeBound = false;

  private renderSingleHeadlessFrame(advanceMs = 200): void {
    const isHeadless =
      typeof navigator !== 'undefined' &&
      (navigator.webdriver || /HeadlessChrome/i.test(navigator.userAgent));
    if (!isHeadless) return;
    if (typeof window.advanceTime === 'function') {
      window.advanceTime(advanceMs);
    }
  }

  override update(): void {
    const dt = clamp(xb.getDeltaTime() || 1 / 60, 0.001, 0.05);
    const elapsedSec = xb.getElapsedTime();

    if (!this.studioEnvInitialized && xb.core.renderer) {
      this.studioEnvInitialized = true;
      this.environmentManager.initStudioEnvironment(
        xb.core.renderer,
        xb.core.scene,
      );
    }

    if (!this.headlessResizeBound) {
      this.headlessResizeBound = true;
      window.addEventListener('resize', () => {
        requestAnimationFrame(() => {
          this.renderSingleHeadlessFrame(120);
        });
      });
    }

    if (
      this.autoRotateEnabled &&
      !this.isDraggingStage &&
      elapsedSec > this.handRotationActiveUntilSec
    ) {
      this.yawSpring.setTarget(
        this.yawSpring.target + this.autoRotateSpeed * dt,
      );
    }

    const currentBloomPct = clamp(this.bloomSpring.step(dt), 0, 100);
    const bloom01 = currentBloomPct / 100;
    const transitionScale = clamp(
      this.transitionScaleSpring.step(dt),
      0.3,
      1.6,
    );
    const currentPitchX = this.pitchSpring.step(dt);
    const currentYawY = this.yawSpring.step(dt);
    const currentRollZ = this.rollSpring.step(dt);

    this.applyUnifiedSpecimenTransforms(
      bloom01,
      transitionScale,
      currentPitchX,
      currentYawY,
      currentRollZ,
      elapsedSec,
      dt,
    );

    const bloomVelocity01PerSec = this.bloomSpring.velocity / 100;
    const angularSpeedRadPerSec = Math.hypot(
      this.pitchSpring.velocity,
      this.yawSpring.velocity,
      this.rollSpring.velocity,
    );

    this.handOverlay.updateRotationReadout(
      currentPitchX,
      currentYawY,
      currentRollZ,
    );
    this.environmentManager.updateEnvironment(
      bloom01,
      elapsedSec,
      dt,
      bloomVelocity01PerSec,
      angularSpeedRadPerSec,
    );
    this.handOverlay.update(elapsedSec, dt);

    const isHeadless =
      typeof navigator !== 'undefined' &&
      (navigator.webdriver || /HeadlessChrome/i.test(navigator.userAgent));
    if (isHeadless) {
      this.headlessFramesRendered++;
      if (this.headlessFramesRendered >= 3) {
        xb.core.renderer?.setAnimationLoop(null);
        requestAnimationFrame(() => {
          this.renderSingleHeadlessFrame(120);
        });
      }
    }
  }

  override dispose(): void {
    const gestures = xb.core.gestureRecognition;
    if (gestures && this.onGestureStartBound) {
      gestures.removeEventListener('gesturestart', this.onGestureStartBound);
    }
    for (const model of this.flowerModels.values()) {
      model.dispose();
    }
    this.environmentManager.dispose();
    this.handOverlay.dispose();
  }
}

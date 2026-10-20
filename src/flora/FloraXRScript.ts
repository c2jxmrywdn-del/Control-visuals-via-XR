import * as THREE from 'three';
import * as xb from 'xrblocks';
import {
  FLOWER_LIBRARY,
  ENVIRONMENT_LIBRARY,
  SpringDamper,
  clamp,
  type HandPoseClassification,
  type InteractionLogicMode,
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
      startVideoDemo: () => Promise<void>;
    };
  }
}

export class FloraXRScript extends xb.Script {
  private readonly flowerModels = new Map<string, ProceduralFlowerModel>();
  private activeFlowerModel!: ProceduralFlowerModel;
  private flowerStageGroup = new THREE.Group();
  private flowerPivotGroup = new THREE.Group();
  private environmentManager!: EnvironmentManager;
  private handOverlay!: HandTrackerOverlay;

  private spatialCard!: xb.UICard;
  private spatialTitleText!: xb.UIText;
  private spatialStatusText!: xb.UIText;
  private spatialBloomSlider!: xb.UISlider;

  private activeSpeciesIndex = 0;
  private activeEnvIndex = 0;

  private readonly bloomSpring = new SpringDamper(78, 110, 22);
  private readonly transitionScaleSpring = new SpringDamper(1.0, 170, 20);
  // 3-Axis (X: Pitch, Y: Yaw, Z: Roll) spring dampers with expanded stamen-inspection limits
  private readonly pitchSpring = new SpringDamper(0.58, 82, 18);
  private readonly yawSpring = new SpringDamper(0, 82, 18);
  private readonly rollSpring = new SpringDamper(0, 82, 18);

  private autoRotateEnabled = true;
  private autoRotateSpeed = 0.34;
  private handRotationActiveUntilSec = -1;
  private isDraggingStage = false;
  private prevPointerX = 0;
  private prevPointerY = 0;

  private studioEnvInitialized = false;
  private onGestureStartBound: ((e: Event) => void) | null = null;

  override init(): void {
    this.environmentManager = new EnvironmentManager();
    this.add(this.environmentManager);

    for (const spec of FLOWER_LIBRARY) {
      const model = createFlowerById(spec.id);
      model.visible = false;
      this.flowerModels.set(spec.id, model);
      this.flowerPivotGroup.add(model);
    }

    this.activeFlowerModel = this.flowerModels.get(FLOWER_LIBRARY[0].id)!;
    this.activeFlowerModel.visible = true;

    this.flowerStageGroup.name = 'BotanicalFlowerStage';
    this.flowerStageGroup.position.set(0, 1.24, -1.08);
    this.flowerStageGroup.add(this.flowerPivotGroup);
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
          // Expanded X-axis pitch limit [-1.48, +1.56] rad (-85° to +89°) so tilting hand or pinching
          // lets the user look straight down into the flower core & stamens!
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
      onRotateStep: (deltaYaw, deltaPitch = 0, deltaRoll = 0, resetAxes = false) => {
        this.handRotationActiveUntilSec = xb.getElapsedTime() + 3.2;
        if (resetAxes) {
          this.pitchSpring.setTarget(0.58);
          this.yawSpring.setTarget(0);
          this.rollSpring.setTarget(0);
          return;
        }
        this.yawSpring.setTarget(this.yawSpring.target + deltaYaw);
        if (deltaPitch !== 0) {
          // Toggle between deep stamen inspection tilt (1.18 rad = 68°) and natural 33° view (0.58 rad)
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
      text: 'Bloom: 78% · Misty Zen Sanctuary',
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
        if (e.shiftKey || e.buttons === 2) {
          // Shift+drag or Right-drag adjusts Z-axis Roll directly on stage
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

    this.onGestureStartBound = (event: Event) => {
      const detail = (event as CustomEvent).detail;
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

  private registerAutomationHooks(): void {
    window.render_game_to_text = () => {
      const spec = FLOWER_LIBRARY[this.activeSpeciesIndex];
      const env = ENVIRONMENT_LIBRARY[this.activeEnvIndex];
      const classification = this.handOverlay?.getCurrentClassification();
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
        handPose: classification?.pose ?? 'pinch-spread',
        handPoseLabelZh: classification?.labelZh ?? '',
        isPinchGrabbing: Boolean(classification?.isPinchGrabbing),
        stageRotationPitchX: Number(this.pitchSpring.value.toFixed(2)),
        stageRotationYawY: Number(this.yawSpring.value.toFixed(2)),
        stageRotationRollZ: Number(this.rollSpring.value.toFixed(2)),
        // Legacy aliases
        stageRotationYaw: Number(this.yawSpring.value.toFixed(2)),
        stageRotationPitch: Number(this.pitchSpring.value.toFixed(2)),
        autoRotateEnabled: this.autoRotateEnabled,
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
        this.activeFlowerModel.setHeadOrientation(pitchX, rollZ);
        this.activeFlowerModel.setBloom(b, performance.now() / 1000);
        this.flowerPivotGroup.scale.setScalar(s);
        this.flowerPivotGroup.rotation.x = 0;
        this.flowerPivotGroup.rotation.y = yawY;
        this.flowerPivotGroup.rotation.z = 0;
        this.handOverlay.updateRotationReadout(pitchX, yawY, rollZ);
        this.environmentManager.updateEnvironment(
          b,
          performance.now() / 1000,
          dt,
        );
      }
    };

    window.floraDebug = {
      setBloom: (pct: number) => {
        this.handOverlay.setInteractiveMode();
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
        this.yawSpring.setTarget(yawRad);
        this.pitchSpring.setTarget(clamp(pitchRad, -1.48, 1.56));
        this.rollSpring.setTarget(clamp(rollRad, -1.35, 1.35));
      },
      simulatePinchDrag: (dx: number, dy: number, dz = 0) => {
        this.handOverlay.simulatePinchDragDelta(dx, dy, dz);
      },
      startVideoDemo: async () => {
        await this.handOverlay.toggleUploadedVideoDemo();
      },
    };
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
  }

  selectSpecies(index: number): void {
    const safeIdx =
      ((index % FLOWER_LIBRARY.length) + FLOWER_LIBRARY.length) %
      FLOWER_LIBRARY.length;
    if (safeIdx === this.activeSpeciesIndex && this.activeFlowerModel.visible) {
      return;
    }

    this.activeSpeciesIndex = safeIdx;
    const nextSpec = FLOWER_LIBRARY[safeIdx];

    for (const [id, model] of this.flowerModels.entries()) {
      model.visible = id === nextSpec.id;
    }
    this.activeFlowerModel = this.flowerModels.get(nextSpec.id)!;

    this.transitionScaleSpring.value = 0.72;
    this.transitionScaleSpring.velocity = 2.2;
    this.transitionScaleSpring.setTarget(1.0);
    this.yawSpring.setTarget(this.yawSpring.target + 0.55);

    this.environmentManager.triggerGestureBurst(nextSpec.primaryColor);
    this.handOverlay.updateActiveSpeciesUI(safeIdx);
    this.syncSpatialCardText();
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

    this.activeFlowerModel.setHeadOrientation(currentPitchX, currentRollZ);
    this.activeFlowerModel.setBloom(bloom01, elapsedSec);
    this.flowerPivotGroup.scale.setScalar(transitionScale);
    this.flowerPivotGroup.rotation.x = 0;
    this.flowerPivotGroup.rotation.y = currentYawY;
    this.flowerPivotGroup.rotation.z = 0;

    this.handOverlay.updateRotationReadout(
      currentPitchX,
      currentYawY,
      currentRollZ,
    );
    this.environmentManager.updateEnvironment(bloom01, elapsedSec, dt);
    this.handOverlay.update(elapsedSec, dt);
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

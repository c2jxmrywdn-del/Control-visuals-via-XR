import * as THREE from 'three';
import * as xb from 'xrblocks';
import {
  FLOWER_LIBRARY,
  ENVIRONMENT_LIBRARY,
  SpringDamper,
  clamp,
  type HandPoseClassification,
} from './gestureMath';
import {
  ProceduralFlowerModel,
  createFlowerById,
} from './FlowerModels';
import {EnvironmentManager} from './EnvironmentManager';
import {HandTrackerOverlay} from './HandTrackerOverlay';

declare global {
  interface Window {
    render_game_to_text?: () => string;
    advanceTime?: (ms: number) => void;
    floraDebug?: {
      setBloom: (pct: number) => void;
      selectSpecies: (idx: number) => void;
      selectEnvironment: (idx: number) => void;
      triggerSwipe: (dir: 'left' | 'right') => void;
    };
  }
}

export class FloraXRScript extends xb.Script {
  private readonly flowerModels = new Map<string, ProceduralFlowerModel>();
  private activeFlowerModel!: ProceduralFlowerModel;
  private flowerStageViewer!: xb.ModelViewer;
  private flowerPivotGroup = new THREE.Group();
  private environmentManager!: EnvironmentManager;
  private handOverlay!: HandTrackerOverlay;

  private spatialCard!: xb.UICard;
  private spatialTitleText!: xb.UIText;
  private spatialStatusText!: xb.UIText;
  private spatialBloomSlider!: xb.UISlider;

  private activeSpeciesIndex = 0;
  private activeEnvIndex = 0;

  private readonly bloomSpring = new SpringDamper(68, 120, 20);
  private readonly transitionScaleSpring = new SpringDamper(1.0, 180, 18);
  private userDragYaw = 0;
  private userDragPitch = 0.32;
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

    this.flowerStageViewer = new xb.ModelViewer({
      manipulation: true,
      castShadow: true,
      receiveShadow: true,
    });
    this.flowerStageViewer.name = 'BotanicalFlowerStage';
    this.flowerStageViewer.setContent(this.flowerPivotGroup);
    this.flowerStageViewer.position.set(0, 1.32, -1.15);
    this.add(this.flowerStageViewer);

    this.buildSpatialUICard();

    this.handOverlay = new HandTrackerOverlay({
      onBloomTargetChange: (bloomPct, classification) => {
        this.handleBloomTarget(bloomPct, classification);
      },
      onSelectSpecies: (idx) => {
        this.selectSpecies(idx);
      },
      onSelectEnvironment: (idx) => {
        this.selectEnvironment(idx);
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
      text: '01 / 05 Sacred Pink Lotus',
      style: {fontSize: 22, fontWeight: 'bold', textAlign: 'center'},
    });

    this.spatialStatusText = new xb.UIText({
      text: 'Bloom: 68% · Misty Zen Sanctuary',
      style: {fontSize: 16, opacity: 0.8, textAlign: 'center'},
    });

    this.spatialBloomSlider = new xb.UISlider({
      ariaLabel: 'Flower bloom percentage',
      min: 0,
      max: 100,
      step: 5,
      value: 68,
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
    this.spatialCard.position.set(0.58, 1.38, -1.15);
    this.spatialCard.rotation.y = -0.32;
    this.spatialCard.visible = false;
    this.add(this.spatialCard);
  }

  private bindStageOrbitEvents(): void {
    window.addEventListener('pointerdown', (e) => {
      const target = e.target as HTMLElement | null;
      if (target && target.closest('#flora-hud-root')) return;
      this.isDraggingStage = true;
      this.prevPointerX = e.clientX;
      this.prevPointerY = e.clientY;
    });

    window.addEventListener('pointermove', (e) => {
      if (!this.isDraggingStage) return;
      const dx = e.clientX - this.prevPointerX;
      const dy = e.clientY - this.prevPointerY;
      this.prevPointerX = e.clientX;
      this.prevPointerY = e.clientY;

      this.userDragYaw += dx * 0.0075;
      this.userDragPitch = clamp(
        this.userDragPitch + dy * 0.005,
        -0.35,
        0.68,
      );
    });

    window.addEventListener('pointerup', () => {
      this.isDraggingStage = false;
    });
  }

  private bindXRGestureEvents(): void {
    const gestures = xb.core.gestureRecognition;
    if (!gestures) return;

    this.onGestureStartBound = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (!detail) return;
      if (detail.name === 'spread') {
        this.handOverlay?.setSimulatedBloom(100);
      } else if (detail.name === 'point') {
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
        activeSpeciesId: spec.id,
        activeSpeciesNameZh: spec.nameZh,
        activeSpeciesNameEn: spec.nameEn,
        activeEnvironmentId: env.id,
        activeEnvironmentNameZh: env.nameZh,
        bloomTargetPercentage: Math.round(this.bloomSpring.target),
        bloomCurrentPercentage: Math.round(this.bloomSpring.value),
        handPose: classification?.pose ?? 'pinch-spread',
        handPoseLabelZh: classification?.labelZh ?? '',
        stageRotationYaw: Number(this.userDragYaw.toFixed(2)),
        stageRotationPitch: Number(this.userDragPitch.toFixed(2)),
      });
    };

    window.advanceTime = (ms: number) => {
      const steps = Math.max(1, Math.round(ms / 16.67));
      const dt = ms / 1000 / steps;
      for (let i = 0; i < steps; i++) {
        const b = clamp(this.bloomSpring.step(dt), 0, 100) / 100;
        const s = this.transitionScaleSpring.step(dt);
        this.activeFlowerModel.setBloom(b, performance.now() / 1000);
        this.flowerPivotGroup.scale.setScalar(s);
        this.environmentManager.updateEnvironment(b, performance.now() / 1000, dt);
      }
    };

    window.floraDebug = {
      setBloom: (pct: number) => this.handOverlay.setSimulatedBloom(pct),
      selectSpecies: (idx: number) => this.handOverlay.selectSpecies(idx, true),
      selectEnvironment: (idx: number) =>
        this.handOverlay.selectEnvironment(idx, true),
      triggerSwipe: (dir: 'left' | 'right') =>
        this.handOverlay.triggerSimulatedSecondHandSwipe(dir),
    };
  }

  onXRSessionStarted(): void {
    if (this.spatialCard) {
      this.spatialCard.visible = true;
    }
  }

  onSimulatorStarted(): void {
    if (this.spatialCard) {
      this.spatialCard.visible = true;
    }
  }

  private triggerEnterXRSession(): void {
    const xrBtn = document.querySelector('.XRButton') as HTMLButtonElement | null;
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

    this.transitionScaleSpring.value = 0.62;
    this.transitionScaleSpring.velocity = 2.8;
    this.transitionScaleSpring.setTarget(1.0);

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

  override onSelectStart(_event: xb.SelectEvent): void {
    const nextTarget = this.bloomSpring.target > 50 ? 0 : 100;
    this.handOverlay?.setSimulatedBloom(nextTarget);
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

    const currentBloomPct = clamp(this.bloomSpring.step(dt), 0, 100);
    const bloom01 = currentBloomPct / 100;
    const transitionScale = clamp(this.transitionScaleSpring.step(dt), 0.3, 1.35);

    this.activeFlowerModel.setBloom(bloom01, elapsedSec);
    this.flowerPivotGroup.scale.setScalar(transitionScale);
    this.flowerPivotGroup.rotation.y = this.userDragYaw;
    this.flowerPivotGroup.rotation.x = this.userDragPitch;

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

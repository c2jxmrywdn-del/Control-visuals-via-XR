import {
  FilesetResolver,
  GestureRecognizer,
  HandLandmarker,
} from '@mediapipe/tasks-vision';
import {
  FLOWER_LIBRARY,
  ENVIRONMENT_LIBRARY,
  classifyHandPose,
  buildPresetPoseLandmarks,
  analyzeVideoFramePixels,
  HandSignalDenoiser,
  SecondHandGestureDetector,
  clamp,
  type Point3D,
  type HandPoseLabel,
  type HandPoseClassification,
  type InteractionLogicMode,
  type MLGestureHint,
} from './gestureMath';

const HAND_CONNECTIONS: Array<[number, number]> = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [5, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [9, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [13, 17],
  [17, 18],
  [18, 19],
  [19, 20],
  [0, 17],
];

const USER_UPLOADED_VIDEO_PATH =
  '/assets/aistudio/Video_October_19__2026_-_12_13PM_ce41fc23';

export type SimulationMode = 'interactive' | 'auto-showcase';

export interface HandTrackerCallbacks {
  onBloomTargetChange: (
    bloomPct: number,
    classification: HandPoseClassification,
  ) => void;
  onHandOrientationChange: (
    targetYawYRad: number,
    targetPitchXRad: number,
    targetRollZRad: number,
    isActiveHand: boolean,
  ) => void;
  onSelectSpecies: (index: number) => void;
  onSelectEnvironment: (index: number) => void;
  onToggleAutoRotate: () => boolean;
  onToggleLowNoise: (enabled: boolean) => void;
  onRotateStep: (
    deltaYawRad: number,
    deltaPitchRad?: number,
    deltaRollRad?: number,
    resetAxes?: boolean,
  ) => void;
  onEnterXR?: () => void;
}

export class HandTrackerOverlay {
  private readonly callbacks: HandTrackerCallbacks;
  private rootEl!: HTMLElement;
  private videoEl!: HTMLVideoElement;
  private canvasEl!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;

  private speciesClassEl!: HTMLElement;
  private speciesIndexEl!: HTMLElement;
  private speciesNameZhEl!: HTMLElement;
  private speciesNameEnEl!: HTMLElement;
  private speciesMeaningEl!: HTMLElement;
  private speciesPoemEl!: HTMLElement;
  private bloomValueEl!: HTMLElement;
  private bloomBarFillEl!: HTMLElement;
  private bloomStateBadgeEl!: HTMLElement;
  private poseBadgeEl!: HTMLElement;
  private contextSituationEl!: HTMLElement;
  private rotationReadoutEl!: HTMLElement;
  private bloomSliderEl!: HTMLInputElement;
  private sensitivitySliderEl!: HTMLInputElement;
  private sensitivityValEl!: HTMLElement;
  private camToggleBtn!: HTMLButtonElement;
  private camInlineBtn!: HTMLButtonElement;
  private videoDemoInlineBtn!: HTMLButtonElement;
  private autoDemoBtn!: HTMLButtonElement;
  private simInlineBtn!: HTMLButtonElement;
  private pinchModeInlineBtn!: HTMLButtonElement;
  private autoRotateBtn!: HTMLButtonElement;
  private denoiseBtn!: HTMLButtonElement;
  private gestureToastEl!: HTMLElement;

  private speciesButtons: HTMLButtonElement[] = [];
  private envButtons: HTMLButtonElement[] = [];
  private logicModeButtons: HTMLButtonElement[] = [];

  private gestureRecognizer: GestureRecognizer | null = null;
  private handLandmarker: HandLandmarker | null = null;
  private primaryDenoiser = new HandSignalDenoiser(true, 55);
  private secondaryDenoiser = new HandSignalDenoiser(true, 55);
  private primaryHandDetector = new SecondHandGestureDetector(1250, 380);
  private secondHandDetector = new SecondHandGestureDetector(950, 380);

  private logicMode: InteractionLogicMode = 'smart-context';
  private strongDenoiseEnabled = true;
  private sensitivityPct = 55;

  private webcamRunning = false;
  private videoDemoRunning = false;
  private mlLoading = false;
  private lastVideoTime = -1;
  private lastHandDetectedTimeMs = -9999;
  private lastDetectedHands: Point3D[][] = [];
  private handCurrentlyPresent = false;

  // Default to 'interactive' so the app never randomly auto-switches flowers while the user is testing
  private simMode: SimulationMode = 'interactive';
  private simulatedPinchSpread = 0.78;
  private simulatedPinchGrabActive = false;
  private simulatedHandX = 0.5;
  private simulatedHandY = 0.5;
  private simulatedPitchX = 0.58;
  private simulatedYawY = 0;
  private simulatedRollZ = 0;
  private isDraggingCanvas = false;
  private dragLastX = 0;
  private dragLastY = 0;
  private secondHandSwipeFlash = 0;
  private secondHandSwipeProgress = 0;
  private secondHandSwipeDir: 'left' | 'right' = 'right';
  private lastAutoCycleSwitchSec = 0;

  private activeSpeciesIndex = 0;
  private activeEnvIndex = 0;
  private currentClassification: HandPoseClassification;
  private toastTimeout: number | null = null;
  private frameSamplerCanvas: HTMLCanvasElement;
  private frameSamplerCtx: CanvasRenderingContext2D;
  private customPoseLandmarks: Point3D[] | null = null;
  private lastInferenceLatencyMs = 0.4;

  constructor(callbacks: HandTrackerCallbacks) {
    this.callbacks = callbacks;
    this.frameSamplerCanvas = document.createElement('canvas');
    this.frameSamplerCanvas.width = 64;
    this.frameSamplerCanvas.height = 48;
    this.frameSamplerCtx = this.frameSamplerCanvas.getContext('2d', {
      willReadFrequently: true,
    })!;
    const initialLandmarks = this.buildSimulatedHandLandmarks(
      this.simulatedPinchSpread,
      0,
    );
    this.currentClassification = classifyHandPose(initialLandmarks);
    this.buildDOM();
    this.bindEvents();
    this.updateSimButtonsUI();
    const isHeadless =
      typeof navigator !== 'undefined' &&
      (navigator.webdriver || /HeadlessChrome/i.test(navigator.userAgent));
    if (!isHeadless) {
      void this.initMediaPipeModel();
      void this.tryAutoStartWebcam();
    }
  }

  private buildDOM(): void {
    const existing = document.getElementById('flora-hud-root');
    if (existing) existing.remove();

    this.rootEl = document.createElement('div');
    this.rootEl.id = 'flora-hud-root';
    this.rootEl.className = 'flora-hud-root';

    const firstSpec = FLOWER_LIBRARY[0];

    this.rootEl.innerHTML = `
      <!-- Top Editorial Bar -->
      <header class="flora-top-bar">
        <div class="flora-brand">
          <span class="flora-brand-mark">◆</span>
          <span class="flora-brand-title">FLORA</span>
          <span class="flora-brand-sub">多纲目植物图谱 · 智能多情境手势 3D 实验室</span>
        </div>

        <nav class="flora-env-bar" aria-label="Interactive Environments">
          ${ENVIRONMENT_LIBRARY.map(
            (env, idx) => `
            <button
              type="button"
              class="flora-env-btn ${idx === 0 ? 'active' : ''}"
              data-env-index="${idx}"
              title="${env.subtitleZh}"
            >
              <span class="flora-env-dot" style="background:${env.accentCss}"></span>
              <span>${env.nameZh}</span>
            </button>
          `,
          ).join('')}
        </nav>

        <div class="flora-top-actions">
          <button type="button" id="flora-denoise-btn" class="flora-action-btn active" title="切换 1€ 卡尔曼手势平滑滤波与 3D 画面降噪强度">
            <span>降噪滤波: 强</span>
          </button>
          <button type="button" id="flora-rotate-btn" class="flora-action-btn active" title="开启或关闭 3D 花朵 360° 自动旋转展示">
            <span>自动旋转: 开</span>
          </button>
          <button type="button" id="flora-auto-btn" class="flora-action-btn" title="在未开启摄像头时，开启或关闭自动手势演示">
            <span>模拟: 手动控制</span>
          </button>
          <button type="button" id="flora-cam-btn" class="flora-action-btn flora-action-btn-cam" title="开启或关闭真实摄像头手部追踪">
            <span id="flora-cam-btn-label">开启摄像头</span>
          </button>
          <button type="button" id="flora-xr-btn" class="flora-action-btn flora-action-btn-xr" title="进入沉浸式 WebXR 空间视图">
            <span>进入 XR 空间</span>
          </button>
        </div>
      </header>

      <!-- Left Botanical Editorial Specimen Info -->
      <aside class="flora-left-editorial">
        <div class="flora-class-badge" id="flora-species-class">${firstSpec.classZh}</div>
        <div class="flora-index-tag" id="flora-species-index">${firstSpec.indexLabel} · ${firstSpec.binomial.toUpperCase()}</div>
        <h1 class="flora-species-title-zh" id="flora-species-zh">${firstSpec.nameZh}</h1>
        <div class="flora-species-title-en" id="flora-species-en">${firstSpec.nameEn}</div>
        <div class="flora-species-meaning" id="flora-species-meaning">${firstSpec.meaningZh}</div>
        <p class="flora-species-poem" id="flora-species-poem">
          ${firstSpec.poemZh}
        </p>

        <div class="flora-telemetry-card">
          <div class="flora-telemetry-row">
            <span class="flora-telemetry-label">BLOOM APERTURE / 花冠绽放度</span>
            <span class="flora-telemetry-val" id="flora-bloom-val">78%</span>
          </div>
          <div class="flora-bloom-bar-track">
            <div class="flora-bloom-bar-fill" id="flora-bloom-bar-fill" style="width: 78%"></div>
          </div>
          <div class="flora-bloom-Stage-row">
            <span class="flora-stage-badge" id="flora-bloom-stage">半开雅韵 · Half-Bloom</span>
            <span class="flora-pose-badge" id="flora-pose-badge">指尖开合 · 78%</span>
          </div>
          <div class="flora-context-status-row" id="flora-context-situation">
            当前情境: 捏合拇指食指后移动可自由改变花朵 (X/Y/Z) 三轴角度并俯视花蕊
          </div>
          <div class="flora-rotation-row">
            <span class="flora-rotation-readout" id="flora-rotation-readout">3D 姿态角: X俯仰 33° · Y水平 0° · Z翻滚 0°</span>
            <div class="flora-rot-mini-group">
              <button type="button" class="flora-rot-chip" id="flora-rot-top" title="大倾角俯视花心与花蕊结构">俯视花蕊</button>
              <button type="button" class="flora-rot-chip" id="flora-rot-roll" title="绕 Z 轴侧倾翻滚赏花">Z轴侧倾</button>
              <button type="button" class="flora-rot-chip" id="flora-rot-reset" title="重置 X/Y/Z 三轴姿态角">视角归零</button>
            </div>
          </div>
        </div>

        <!-- Multi-Context Interaction Mode Selector -->
        <div class="flora-manual-slider-wrap">
          <div class="flora-mode-header-row">
            <span class="flora-slider-label">手势交互策略 (防误触多情境模式)</span>
          </div>
          <div class="flora-logic-mode-bar" role="radiogroup" aria-label="Gesture Interaction Logic Mode">
            <button type="button" class="flora-logic-btn active" data-logic-mode="smart-context" title="单手张合控开花、捏合移动旋转(X/Y/Z)轴；副手或单指悬停1秒换花">
              智能多情境
            </button>
            <button type="button" class="flora-logic-btn" data-logic-mode="bloom-orbit-only" title="锁定当前花朵品种与场景，手势100%仅用于控制花朵开合与(X/Y/Z)旋转">
              锁定品种·仅控花与轴
            </button>
            <button type="button" class="flora-logic-btn" data-logic-mode="dual-hand-split" title="右手专职控制开花与捏合旋转(X/Y/Z)，仅当左手(副手)入镜时才切换花朵">
              双手严格分工
            </button>
          </div>

          <div class="flora-calibration-row">
            <label for="flora-sensitivity-slider" class="flora-slider-label">
              灵敏度校准 (摄像头/光照适配)
            </label>
            <span class="flora-calibration-val" id="flora-sensitivity-val">标准均衡 (55%)</span>
          </div>
          <input
            id="flora-sensitivity-slider"
            type="range"
            min="10"
            max="100"
            step="1"
            value="55"
            aria-label="手势识别灵敏度校准滑块"
            class="flora-sensitivity-slider"
          />

          <div class="flora-calibration-row">
            <label for="flora-bloom-slider" class="flora-slider-label">
              花冠绽放度 (展露内层花蕊)
            </label>
          </div>
          <input
            id="flora-bloom-slider"
            type="range"
            min="0"
            max="100"
            value="78"
            aria-label="花朵绽放度手动滑块"
            class="flora-bloom-slider"
          />
          <div class="flora-pose-quick-btns">
            <button type="button" class="flora-mini-btn" data-quick-bloom="0">握拳含苞 0%</button>
            <button type="button" class="flora-mini-btn" data-quick-bloom="100">全开展蕊 100%</button>
            <button type="button" class="flora-mini-btn" id="flora-inspect-stamen-btn">微距看花蕊</button>
            <button type="button" class="flora-mini-btn flora-mini-btn-accent" id="flora-swipe-sim-btn">下一株花 →</button>
          </div>
        </div>
      </aside>

      <!-- Bottom Row: Bottom-Left Hand Skeleton Monitor + Bottom-Center 8-Class Species Dock -->
      <footer class="flora-bottom-row">
        <!-- Bottom-Left Camera & ML Hand Skeleton Monitor -->
        <div class="flora-cam-monitor" id="flora-cam-monitor">
          <div class="flora-cam-header">
            <span class="flora-cam-status-dot" id="flora-cam-dot"></span>
            <span class="flora-cam-title" id="flora-cam-status-text">ML 骨骼追踪 · 捏合移动可控 X/Y/Z 轴</span>
            <div class="flora-cam-inline-actions">
              <button type="button" id="flora-cam-inline-btn" class="flora-cam-chip flora-cam-chip-primary">
                摄像头
              </button>
              <button type="button" id="flora-video-inline-btn" class="flora-cam-chip" title="使用实拍手势视频进行实时 ML 骨骼识别测试">
                实测视频
              </button>
              <button type="button" id="flora-pinch-inline-btn" class="flora-cam-chip" title="模拟手指捏合状态，在下方画面拖动即可改变花朵 X/Y/Z 三轴角度">
                捏合转轴(X/Y/Z)
              </button>
              <button type="button" id="flora-sim-inline-btn" class="flora-cam-chip">
                手动模拟
              </button>
            </div>
          </div>
          <div class="flora-cam-viewport">
            <video id="flora-webcam-video" class="flora-webcam-video" autoplay playsinline muted loop crossorigin="anonymous"></video>
            <canvas id="flora-skeleton-canvas" class="flora-skeleton-canvas" width="360" height="200"></canvas>
            <div class="flora-gesture-toast" id="flora-gesture-toast">已就绪</div>
          </div>
        </div>

        <!-- Bottom-Center 8 Botanical Classes Switcher -->
        <div class="flora-species-dock" role="region" aria-label="Flower Species Selector">
          <div class="flora-species-cards">
            ${FLOWER_LIBRARY.map(
              (f, idx) => `
              <button
                type="button"
                class="flora-species-card ${idx === 0 ? 'active' : ''}"
                data-species-index="${idx}"
                title="${f.classZh} — ${f.nameZh}"
              >
                <span class="flora-species-swatch" style="background: linear-gradient(135deg, ${f.primaryColor}, ${f.secondaryColor})"></span>
                <div class="flora-species-card-meta">
                  <span class="flora-species-card-idx">${f.classZh.split(' · ').slice(-1)[0]}</span>
                  <span class="flora-species-card-zh">${f.nameZh}</span>
                  <span class="flora-species-card-en">${f.nameEn.split(' ').slice(-1)[0]}</span>
                </div>
              </button>
            `,
            ).join('')}
          </div>
          <div class="flora-dock-legend">
            <span>• 拇指+食指捏住移动：自由改变花朵 (X俯仰 / Y水平 / Z翻滚) 三轴角度并俯视花蕊</span>
            <span>• 五指张合(0–5指)：平滑控制花冠绽放度(满开100%完全展露立体花蕊)</span>
            <span>• 换花指令：副手挥动 / 单指悬停1秒确认</span>
          </div>
        </div>
      </footer>
    `;

    document.body.appendChild(this.rootEl);

    this.videoEl = document.getElementById(
      'flora-webcam-video',
    ) as HTMLVideoElement;
    this.canvasEl = document.getElementById(
      'flora-skeleton-canvas',
    ) as HTMLCanvasElement;
    this.ctx = this.canvasEl.getContext('2d')!;

    this.speciesClassEl = document.getElementById('flora-species-class')!;
    this.speciesIndexEl = document.getElementById('flora-species-index')!;
    this.speciesNameZhEl = document.getElementById('flora-species-zh')!;
    this.speciesNameEnEl = document.getElementById('flora-species-en')!;
    this.speciesMeaningEl = document.getElementById('flora-species-meaning')!;
    this.speciesPoemEl = document.getElementById('flora-species-poem')!;
    this.bloomValueEl = document.getElementById('flora-bloom-val')!;
    this.bloomBarFillEl = document.getElementById('flora-bloom-bar-fill')!;
    this.bloomStateBadgeEl = document.getElementById('flora-bloom-stage')!;
    this.poseBadgeEl = document.getElementById('flora-pose-badge')!;
    this.contextSituationEl = document.getElementById(
      'flora-context-situation',
    )!;
    this.rotationReadoutEl = document.getElementById('flora-rotation-readout')!;
    this.bloomSliderEl = document.getElementById(
      'flora-bloom-slider',
    ) as HTMLInputElement;
    this.sensitivitySliderEl = document.getElementById(
      'flora-sensitivity-slider',
    ) as HTMLInputElement;
    this.sensitivityValEl = document.getElementById('flora-sensitivity-val')!;
    this.camToggleBtn = document.getElementById(
      'flora-cam-btn',
    ) as HTMLButtonElement;
    this.camInlineBtn = document.getElementById(
      'flora-cam-inline-btn',
    ) as HTMLButtonElement;
    this.videoDemoInlineBtn = document.getElementById(
      'flora-video-inline-btn',
    ) as HTMLButtonElement;
    this.pinchModeInlineBtn = document.getElementById(
      'flora-pinch-inline-btn',
    ) as HTMLButtonElement;
    this.autoDemoBtn = document.getElementById(
      'flora-auto-btn',
    ) as HTMLButtonElement;
    this.simInlineBtn = document.getElementById(
      'flora-sim-inline-btn',
    ) as HTMLButtonElement;
    this.autoRotateBtn = document.getElementById(
      'flora-rotate-btn',
    ) as HTMLButtonElement;
    this.denoiseBtn = document.getElementById(
      'flora-denoise-btn',
    ) as HTMLButtonElement;
    this.gestureToastEl = document.getElementById('flora-gesture-toast')!;

    this.speciesButtons = Array.from(
      this.rootEl.querySelectorAll<HTMLButtonElement>('[data-species-index]'),
    );
    this.envButtons = Array.from(
      this.rootEl.querySelectorAll<HTMLButtonElement>('[data-env-index]'),
    );
    this.logicModeButtons = Array.from(
      this.rootEl.querySelectorAll<HTMLButtonElement>('[data-logic-mode]'),
    );
  }

  private bindEvents(): void {
    this.speciesButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.speciesIndex || 0);
        this.selectSpecies(idx, true);
      });
    });

    this.envButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.envIndex || 0);
        this.selectEnvironment(idx, true);
      });
    });

    this.logicModeButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = (btn.dataset.logicMode ||
          'smart-context') as InteractionLogicMode;
        this.setInteractionLogicMode(mode);
      });
    });

    this.denoiseBtn.addEventListener('click', () => {
      this.strongDenoiseEnabled = !this.strongDenoiseEnabled;
      this.primaryDenoiser.setStrongDenoise(this.strongDenoiseEnabled);
      this.secondaryDenoiser.setStrongDenoise(this.strongDenoiseEnabled);
      this.callbacks.onToggleLowNoise(this.strongDenoiseEnabled);
      this.denoiseBtn.textContent = this.strongDenoiseEnabled
        ? '降噪滤波: 强'
        : '降噪滤波: 标准';
      this.denoiseBtn.classList.toggle('active', this.strongDenoiseEnabled);
      this.showGestureToast(
        this.strongDenoiseEnabled
          ? '已开启强力降噪：1€ 骨骼防抖滤波 + 纯净低噪点 3D 渲染'
          : '已切换至标准滤波模式',
      );
    });

    this.bloomSliderEl.addEventListener('input', () => {
      this.simMode = 'interactive';
      this.updateSimButtonsUI();
      const val = Number(this.bloomSliderEl.value);
      this.setSimulatedBloom(val);
    });

    this.sensitivitySliderEl.addEventListener('input', () => {
      const val = Number(this.sensitivitySliderEl.value);
      this.setSensitivity(val, true);
    });

    this.rootEl
      .querySelectorAll<HTMLButtonElement>('[data-quick-bloom]')
      .forEach((btn) => {
        btn.addEventListener('click', () => {
          this.simMode = 'interactive';
          this.updateSimButtonsUI();
          const target = Number(btn.dataset.quickBloom || 0);
          this.setSimulatedBloom(target);
        });
      });

    document
      .getElementById('flora-inspect-stamen-btn')
      ?.addEventListener('click', () => {
        this.simMode = 'interactive';
        this.updateSimButtonsUI();
        this.setSimulatedBloom(100);
        this.simulatedPitchX = 1.22;
        this.callbacks.onRotateStep(0, 1.22, 0, false);
        this.showGestureToast('已全开展露花蕊 · X轴大倾角俯视花心结构');
      });

    const swipeSimBtn = document.getElementById('flora-swipe-sim-btn');
    swipeSimBtn?.addEventListener('click', () => {
      this.triggerSimulatedSecondHandSwipe('right', '手动指令');
    });

    this.autoRotateBtn.addEventListener('click', () => {
      const enabled = this.callbacks.onToggleAutoRotate();
      this.autoRotateBtn.textContent = enabled
        ? '自动旋转: 开'
        : '自动旋转: 关';
      this.autoRotateBtn.classList.toggle('active', enabled);
    });

    document.getElementById('flora-rot-top')?.addEventListener('click', () => {
      this.setSimulatedBloom(Math.max(88, this.getCurrentBloomPercentage()));
      this.callbacks.onRotateStep(0, 0.35, 0, false);
      this.showGestureToast('已切换花蕊俯视倾角 (X轴)');
    });
    document.getElementById('flora-rot-roll')?.addEventListener('click', () => {
      this.callbacks.onRotateStep(0, 0, 0.42, false);
      this.showGestureToast('已调整花朵 Z 轴侧倾翻滚角');
    });
    document
      .getElementById('flora-rot-reset')
      ?.addEventListener('click', () => {
        this.simulatedPitchX = 0.58;
        this.simulatedYawY = 0;
        this.simulatedRollZ = 0;
        this.callbacks.onRotateStep(0, 0, 0, true);
        this.showGestureToast('已重置花朵 X / Y / Z 三轴姿态角');
      });

    this.pinchModeInlineBtn?.addEventListener('click', () => {
      this.simulatedPinchGrabActive = !this.simulatedPinchGrabActive;
      this.pinchModeInlineBtn.classList.toggle(
        'active',
        this.simulatedPinchGrabActive,
      );
      if (this.simulatedPinchGrabActive) {
        this.simMode = 'interactive';
        this.setSimulatedBloom(Math.max(88, this.getCurrentBloomPercentage()));
        this.contextSituationEl.textContent =
          '当前情境: 模拟手指捏合抓取中 · 在左下角画面移动即可旋转花朵 (X/Y/Z) 三轴角度';
        this.showGestureToast(
          '已开启「捏合转轴(X/Y/Z)」模拟 · 在左下角画面拖动手指改变 X/Y/Z 三轴角度',
        );
      } else {
        this.contextSituationEl.textContent =
          '当前情境: 单手专注控花 · 拇指食指捏住移动可改变花朵 (X/Y/Z) 角度';
        this.showGestureToast('已退出模拟捏合锁，恢复指尖开合控花');
      }
      this.updateSimButtonsUI();
    });

    const cycleSimMode = () => {
      if (this.webcamRunning || this.videoDemoRunning) {
        this.showGestureToast(
          '当前正在使用实时视频/摄像头追踪，自动模拟已自动避让',
        );
        return;
      }
      if (this.simMode === 'auto-showcase') {
        this.simMode = 'interactive';
        this.showGestureToast(
          '已切换至「手动骨骼模拟」· 在左下角画面上下拖动控花或开启捏合转轴',
        );
      } else {
        this.simMode = 'auto-showcase';
        this.lastAutoCycleSwitchSec = performance.now() / 1000;
        this.showGestureToast('已开启「自动演练模式」');
      }
      this.updateSimButtonsUI();
    };

    this.autoDemoBtn.addEventListener('click', cycleSimMode);
    this.simInlineBtn.addEventListener('click', cycleSimMode);

    this.camToggleBtn.addEventListener('click', () => {
      void this.toggleWebcam();
    });
    this.camInlineBtn.addEventListener('click', () => {
      void this.toggleWebcam();
    });
    this.videoDemoInlineBtn.addEventListener('click', () => {
      void this.toggleUploadedVideoDemo();
    });

    const xrBtn = document.getElementById('flora-xr-btn');
    xrBtn?.addEventListener('click', () => {
      this.callbacks.onEnterXR?.();
    });

    this.canvasEl.addEventListener('pointerdown', (e) => {
      if (this.webcamRunning || this.videoDemoRunning) return;
      this.isDraggingCanvas = true;
      this.dragLastX = e.clientX;
      this.dragLastY = e.clientY;
      this.simMode = 'interactive';
      this.updateSimButtonsUI();
      if (!this.simulatedPinchGrabActive && !e.shiftKey) {
        this.updateSpreadFromCanvasPointer(e);
      }
      this.canvasEl.setPointerCapture(e.pointerId);
    });

    this.canvasEl.addEventListener('pointermove', (e) => {
      if (!this.isDraggingCanvas || this.webcamRunning || this.videoDemoRunning)
        return;
      const dx = e.clientX - this.dragLastX;
      const dy = e.clientY - this.dragLastY;

      if (this.simulatedPinchGrabActive || e.shiftKey) {
        this.dragLastX = e.clientX;
        this.dragLastY = e.clientY;
        const rect = this.canvasEl.getBoundingClientRect();
        const normDx = dx / Math.max(120, rect.width);
        const normDy = dy / Math.max(100, rect.height);
        this.simulatePinchDragDelta(normDx, normDy, normDx * 0.45);
        return;
      }

      if (Math.abs(dx) > 64 && this.logicMode !== 'bloom-orbit-only') {
        this.dragLastX = e.clientX;
        this.dragLastY = e.clientY;
        this.triggerSimulatedSecondHandSwipe(
          dx > 0 ? 'right' : 'left',
          '模拟挥手',
        );
      } else {
        this.updateSpreadFromCanvasPointer(e);
      }
    });

    this.canvasEl.addEventListener('pointerup', () => {
      this.isDraggingCanvas = false;
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') {
        this.triggerSimulatedSecondHandSwipe('right', '快捷键');
      } else if (e.key === 'ArrowLeft') {
        this.triggerSimulatedSecondHandSwipe('left', '快捷键');
      } else if (e.key === 'ArrowUp') {
        this.simMode = 'interactive';
        this.updateSimButtonsUI();
        this.setSimulatedBloom(
          clamp(Math.round(this.simulatedPinchSpread * 100) + 12, 0, 100),
        );
      } else if (e.key === 'ArrowDown') {
        this.simMode = 'interactive';
        this.updateSimButtonsUI();
        this.setSimulatedBloom(
          clamp(Math.round(this.simulatedPinchSpread * 100) - 12, 0, 100),
        );
      } else if (e.key === 'e' || e.key === 'E') {
        this.selectEnvironment(
          (this.activeEnvIndex + 1) % ENVIRONMENT_LIBRARY.length,
          true,
        );
      }
    });
  }

  /**
   * Simulates pinching thumb & index finger together and moving by normalized (dx, dy, dz)
   * to rotate the flower around its (X, Y, Z) axes while keeping the corolla open to show stamens.
   */
  simulatePinchDragDelta(dx: number, dy: number, dz = 0): void {
    this.simMode = 'interactive';
    this.simulatedPinchGrabActive = true;
    this.pinchModeInlineBtn?.classList.add('active');
    this.simulatedHandX = clamp(this.simulatedHandX + dx, 0.1, 0.9);
    this.simulatedHandY = clamp(this.simulatedHandY + dy, 0.1, 0.9);

    const cal = this.primaryDenoiser.getCalibrationParams();
    const gain = 0.8 + (cal.sensitivityPct / 100) * 0.7;

    this.simulatedPitchX = clamp(
      this.simulatedPitchX + dy * 4.0 * gain,
      -1.48,
      1.56,
    );
    this.simulatedYawY += dx * 4.5 * gain;
    this.simulatedRollZ = clamp(
      this.simulatedRollZ + (dz * 3.2 + dx * dy * 2.5) * gain,
      -1.35,
      1.35,
    );

    const openBloom = Math.max(88, Math.round(this.simulatedPinchSpread * 100));
    this.simulatedPinchSpread = openBloom / 100;
    this.bloomSliderEl.value = String(openBloom);

    const landmarks = this.buildSimulatedHandLandmarks(
      this.simulatedPinchSpread,
      performance.now() / 1000,
      true,
    );
    this.currentClassification = {
      ...classifyHandPose(landmarks),
      pose: 'pinch-grab',
      isPinchGrabbing: true,
      labelZh: '捏合抓取 · 移动旋转(X/Y/Z轴)',
      labelEn: 'Pinch-Grab 3D Rotate (X/Y/Z)',
      bloomPercentage: openBloom,
      orientation: {
        palmCenterX: this.simulatedHandX,
        palmCenterY: this.simulatedHandY,
        palmCenterZ: dz,
        wristRollRad: this.simulatedRollZ,
        targetPitchXRad: this.simulatedPitchX,
        targetYawYRad: this.simulatedYawY,
        targetRollZRad: this.simulatedRollZ,
        targetYawRad: this.simulatedYawY,
        targetPitchRad: this.simulatedPitchX,
      },
    };

    const pDeg = Math.round((this.simulatedPitchX * 180) / Math.PI);
    const yDeg = Math.round(((this.simulatedYawY * 180) / Math.PI) % 360);
    const rDeg = Math.round((this.simulatedRollZ * 180) / Math.PI);
    this.contextSituationEl.textContent = `当前情境: 捏合抓取旋转中 · 花朵角度 (X:${pDeg}° / Y:${yDeg}° / Z:${rDeg}°)`;
    this.updateBloomReadoutUI(openBloom, this.currentClassification);
    this.callbacks.onBloomTargetChange(openBloom, this.currentClassification);
    this.callbacks.onHandOrientationChange(
      this.simulatedYawY,
      this.simulatedPitchX,
      this.simulatedRollZ,
      true,
    );
  }

  setInteractionLogicMode(mode: InteractionLogicMode): void {
    this.logicMode = mode;
    this.primaryHandDetector.reset();
    this.secondHandDetector.reset();
    this.logicModeButtons.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.logicMode === mode);
    });

    if (mode === 'smart-context') {
      this.contextSituationEl.textContent =
        '当前策略: 智能多情境 (张合控开花，捏合移动转 X/Y/Z 轴；副手或单指悬停1s换花)';
      this.showGestureToast(
        '智能多情境模式：捏合手指移动可转 X/Y/Z 轴，张合手指控开花',
      );
    } else if (mode === 'bloom-orbit-only') {
      this.contextSituationEl.textContent =
        '当前策略: 锁定花朵品种 (手势 100% 专注控制开花与捏合旋转 X/Y/Z 轴，禁用换花)';
      this.showGestureToast('已锁定当前花朵品种：自由张合赏蕊或捏合旋转 X/Y/Z 轴');
    } else {
      this.contextSituationEl.textContent =
        '当前策略: 双手严格分工 (主手控开花与捏合转 X/Y/Z 轴；仅当副手入镜时触发换花)';
      this.showGestureToast(
        '双手分工模式：主手控开花与X/Y/Z旋转，副手挥动切换花朵',
      );
    }
  }

  getInteractionLogicMode(): InteractionLogicMode {
    return this.logicMode;
  }

  setSensitivity(pct: number, showFeedback = false): void {
    const clamped = clamp(Math.round(pct), 10, 100);
    this.sensitivityPct = clamped;
    this.primaryDenoiser.setSensitivity(clamped);
    this.secondaryDenoiser.setSensitivity(clamped);
    if (this.sensitivitySliderEl) {
      this.sensitivitySliderEl.value = String(clamped);
    }
    const cal = this.primaryDenoiser.getCalibrationParams();
    if (this.sensitivityValEl) {
      this.sensitivityValEl.textContent = cal.profileLabelZh;
    }

    if (this.gestureRecognizer) {
      try {
        void this.gestureRecognizer.setOptions({
          minHandDetectionConfidence: cal.minHandConfidence,
          minHandPresenceConfidence: cal.minHandConfidence,
          minTrackingConfidence: cal.minHandConfidence,
        });
      } catch {
        // Ignore if recognizer is busy mid-frame
      }
    }
    if (this.handLandmarker) {
      try {
        void this.handLandmarker.setOptions({
          minHandDetectionConfidence: cal.minHandConfidence,
          minHandPresenceConfidence: cal.minHandConfidence,
          minTrackingConfidence: cal.minHandConfidence,
        });
      } catch {
        // Ignore if landmarker is busy mid-frame
      }
    }

    if (showFeedback) {
      this.showGestureToast(
        `灵敏度校准: ${cal.profileLabelZh} · 置信阈值 ${cal.minHandConfidence} / 悬停 ${cal.dwellDurationMs}ms`,
      );
    }
  }

  getSensitivity(): number {
    return this.sensitivityPct;
  }

  private updateSpreadFromCanvasPointer(e: PointerEvent): void {
    const rect = this.canvasEl.getBoundingClientRect();
    const relX = clamp((e.clientX - rect.left) / rect.width, 0.05, 0.95);
    const relY = clamp((e.clientY - rect.top) / rect.height, 0.08, 0.92);
    this.simulatedHandX = relX;
    this.simulatedHandY = relY;

    const pct = Math.round((1 - (relY - 0.08) / 0.84) * 100);
    this.setSimulatedBloom(clamp(pct, 0, 100));

    const targetYawY = (relX - 0.5) * 2.6;
    const targetPitchX = 0.58 + (relY - 0.45) * 1.65;
    const targetRollZ = (relX - 0.5) * (relY - 0.5) * 1.4;
    this.simulatedPitchX = targetPitchX;
    this.simulatedYawY = targetYawY;
    this.simulatedRollZ = targetRollZ;
    this.callbacks.onHandOrientationChange(
      targetYawY,
      targetPitchX,
      targetRollZ,
      true,
    );
  }

  setInteractiveMode(): void {
    this.simMode = 'interactive';
    this.updateSimButtonsUI();
  }

  setSimulatedBloom(percentage: number): void {
    this.customPoseLandmarks = null;
    const clampedPct = clamp(percentage, 0, 100);
    this.simulatedPinchSpread = clampedPct / 100;
    this.bloomSliderEl.value = String(clampedPct);
    const landmarks = this.buildSimulatedHandLandmarks(
      this.simulatedPinchSpread,
      performance.now() / 1000,
      this.simulatedPinchGrabActive,
    );
    this.currentClassification = classifyHandPose(landmarks);
    this.currentClassification.bloomPercentage = clampedPct;
    this.updateBloomReadoutUI(clampedPct, this.currentClassification);
    this.callbacks.onBloomTargetChange(clampedPct, this.currentClassification);
  }

  /**
   * Triggers a specific ML hand pose archetype (e.g. 'closed-fist', 'pinch-caliper', 'open-palm',
   * 'pinch-grab', 'pointing', 'victory') through the full 21-point neural classification pipeline.
   */
  triggerPresetPose(pose: HandPoseLabel, aperture01 = 0.5): HandPoseClassification {
    this.simMode = 'interactive';
    this.simulatedPinchGrabActive = pose === 'pinch-grab';
    this.pinchModeInlineBtn?.classList.toggle('active', this.simulatedPinchGrabActive);
    this.updateSimButtonsUI();

    const pts = buildPresetPoseLandmarks(
      pose,
      this.simulatedHandX,
      this.simulatedHandY,
      aperture01,
    );
    this.customPoseLandmarks = pts;
    const classification = classifyHandPose(pts);
    this.currentClassification = classification;
    this.simulatedPinchSpread = classification.bloomPercentage / 100;
    this.bloomSliderEl.value = String(classification.bloomPercentage);
    this.updateBloomReadoutUI(classification.bloomPercentage, classification);
    this.callbacks.onBloomTargetChange(
      classification.bloomPercentage,
      classification,
    );

    if (pose === 'pointing' && this.logicMode !== 'bloom-orbit-only') {
      this.triggerSimulatedSecondHandSwipe('right', 'ML单指手势');
    } else if (pose === 'victory' && this.logicMode !== 'bloom-orbit-only') {
      this.selectEnvironment(
        (this.activeEnvIndex + 1) % ENVIRONMENT_LIBRARY.length,
        true,
      );
    }
    return classification;
  }

  triggerSimulatedSecondHandSwipe(
    direction: 'left' | 'right',
    reasonLabel = '手势指令',
  ): void {
    this.secondHandSwipeFlash = 1.0;
    this.secondHandSwipeProgress = 0;
    this.secondHandSwipeDir = direction;
    const nextIdx =
      direction === 'right'
        ? (this.activeSpeciesIndex + 1) % FLOWER_LIBRARY.length
        : (this.activeSpeciesIndex - 1 + FLOWER_LIBRARY.length) %
          FLOWER_LIBRARY.length;
    this.selectSpecies(nextIdx, true);
    const nextSpec = FLOWER_LIBRARY[nextIdx];
    this.showGestureToast(
      `${reasonLabel} · 切换至「${nextSpec.nameZh}」(${nextSpec.classZh.split(' · ').slice(-1)[0]})`,
    );
  }

  selectSpecies(index: number, notifyCallback = false): void {
    this.activeSpeciesIndex =
      ((index % FLOWER_LIBRARY.length) + FLOWER_LIBRARY.length) %
      FLOWER_LIBRARY.length;
    const spec = FLOWER_LIBRARY[this.activeSpeciesIndex];

    this.speciesClassEl.textContent = spec.classZh;
    this.speciesIndexEl.textContent = `${spec.indexLabel} · ${spec.binomial.toUpperCase()}`;
    this.speciesNameZhEl.textContent = spec.nameZh;
    this.speciesNameEnEl.textContent = spec.nameEn;
    this.speciesMeaningEl.textContent = spec.meaningZh;
    this.speciesPoemEl.textContent = spec.poemZh;

    this.speciesButtons.forEach((btn, idx) => {
      btn.classList.toggle('active', idx === this.activeSpeciesIndex);
    });

    if (notifyCallback) {
      this.callbacks.onSelectSpecies(this.activeSpeciesIndex);
    }
  }

  selectEnvironment(index: number, notifyCallback = false): void {
    this.activeEnvIndex =
      ((index % ENVIRONMENT_LIBRARY.length) + ENVIRONMENT_LIBRARY.length) %
      ENVIRONMENT_LIBRARY.length;
    const env = ENVIRONMENT_LIBRARY[this.activeEnvIndex];

    this.envButtons.forEach((btn, idx) => {
      btn.classList.toggle('active', idx === this.activeEnvIndex);
    });

    this.showGestureToast(`场景切换 · ${env.nameZh} (${env.nameEn})`);

    if (notifyCallback) {
      this.callbacks.onSelectEnvironment(this.activeEnvIndex);
    }
  }

  updateActiveSpeciesUI(index: number): void {
    this.selectSpecies(index, false);
  }

  updateActiveEnvironmentUI(index: number): void {
    this.selectEnvironment(index, false);
  }

  updateRotationReadout(
    pitchXRad: number,
    yawYRad: number,
    rollZRad = 0,
  ): void {
    if (!this.rotationReadoutEl) return;
    const pitchDeg = Math.round((pitchXRad * 180) / Math.PI);
    const yawDeg = Math.round(((yawYRad * 180) / Math.PI) % 360);
    const rollDeg = Math.round((rollZRad * 180) / Math.PI);
    this.rotationReadoutEl.textContent = `3D 姿态角: X俯仰 ${pitchDeg}° · Y水平 ${yawDeg}° · Z翻滚 ${rollDeg}°`;
  }

  private updateSimButtonsUI(): void {
    const isAuto =
      this.simMode === 'auto-showcase' &&
      !this.webcamRunning &&
      !this.videoDemoRunning;
    this.autoDemoBtn.textContent = isAuto
      ? '模拟: 自动演练'
      : '模拟: 手动控制';
    this.autoDemoBtn.classList.toggle('active', isAuto);

    if (this.simInlineBtn) {
      this.simInlineBtn.textContent = isAuto ? '自动演练' : '手动模拟';
      this.simInlineBtn.classList.toggle(
        'active',
        !this.webcamRunning &&
          !this.videoDemoRunning &&
          !this.simulatedPinchGrabActive,
      );
    }
  }

  private showGestureToast(message: string): void {
    this.gestureToastEl.textContent = message;
    this.gestureToastEl.classList.add('visible');
    if (this.toastTimeout !== null) {
      window.clearTimeout(this.toastTimeout);
    }
    this.toastTimeout = window.setTimeout(() => {
      this.gestureToastEl.classList.remove('visible');
    }, 2200);
  }

  private updateBloomReadoutUI(
    pct: number,
    classification: HandPoseClassification,
  ): void {
    const rounded = Math.round(pct);
    this.bloomValueEl.textContent = `${rounded}%`;
    this.bloomBarFillEl.style.width = `${rounded}%`;

    let stageLabel = '半开雅韵 · Half-Bloom';
    if (rounded <= 8) {
      stageLabel = '含苞待放 · Closed Bud';
    } else if (rounded < 40) {
      stageLabel = '初绽微启 · Early Bud';
    } else if (rounded >= 85) {
      stageLabel = '倾城满开 · 展露花蕊';
    }
    this.bloomStateBadgeEl.textContent = stageLabel;
    this.poseBadgeEl.textContent =
      classification.dwellActionLabelZh || classification.labelZh;
  }

  private async initMediaPipeModel(): Promise<void> {
    if (this.mlLoading || this.gestureRecognizer || this.handLandmarker) return;
    this.mlLoading = true;
    try {
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm',
      );
      // 1. Primary ML Model: MediaPipe GestureRecognizer (Neural Gesture Classifier + 21-Point 3D Hand Landmarks)
      try {
        this.gestureRecognizer = await GestureRecognizer.createFromOptions(
          vision,
          {
            baseOptions: {
              modelAssetPath:
                'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task',
              delegate: 'GPU',
            },
            runningMode: 'VIDEO',
            numHands: 2,
            minHandDetectionConfidence: 0.48,
            minHandPresenceConfidence: 0.48,
            minTrackingConfidence: 0.48,
          },
        );
        return;
      } catch {
        try {
          this.gestureRecognizer = await GestureRecognizer.createFromOptions(
            vision,
            {
              baseOptions: {
                modelAssetPath:
                  'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task',
                delegate: 'CPU',
              },
              runningMode: 'VIDEO',
              numHands: 2,
              minHandDetectionConfidence: 0.48,
              minHandPresenceConfidence: 0.48,
              minTrackingConfidence: 0.48,
            },
          );
          return;
        } catch {
          // Fall through to HandLandmarker
        }
      }

      // 2. Fallback ML Model: MediaPipe HandLandmarker (21-Point 3D Skeletal Regression)
      try {
        this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numHands: 2,
          minHandDetectionConfidence: 0.48,
          minHandPresenceConfidence: 0.48,
          minTrackingConfidence: 0.48,
        });
      } catch {
        this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
            delegate: 'CPU',
          },
          runningMode: 'VIDEO',
          numHands: 2,
          minHandDetectionConfidence: 0.48,
          minHandPresenceConfidence: 0.48,
          minTrackingConfidence: 0.48,
        });
      }
    } catch (err) {
      console.warn(
        'MediaPipe ML model fallback to interactive simulation:',
        err,
      );
    } finally {
      this.mlLoading = false;
    }
  }

  private async tryAutoStartWebcam(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {width: {ideal: 640}, height: {ideal: 480}, facingMode: 'user'},
        audio: false,
      });
      this.attachWebcamStream(stream);
    } catch {
      // Normal if browser awaits explicit click or no physical webcam is attached
    }
  }

  private attachWebcamStream(stream: MediaStream): void {
    const statusTextEl = document.getElementById('flora-cam-status-text');
    const dotEl = document.getElementById('flora-cam-dot');
    const labelEl = document.getElementById('flora-cam-btn-label');

    this.videoDemoRunning = false;
    this.simulatedPinchGrabActive = false;
    this.pinchModeInlineBtn?.classList.remove('active');
    this.simMode = 'interactive';
    this.primaryDenoiser.reset();
    this.secondaryDenoiser.reset();
    this.primaryHandDetector.reset();
    this.secondHandDetector.reset();

    this.videoDemoInlineBtn?.classList.remove('active');
    this.videoEl.removeAttribute('src');
    this.videoEl.srcObject = stream;
    void this.videoEl.play();
    this.webcamRunning = true;
    this.videoEl.classList.add('active');
    if (labelEl) labelEl.textContent = '摄像头: 已开启';
    this.camToggleBtn.classList.add('active');
    if (this.camInlineBtn) {
      this.camInlineBtn.textContent = '摄像头: 开';
      this.camInlineBtn.classList.add('active');
    }
    if (statusTextEl) {
      statusTextEl.textContent = 'LIVE 摄像头 · 捏合手指移动可控 X/Y/Z 轴';
    }
    dotEl?.classList.add('live');
    this.updateSimButtonsUI();
    this.showGestureToast(
      '摄像头已开启 · 张合控花，拇指食指捏住移动可旋转花朵 (X/Y/Z) 轴',
    );
    void this.initMediaPipeModel();
  }

  async toggleUploadedVideoDemo(): Promise<void> {
    const statusTextEl = document.getElementById('flora-cam-status-text');
    const dotEl = document.getElementById('flora-cam-dot');
    const labelEl = document.getElementById('flora-cam-btn-label');

    if (this.videoDemoRunning) {
      this.videoDemoRunning = false;
      this.videoEl.pause();
      this.videoEl.removeAttribute('src');
      this.videoEl.classList.remove('active');
      this.videoDemoInlineBtn?.classList.remove('active');
      dotEl?.classList.remove('live');
      if (statusTextEl) {
        statusTextEl.textContent = 'ML 骨骼模拟运行中';
      }
      this.updateSimButtonsUI();
      return;
    }

    if (this.webcamRunning) {
      const stream = this.videoEl.srcObject as MediaStream | null;
      stream?.getTracks().forEach((t) => t.stop());
      this.videoEl.srcObject = null;
      this.webcamRunning = false;
      this.camToggleBtn.classList.remove('active');
      this.camInlineBtn?.classList.remove('active');
      if (labelEl) labelEl.textContent = '开启摄像头';
    }

    this.simMode = 'interactive';
    this.simulatedPinchGrabActive = false;
    this.pinchModeInlineBtn?.classList.remove('active');
    this.primaryDenoiser.reset();
    this.secondaryDenoiser.reset();
    this.primaryHandDetector.reset();
    this.secondHandDetector.reset();

    await this.initMediaPipeModel();
    this.videoEl.src = USER_UPLOADED_VIDEO_PATH;
    this.videoEl.loop = true;
    this.videoEl.muted = true;
    try {
      await this.videoEl.play();
      this.videoDemoRunning = true;
      this.videoEl.classList.add('active');
      this.videoDemoInlineBtn?.classList.add('active');
      dotEl?.classList.add('live');
      this.updateSimButtonsUI();
      if (statusTextEl) {
        statusTextEl.textContent = 'LIVE 实测视频 · 捏合转轴与多情境识别中';
      }
      this.showGestureToast('正在实时分析实拍手势视频（支持捏合 X/Y/Z 旋转）');
    } catch (err) {
      console.warn('Video demo playback error:', err);
    }
  }

  async toggleWebcam(): Promise<void> {
    const statusTextEl = document.getElementById('flora-cam-status-text');
    const dotEl = document.getElementById('flora-cam-dot');
    const labelEl = document.getElementById('flora-cam-btn-label');

    if (this.webcamRunning) {
      this.webcamRunning = false;
      const stream = this.videoEl.srcObject as MediaStream | null;
      stream?.getTracks().forEach((t) => t.stop());
      this.videoEl.srcObject = null;
      this.videoEl.classList.remove('active');
      this.camToggleBtn.classList.remove('active');
      if (labelEl) labelEl.textContent = '开启摄像头';
      if (this.camInlineBtn) {
        this.camInlineBtn.textContent = '摄像头';
        this.camInlineBtn.classList.remove('active');
      }
      if (statusTextEl) {
        statusTextEl.textContent = 'ML 骨骼模拟运行中';
      }
      dotEl?.classList.remove('live');
      this.updateSimButtonsUI();
      this.showGestureToast('已切换为手动骨骼模拟模式');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {width: {ideal: 640}, height: {ideal: 480}, facingMode: 'user'},
        audio: false,
      });
      this.attachWebcamStream(stream);
    } catch (err) {
      console.warn(
        'Camera access unavailable, falling back to uploaded video demo:',
        err,
      );
      await this.toggleUploadedVideoDemo();
    }
  }

  update(elapsedSec: number, dt: number): void {
    if (this.secondHandSwipeFlash > 0) {
      this.secondHandSwipeFlash = Math.max(
        0,
        this.secondHandSwipeFlash - dt * 1.45,
      );
      this.secondHandSwipeProgress = clamp(
        this.secondHandSwipeProgress + dt * 2.2,
        0,
        1,
      );
    }

    // 1. Live Video / Webcam ML Hand Tracking Mode:
    if (this.webcamRunning || this.videoDemoRunning) {
      const nowMs = performance.now();
      if (this.videoEl.readyState >= 2) {
        if (this.videoEl.currentTime !== this.lastVideoTime) {
          this.lastVideoTime = this.videoEl.currentTime;
          const tInferStart = performance.now();
          let landmarks: Point3D[][] = [];
          const mlHints: Array<MLGestureHint | null> = [];

          if (this.gestureRecognizer) {
            const gResult = this.gestureRecognizer.recognizeForVideo(
              this.videoEl,
              nowMs,
            );
            landmarks = gResult.landmarks || [];
            for (let i = 0; i < landmarks.length; i++) {
              const topGesture = gResult.gestures?.[i]?.[0];
              const topHand = gResult.handednesses?.[i]?.[0];
              mlHints.push(
                topGesture
                  ? {
                      categoryName: topGesture.categoryName,
                      score: topGesture.score,
                      handedness:
                        topHand?.categoryName === 'Left' ? 'Left' : 'Right',
                    }
                  : null,
              );
            }
          } else if (this.handLandmarker) {
            const hResult = this.handLandmarker.detectForVideo(
              this.videoEl,
              nowMs,
            );
            landmarks = hResult.landmarks || [];
          }

          // Zero-latency CV frame tensor fallback when WASM model is still loading or video frame is stylized
          if (landmarks.length === 0) {
            try {
              this.frameSamplerCtx.drawImage(this.videoEl, 0, 0, 64, 48);
              const imgData = this.frameSamplerCtx.getImageData(0, 0, 64, 48);
              const cvStats = analyzeVideoFramePixels(imgData.data, 64, 48);
              if (cvStats.activeRatio > 0.02) {
                this.simulatedHandX = cvStats.centroidX;
                this.simulatedHandY = cvStats.centroidY;
                landmarks = [
                  this.buildSimulatedHandLandmarks(
                    cvStats.spreadAperture01,
                    elapsedSec,
                    false,
                  ),
                ];
              }
            } catch {
              // Ignore cross-origin canvas read if any
            }
          }

          this.lastInferenceLatencyMs = Number(
            Math.max(0.2, performance.now() - tInferStart).toFixed(1),
          );

          if (landmarks.length > 0) {
            this.lastHandDetectedTimeMs = nowMs;
            this.handCurrentlyPresent = true;
            this.processLiveHandResult(landmarks, nowMs, dt, mlHints);
            return;
          }
        } else if (
          this.handCurrentlyPresent &&
          nowMs - this.lastHandDetectedTimeMs < 420
        ) {
          this.drawHandHUD(
            this.lastDetectedHands,
            this.currentClassification,
            false,
          );
          return;
        }
      }

      if (nowMs - this.lastHandDetectedTimeMs >= 420) {
        if (this.handCurrentlyPresent) {
          this.handCurrentlyPresent = false;
          this.primaryDenoiser.reset();
          this.secondaryDenoiser.reset();
          this.primaryHandDetector.reset();
          this.secondHandDetector.reset();
          this.contextSituationEl.textContent = `当前情境: 手部离场保持 (已锁定花朵绽放度 ${Math.round(this.currentClassification.bloomPercentage)}% 与 3D 姿态角)`;
        }
        this.ctx.clearRect(0, 0, this.canvasEl.width, this.canvasEl.height);
      } else {
        this.drawHandHUD(
          this.lastDetectedHands,
          this.currentClassification,
          false,
        );
      }
      return;
    }

    // 2. Offline Simulation Mode
    if (this.simMode === 'auto-showcase') {
      this.customPoseLandmarks = null;
      const wave = 0.5 + 0.5 * Math.sin(elapsedSec * 1.15 - 0.4);
      this.simulatedPinchSpread = wave;
      this.simulatedHandX = 0.5 + Math.sin(elapsedSec * 0.55) * 0.18;
      this.simulatedHandY = 0.5 + Math.cos(elapsedSec * 0.45) * 0.12;

      const pct = Math.round(wave * 100);
      this.bloomSliderEl.value = String(pct);
      const landmarks = this.buildSimulatedHandLandmarks(wave, elapsedSec);
      this.currentClassification = classifyHandPose(landmarks);
      this.currentClassification.bloomPercentage = pct;
      this.updateBloomReadoutUI(pct, this.currentClassification);
      this.callbacks.onBloomTargetChange(pct, this.currentClassification);

      if (
        this.logicMode !== 'bloom-orbit-only' &&
        elapsedSec - this.lastAutoCycleSwitchSec > 8.5
      ) {
        this.lastAutoCycleSwitchSec = elapsedSec;
        this.triggerSimulatedSecondHandSwipe('right', '自动演练');
      }
    }

    const simLandmarks =
      this.customPoseLandmarks ??
      this.buildSimulatedHandLandmarks(
        this.simulatedPinchSpread,
        elapsedSec,
        this.simulatedPinchGrabActive,
      );
    if (this.simulatedPinchGrabActive) {
      this.currentClassification.pose = 'pinch-grab';
      this.currentClassification.isPinchGrabbing = true;
      this.currentClassification.labelZh = 'OK捏合抓取 · 移动旋转(X/Y/Z轴)';
    }
    if (!this.customPoseLandmarks) {
      this.currentClassification.bloomPercentage = Math.round(
        this.simulatedPinchSpread * 100,
      );
    }
    this.drawHandHUD([simLandmarks], this.currentClassification, true);
  }

  private processLiveHandResult(
    hands: Point3D[][],
    nowMs: number,
    dt: number,
    mlHints: Array<MLGestureHint | null> = [],
  ): void {
    const paired = hands.map((h, idx) => ({
      pts: h.map((pt) => ({x: 1 - pt.x, y: pt.y, z: pt.z})),
      hint: mlHints[idx] ?? null,
    }));

    paired.sort((a, b) => b.pts[0].x - a.pts[0].x);

    const primarySmoothed = this.primaryDenoiser.filterLandmarks(
      paired[0].pts,
      nowMs,
    );
    const smoothedHands: Point3D[][] = [primarySmoothed];
    if (paired.length >= 2) {
      smoothedHands.push(
        this.secondaryDenoiser.filterLandmarks(paired[1].pts, nowMs),
      );
    }
    this.lastDetectedHands = smoothedHands;

    const rawPrimaryClass = classifyHandPose(primarySmoothed, paired[0].hint);
    const classification = this.primaryDenoiser.stabilizeClassification(
      rawPrimaryClass,
      dt,
    );
    this.currentClassification = classification;

    const isChangingBloom = this.primaryDenoiser.isActivelyChangingBloom();
    const isPinchGrab = Boolean(classification.isPinchGrabbing);

    // Update 3D flower (X, Y, Z) orientation smoothly
    this.callbacks.onHandOrientationChange(
      classification.orientation.targetYawYRad,
      classification.orientation.targetPitchXRad,
      classification.orientation.targetRollZRad,
      isPinchGrab || !isChangingBloom,
    );

    // Update Bloom Target from primary hand
    this.bloomSliderEl.value = String(classification.bloomPercentage);
    this.callbacks.onBloomTargetChange(
      classification.bloomPercentage,
      classification,
    );

    // If user is pinching fingers to rotate (X, Y, Z) axes, NEVER trigger flower/scene switches!
    if (isPinchGrab) {
      this.primaryHandDetector.reset();
      const pDeg = Math.round(
        (classification.orientation.targetPitchXRad * 180) / Math.PI,
      );
      const yDeg = Math.round(
        ((classification.orientation.targetYawYRad * 180) / Math.PI) % 360,
      );
      const rDeg = Math.round(
        (classification.orientation.targetRollZRad * 180) / Math.PI,
      );
      this.contextSituationEl.textContent = `当前情境: 捏合抓取旋转中 · 移动手指实时改变花朵角度 (X:${pDeg}° / Y:${yDeg}° / Z:${rDeg}°)`;
      this.updateBloomReadoutUI(classification.bloomPercentage, classification);
      this.drawHandHUD(smoothedHands, classification, false);
      return;
    }

    // Case A: User selected 'bloom-orbit-only' -> Never switch flower or environment via gestures
    if (this.logicMode === 'bloom-orbit-only') {
      this.contextSituationEl.textContent = `当前情境: 品种已锁定 · 张合控花(${classification.bloomPercentage}%)，捏合移动旋转(X/Y/Z)轴`;
      this.updateBloomReadoutUI(classification.bloomPercentage, classification);
      this.drawHandHUD(smoothedHands, classification, false);
      return;
    }

    // Case B: Two hands are present in the camera view!
    const cal = this.primaryDenoiser.getCalibrationParams();
    if (smoothedHands.length >= 2) {
      const secondHand = smoothedHands[1];
      const secondClass = classifyHandPose(secondHand);
      this.contextSituationEl.textContent = `当前情境: 双手协同 · 主手控花与(X/Y/Z)旋转，副手挥动切换花朵`;

      const secondPulse = this.secondHandDetector.updateHandPosePulse(
        secondClass.extendedFingers,
        nowMs,
      );
      if (secondPulse?.type === 'next-flower') {
        this.triggerSimulatedSecondHandSwipe('right', '双手协同·副手张掌');
      } else {
        const palmCenter = secondHand[9];
        const trig = this.secondHandDetector.updatePalmCenter(
          palmCenter.x,
          palmCenter.y,
          nowMs,
          {
            minDx: cal.swipeMinDx * 0.65,
            minVelocityX: cal.swipeMinVelocityX * 0.65,
          },
        );
        if (trig?.type === 'next-flower') {
          this.triggerSimulatedSecondHandSwipe(
            trig.direction,
            '双手协同·副手挥手',
          );
        } else if (trig?.type === 'next-environment') {
          this.selectEnvironment(
            (this.activeEnvIndex + 1) % ENVIRONMENT_LIBRARY.length,
            true,
          );
        }
      }

      this.updateBloomReadoutUI(classification.bloomPercentage, classification);
      this.drawHandHUD(smoothedHands, classification, false);
      return;
    }

    // Case C: Single hand in view
    if (this.logicMode === 'dual-hand-split') {
      this.contextSituationEl.textContent = `当前情境: 单手控花(${classification.bloomPercentage}%)与捏合转(X/Y/Z)轴 · 伸入副手可切换花朵`;
      this.updateBloomReadoutUI(classification.bloomPercentage, classification);
      this.drawHandHUD(smoothedHands, classification, false);
      return;
    }

    // Smart Multi-Context Single-Hand Mode:
    const dwell = this.primaryHandDetector.updateDwellCommand(
      classification.pose,
      isChangingBloom,
      nowMs,
      cal.dwellDurationMs,
    );
    classification.dwellProgress01 = dwell.progress01;
    classification.dwellActionLabelZh = dwell.actionLabelZh;

    if (dwell.triggered?.type === 'next-flower') {
      this.triggerSimulatedSecondHandSwipe('right', '单指悬停确认');
    } else if (dwell.triggered?.type === 'next-environment') {
      this.selectEnvironment(
        (this.activeEnvIndex + 1) % ENVIRONMENT_LIBRARY.length,
        true,
      );
    } else if (!isChangingBloom) {
      const primarySwipe = this.primaryHandDetector.updatePalmCenter(
        classification.orientation.palmCenterX,
        classification.orientation.palmCenterY,
        nowMs,
        {
          extendedFingers: classification.extendedFingers,
          requireSteadyFingers: true,
          minDx: cal.swipeMinDx,
          minVelocityX: cal.swipeMinVelocityX,
        },
      );
      if (primarySwipe?.type === 'next-flower') {
        this.triggerSimulatedSecondHandSwipe(
          primarySwipe.direction,
          '单手定姿快扫',
        );
      }
    }

    if (dwell.progress01 > 0.08) {
      this.contextSituationEl.textContent = `当前情境: 悬停指令确认中 · ${dwell.actionLabelZh}`;
    } else if (isChangingBloom) {
      this.contextSituationEl.textContent = `当前情境: 正在调节花冠开合 (${classification.bloomPercentage}%) · 已自动锁定换花防误触`;
    } else {
      this.contextSituationEl.textContent = `当前情境: 单手控花 (${classification.bloomPercentage}%) · 捏住手指移动可改变花朵 (X/Y/Z) 轴向`;
    }

    this.updateBloomReadoutUI(classification.bloomPercentage, classification);
    this.drawHandHUD(smoothedHands, classification, false);
  }

  private buildSimulatedHandLandmarks(
    spread01: number,
    elapsedSec: number,
    pinchGrab = false,
  ): Point3D[] {
    const s = pinchGrab ? 0.04 : clamp(spread01, 0, 1);
    const otherS = pinchGrab ? 0.85 : s;
    const breathe = Math.sin(elapsedSec * 1.8) * 0.004;
    const offsetX = (this.simulatedHandX - 0.5) * 0.34;
    const offsetY = (this.simulatedHandY - 0.5) * 0.24;

    const wrist: Point3D = {x: 0.62 + offsetX, y: 0.84 + offsetY, z: 0};
    const thumbAngles = [0.15, 0.35, 0.58, 0.85];
    const thumbSpreadX = -0.11 - s * 0.17;
    const thumbSpreadY = -0.22 - s * 0.06;

    const indexSpreadX = -0.08 + s * 0.08;
    const indexSpreadY = -0.22 - s * 0.28;

    const pts: Point3D[] = new Array(21);
    pts[0] = wrist;

    for (let i = 1; i <= 4; i++) {
      const f = thumbAngles[i - 1];
      pts[i] = {
        x: wrist.x + thumbSpreadX * f + breathe,
        y: wrist.y + thumbSpreadY * f,
        z: 0,
      };
    }

    const indexFracs = [0.36, 0.62, 0.82, 1.0];
    for (let i = 0; i < 4; i++) {
      const f = indexFracs[i];
      pts[5 + i] = {
        x: wrist.x - 0.03 + indexSpreadX * f,
        y: wrist.y + indexSpreadY * f - breathe,
        z: 0,
      };
    }

    const fingerConfigs = [
      {baseIdx: 9, xOff: 0.01, yLen: -0.28 - otherS * 0.22},
      {baseIdx: 13, xOff: 0.065, yLen: -0.25 - otherS * 0.19},
      {baseIdx: 17, xOff: 0.115, yLen: -0.21 - otherS * 0.15},
    ];
    for (const cfg of fingerConfigs) {
      for (let j = 0; j < 4; j++) {
        const f = indexFracs[j];
        pts[cfg.baseIdx + j] = {
          x: wrist.x + cfg.xOff + f * cfg.xOff * 0.35,
          y: wrist.y + cfg.yLen * f,
          z: 0,
        };
      }
    }

    return pts;
  }

  private drawHandHUD(
    hands: Point3D[][],
    classification: HandPoseClassification,
    drawSimulatedBackdrop: boolean,
  ): void {
    const w = this.canvasEl.width;
    const h = this.canvasEl.height;
    const ctx = this.ctx;

    ctx.clearRect(0, 0, w, h);

    if (drawSimulatedBackdrop) {
      const bgGrad = ctx.createRadialGradient(
        w * 0.55,
        h * 0.55,
        10,
        w * 0.5,
        h * 0.5,
        w * 0.75,
      );
      bgGrad.addColorStop(0, 'rgba(32, 28, 44, 0.94)');
      bgGrad.addColorStop(1, 'rgba(14, 12, 20, 0.98)');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
      ctx.lineWidth = 1;
      for (let gx = 36; gx < w; gx += 36) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, h);
        ctx.stroke();
      }
      for (let gy = 36; gy < h; gy += 36) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(w, gy);
        ctx.stroke();
      }
    }

    if (hands.length === 0) return;

    hands.forEach((handPts, handIdx) => {
      const isPrimary = handIdx === 0;
      ctx.strokeStyle = isPrimary ? '#38d353' : '#38bdf8';
      ctx.lineWidth = 2.4;
      ctx.lineCap = 'round';
      for (const [a, b] of HAND_CONNECTIONS) {
        const pa = handPts[a];
        const pb = handPts[b];
        ctx.beginPath();
        ctx.moveTo(pa.x * w, pa.y * h);
        ctx.lineTo(pb.x * w, pb.y * h);
        ctx.stroke();
      }

      for (let i = 0; i < handPts.length; i++) {
        const pt = handPts[i];
        const isPinchTip = isPrimary && (i === 4 || i === 8);
        ctx.beginPath();
        ctx.arc(pt.x * w, pt.y * h, isPinchTip ? 5.2 : 2.8, 0, Math.PI * 2);
        ctx.fillStyle = isPinchTip
          ? '#ffe033'
          : isPrimary
            ? '#c4f042'
            : '#7dd3fc';
        ctx.fill();
      }
    });

    const primary = hands[0];
    const pThumb = primary[4];
    const pIndex = primary[8];
    const tx = pThumb.x * w;
    const ty = pThumb.y * h;
    const ix = pIndex.x * w;
    const iy = pIndex.y * h;
    const midX = (tx + ix) * 0.5;
    const midY = (ty + iy) * 0.5;

    if (classification.isPinchGrabbing) {
      // Draw 3-Axis (X, Y, Z) Pinch-Grab Gimbal Gizmo at pinched fingertips
      ctx.save();
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.85)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(midX, midY, 18, 0, Math.PI * 2);
      ctx.stroke();

      // X-axis (Pitch - Coral Red vertical vector)
      ctx.strokeStyle = '#ff6b6b';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(midX, midY);
      ctx.lineTo(midX, midY - 24);
      ctx.stroke();

      // Y-axis (Yaw - Emerald Green horizontal vector)
      ctx.strokeStyle = '#4ade80';
      ctx.beginPath();
      ctx.moveTo(midX, midY);
      ctx.lineTo(midX + 24, midY);
      ctx.stroke();

      // Z-axis (Roll - Sky Blue diagonal vector)
      ctx.strokeStyle = '#38bdf8';
      ctx.beginPath();
      ctx.moveTo(midX, midY);
      ctx.lineTo(midX - 17, midY + 17);
      ctx.stroke();
      ctx.restore();
    } else {
      ctx.save();
      ctx.strokeStyle = '#ffda29';
      ctx.lineWidth = 2.4;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(ix, iy);
      ctx.stroke();
      ctx.restore();
    }

    const labelText = classification.isPinchGrabbing
      ? 'PINCH X/Y/Z'
      : `${Math.round(classification.bloomPercentage)}%`;

    ctx.font = '600 11.5px "JetBrains Mono", monospace';
    const textWidth = ctx.measureText(labelText).width;
    const boxW = textWidth + 16;
    const boxH = 22;
    const badgeY = classification.isPinchGrabbing ? midY - 30 : midY;

    ctx.fillStyle = 'rgba(18, 16, 26, 0.92)';
    ctx.strokeStyle = classification.isPinchGrabbing ? '#38bdf8' : '#ffda29';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(midX - boxW / 2, badgeY - boxH / 2, boxW, boxH, 5);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = classification.isPinchGrabbing ? '#7dd3fc' : '#ffea59';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(labelText, midX, badgeY + 0.5);

    if (
      classification.dwellProgress01 &&
      classification.dwellProgress01 > 0.06
    ) {
      ctx.save();
      ctx.strokeStyle =
        classification.pose === 'pointing' ? '#ffd166' : '#38bdf8';
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.arc(
        ix,
        iy,
        14,
        -Math.PI / 2,
        -Math.PI / 2 + classification.dwellProgress01 * Math.PI * 2,
      );
      ctx.stroke();
      ctx.restore();
    }

    if (hands.length >= 2 || this.secondHandSwipeFlash > 0.01) {
      const dirSign = this.secondHandSwipeDir === 'right' ? 1 : -1;
      const slideOffset =
        hands.length >= 2
          ? 0
          : (this.secondHandSwipeProgress - 0.5) * 44 * dirSign;
      const cx =
        hands.length >= 2 ? hands[1][9].x * w : w * 0.25 + slideOffset;
      const cy = hands.length >= 2 ? hands[1][9].y * h : h * 0.54;

      ctx.save();
      ctx.globalAlpha =
        hands.length >= 2 ? 0.95 : clamp(this.secondHandSwipeFlash * 1.4, 0, 1);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(cx, cy, 17, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(cx, cy, 4.0, 0, Math.PI * 2);
      ctx.fill();

      const arrowLen = 32 * dirSign;
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + arrowLen, cy);
      ctx.lineTo(cx + arrowLen - 7 * dirSign, cy - 5);
      ctx.moveTo(cx + arrowLen, cy);
      ctx.lineTo(cx + arrowLen - 7 * dirSign, cy + 5);
      ctx.stroke();
      ctx.restore();
    }
    // Draw 5-Finger Biomechanical Extension Telemetry Bars (拇 · 食 · 中 · 无 · 小) in top-left of canvas
    const exts = classification.fingerExtensions ?? [
      classification.bloomPercentage / 100,
      classification.bloomPercentage / 100,
      classification.bloomPercentage / 100,
      classification.bloomPercentage / 100,
      classification.bloomPercentage / 100,
    ];
    const fingerNames = ['拇', '食', '中', '无', '小'];
    ctx.save();
    ctx.fillStyle = 'rgba(12, 10, 18, 0.82)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(8, 8, 98, 44, 5);
    ctx.fill();
    ctx.stroke();

    for (let fIdx = 0; fIdx < 5; fIdx++) {
      const bx = 15 + fIdx * 17;
      const by = 14;
      const bh = 22;
      const bw = 9;
      const val = clamp(exts[fIdx] ?? 0, 0, 1);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.fillRect(bx, by, bw, bh);

      const fillH = Math.max(2, Math.round(bh * val));
      ctx.fillStyle = val > 0.55 ? '#4ade80' : '#facc15';
      ctx.fillRect(bx, by + bh - fillH, bw, fillH);

      ctx.fillStyle = 'rgba(246, 243, 238, 0.78)';
      ctx.font = '500 8.5px "Noto Sans SC", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(fingerNames[fIdx], bx + bw * 0.5, by + bh + 9);
    }

    // Draw ML Neural Confidence & Latency Telemetry Pill in top-right of skeleton canvas
    const confPct = Math.round((classification.confidence || 0.95) * 100);
    const mlTag = `ML ${confPct}% · ${this.lastInferenceLatencyMs.toFixed(1)}ms`;
    ctx.fillStyle = 'rgba(12, 10, 18, 0.82)';
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
    ctx.beginPath();
    ctx.roundRect(w - 104, 8, 96, 22, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#7dd3fc';
    ctx.font = '600 9.5px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(mlTag, w - 56, 19);
    ctx.restore();
  }

  getCurrentBloomPercentage(): number {
    return this.currentClassification.bloomPercentage;
  }

  getCurrentClassification(): HandPoseClassification {
    return this.currentClassification;
  }

  dispose(): void {
    const stream = this.videoEl?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((t) => t.stop());
    this.gestureRecognizer?.close();
    this.handLandmarker?.close();
    this.rootEl?.remove();
  }
}

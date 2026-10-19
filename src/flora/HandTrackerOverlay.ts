import {FilesetResolver, HandLandmarker} from '@mediapipe/tasks-vision';
import {
  FLOWER_LIBRARY,
  ENVIRONMENT_LIBRARY,
  classifyHandPose,
  SecondHandGestureDetector,
  clamp,
  type Point3D,
  type HandPoseClassification,
} from './gestureMath';

const HAND_CONNECTIONS: Array<[number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

export type SimulationMode = 'auto-showcase' | 'interactive' | 'off';

export interface HandTrackerCallbacks {
  onBloomTargetChange: (bloomPct: number, classification: HandPoseClassification) => void;
  onSelectSpecies: (index: number) => void;
  onSelectEnvironment: (index: number) => void;
  onEnterXR?: () => void;
}

export class HandTrackerOverlay {
  private readonly callbacks: HandTrackerCallbacks;
  private rootEl!: HTMLElement;
  private videoEl!: HTMLVideoElement;
  private canvasEl!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;

  private speciesIndexEl!: HTMLElement;
  private speciesNameZhEl!: HTMLElement;
  private speciesNameEnEl!: HTMLElement;
  private speciesMeaningEl!: HTMLElement;
  private speciesPoemEl!: HTMLElement;
  private bloomValueEl!: HTMLElement;
  private bloomBarFillEl!: HTMLElement;
  private bloomStateBadgeEl!: HTMLElement;
  private poseBadgeEl!: HTMLElement;
  private bloomSliderEl!: HTMLInputElement;
  private camToggleBtn!: HTMLButtonElement;
  private camInlineBtn!: HTMLButtonElement;
  private autoDemoBtn!: HTMLButtonElement;
  private simInlineBtn!: HTMLButtonElement;
  private gestureToastEl!: HTMLElement;

  private speciesButtons: HTMLButtonElement[] = [];
  private envButtons: HTMLButtonElement[] = [];

  private handLandmarker: HandLandmarker | null = null;
  private secondHandDetector = new SecondHandGestureDetector(900, 360);
  private webcamRunning = false;
  private mlLoading = false;
  private lastVideoTime = -1;

  // Start with full simulation showcase active so user immediately sees the hand-flower effect
  private simMode: SimulationMode = 'auto-showcase';
  private simulatedPinchSpread = 0.68;
  private isDraggingCanvas = false;
  private dragLastX = 0;
  private secondHandSwipeFlash = 0;
  private secondHandSwipeProgress = 0;
  private secondHandSwipeDir: 'left' | 'right' = 'right';
  private lastAutoCycleSwitchSec = 0;

  private activeSpeciesIndex = 0;
  private activeEnvIndex = 0;
  private currentClassification: HandPoseClassification;
  private toastTimeout: number | null = null;
  private lastVictoryTriggerMs = -9999;

  constructor(callbacks: HandTrackerCallbacks) {
    this.callbacks = callbacks;
    const initialLandmarks = this.buildSimulatedHandLandmarks(
      this.simulatedPinchSpread,
      0,
    );
    this.currentClassification = classifyHandPose(initialLandmarks);
    this.buildDOM();
    this.bindEvents();
    this.updateSimButtonsUI();
    void this.initMediaPipeModel();
    // Proactively attempt to open camera if permission is already granted or available
    void this.tryAutoStartWebcam();
  }

  private buildDOM(): void {
    const existing = document.getElementById('flora-hud-root');
    if (existing) existing.remove();

    this.rootEl = document.createElement('div');
    this.rootEl.id = 'flora-hud-root';
    this.rootEl.className = 'flora-hud-root';

    this.rootEl.innerHTML = `
      <!-- Top Editorial Bar -->
      <header class="flora-top-bar">
        <div class="flora-brand">
          <span class="flora-brand-mark">✦</span>
          <span class="flora-brand-title">FLORA</span>
          <span class="flora-brand-sub">AI 视觉手势 · 3D 花境实验室</span>
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
          <button type="button" id="flora-auto-btn" class="flora-action-btn active" title="切换手势模拟演练模式">
            <span>🖐️ 模拟演练: 自动开合+换花</span>
          </button>
          <button type="button" id="flora-cam-btn" class="flora-action-btn flora-action-btn-cam" title="开启或关闭真实摄像头手部追踪">
            <span id="flora-cam-btn-label">📷 开启摄像头</span>
          </button>
          <button type="button" id="flora-xr-btn" class="flora-action-btn flora-action-btn-xr" title="进入沉浸式 WebXR 空间视图">
            <span>进入 XR 空间</span>
          </button>
        </div>
      </header>

      <!-- Left Botanical Editorial Specimen Info -->
      <aside class="flora-left-editorial">
        <div class="flora-index-tag" id="flora-species-index">01 / 05 · NELUMBO NUCIFERA</div>
        <h1 class="flora-species-title-zh" id="flora-species-zh">九品粉莲</h1>
        <div class="flora-species-title-en" id="flora-species-en">Sacred Pink Lotus</div>
        <div class="flora-species-meaning" id="flora-species-meaning">清净 · 觉悟 · 雅致</div>
        <p class="flora-species-poem" id="flora-species-poem">
          出淤泥而不染，濯清涟而不妖，指尖开合间尽显东方禅意。
        </p>

        <div class="flora-telemetry-card">
          <div class="flora-telemetry-row">
            <span class="flora-telemetry-label">BLOOM APERTURE / 花冠绽放度</span>
            <span class="flora-telemetry-val" id="flora-bloom-val">68%</span>
          </div>
          <div class="flora-bloom-bar-track">
            <div class="flora-bloom-bar-fill" id="flora-bloom-bar-fill" style="width: 68%"></div>
          </div>
          <div class="flora-bloom-Stage-row">
            <span class="flora-stage-badge" id="flora-bloom-stage">半开雅韵 · Half-Bloom</span>
            <span class="flora-pose-badge" id="flora-pose-badge">指尖开合 · 68%</span>
          </div>
        </div>

        <div class="flora-manual-slider-wrap">
          <label for="flora-bloom-slider" class="flora-slider-label">
            <span>指尖距离模拟 / 手动绽放控制</span>
          </label>
          <input
            id="flora-bloom-slider"
            type="range"
            min="0"
            max="100"
            value="68"
            class="flora-bloom-slider"
          />
          <div class="flora-pose-quick-btns">
            <button type="button" class="flora-mini-btn" data-quick-bloom="0">握拳含苞</button>
            <button type="button" class="flora-mini-btn" data-quick-bloom="50">半开雅韵</button>
            <button type="button" class="flora-mini-btn" data-quick-bloom="100">张掌盛放</button>
            <button type="button" class="flora-mini-btn" id="flora-swipe-sim-btn">挥手换花 ➔</button>
          </div>
        </div>
      </aside>

      <!-- Bottom Row: Bottom-Left Hand Skeleton Monitor + Bottom-Center Species Switcher -->
      <footer class="flora-bottom-row">
        <!-- Bottom-Left Camera & ML Hand Skeleton Monitor (Matching User Video) -->
        <div class="flora-cam-monitor" id="flora-cam-monitor">
          <div class="flora-cam-header">
            <span class="flora-cam-status-dot" id="flora-cam-dot"></span>
            <span class="flora-cam-title" id="flora-cam-status-text">ML 骨骼模拟运行中 · 可叠加摄像头</span>
            <div class="flora-cam-inline-actions">
              <button type="button" id="flora-cam-inline-btn" class="flora-cam-chip flora-cam-chip-primary">
                📷 开启摄像头
              </button>
              <button type="button" id="flora-sim-inline-btn" class="flora-cam-chip active">
                🖐️ 模拟: 自动
              </button>
            </div>
          </div>
          <div class="flora-cam-viewport">
            <video id="flora-webcam-video" class="flora-webcam-video" autoplay playsinline muted></video>
            <canvas id="flora-skeleton-canvas" class="flora-skeleton-canvas" width="360" height="210"></canvas>
            <div class="flora-gesture-toast" id="flora-gesture-toast">✦ 挥手切换花朵</div>
          </div>
        </div>

        <!-- Bottom-Center Botanical Species Switcher -->
        <div class="flora-species-dock" role="region" aria-label="Flower Species Selector">
          <div class="flora-species-cards">
            ${FLOWER_LIBRARY.map(
              (f, idx) => `
              <button
                type="button"
                class="flora-species-card ${idx === 0 ? 'active' : ''}"
                data-species-index="${idx}"
              >
                <span class="flora-species-swatch" style="background: linear-gradient(135deg, ${f.primaryColor}, ${f.secondaryColor})"></span>
                <div class="flora-species-card-meta">
                  <span class="flora-species-card-idx">${f.indexLabel.split(' ')[0]}</span>
                  <span class="flora-species-card-zh">${f.nameZh}</span>
                  <span class="flora-species-card-en">${f.nameEn.split(' ').slice(-1)[0]}</span>
                </div>
              </button>
            `,
            ).join('')}
          </div>
          <div class="flora-dock-legend">
            <span>🖐️ 张合拇指与食指：控制花朵开放 (0%–100%)</span>
            <span>👋 另一只手左右挥动 / 方向键 ← →：变换花朵品种</span>
            <span>✌️ 比耶手势 / 顶部栏：切换四时花境</span>
          </div>
        </div>
      </footer>
    `;

    document.body.appendChild(this.rootEl);

    this.videoEl = document.getElementById('flora-webcam-video') as HTMLVideoElement;
    this.canvasEl = document.getElementById('flora-skeleton-canvas') as HTMLCanvasElement;
    this.ctx = this.canvasEl.getContext('2d')!;

    this.speciesIndexEl = document.getElementById('flora-species-index')!;
    this.speciesNameZhEl = document.getElementById('flora-species-zh')!;
    this.speciesNameEnEl = document.getElementById('flora-species-en')!;
    this.speciesMeaningEl = document.getElementById('flora-species-meaning')!;
    this.speciesPoemEl = document.getElementById('flora-species-poem')!;
    this.bloomValueEl = document.getElementById('flora-bloom-val')!;
    this.bloomBarFillEl = document.getElementById('flora-bloom-bar-fill')!;
    this.bloomStateBadgeEl = document.getElementById('flora-bloom-stage')!;
    this.poseBadgeEl = document.getElementById('flora-pose-badge')!;
    this.bloomSliderEl = document.getElementById('flora-bloom-slider') as HTMLInputElement;
    this.camToggleBtn = document.getElementById('flora-cam-btn') as HTMLButtonElement;
    this.camInlineBtn = document.getElementById('flora-cam-inline-btn') as HTMLButtonElement;
    this.autoDemoBtn = document.getElementById('flora-auto-btn') as HTMLButtonElement;
    this.simInlineBtn = document.getElementById('flora-sim-inline-btn') as HTMLButtonElement;
    this.gestureToastEl = document.getElementById('flora-gesture-toast')!;

    this.speciesButtons = Array.from(
      this.rootEl.querySelectorAll<HTMLButtonElement>('[data-species-index]'),
    );
    this.envButtons = Array.from(
      this.rootEl.querySelectorAll<HTMLButtonElement>('[data-env-index]'),
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

    this.bloomSliderEl.addEventListener('input', () => {
      this.simMode = 'interactive';
      this.updateSimButtonsUI();
      const val = Number(this.bloomSliderEl.value);
      this.setSimulatedBloom(val);
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

    const swipeSimBtn = document.getElementById('flora-swipe-sim-btn');
    swipeSimBtn?.addEventListener('click', () => {
      this.triggerSimulatedSecondHandSwipe('right');
    });

    const cycleSimMode = () => {
      if (this.simMode === 'auto-showcase') {
        this.simMode = 'interactive';
        this.showGestureToast('🖐️ 已切换至「手动/拖拽骨骼模拟」· 在左下角画面上下拖动指尖');
      } else if (this.simMode === 'interactive') {
        this.simMode = 'auto-showcase';
        this.lastAutoCycleSwitchSec = performance.now() / 1000;
        this.showGestureToast('🎬 已开启「自动手势模拟演练」· 自动演示张合开花与挥手换花');
      } else {
        this.simMode = 'auto-showcase';
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

    const xrBtn = document.getElementById('flora-xr-btn');
    xrBtn?.addEventListener('click', () => {
      this.callbacks.onEnterXR?.();
    });

    this.canvasEl.addEventListener('pointerdown', (e) => {
      this.isDraggingCanvas = true;
      this.dragLastX = e.clientX;
      this.simMode = 'interactive';
      this.updateSimButtonsUI();
      this.updateSpreadFromCanvasPointer(e);
      this.canvasEl.setPointerCapture(e.pointerId);
    });

    this.canvasEl.addEventListener('pointermove', (e) => {
      if (!this.isDraggingCanvas) return;
      const dx = e.clientX - this.dragLastX;
      if (Math.abs(dx) > 48) {
        this.dragLastX = e.clientX;
        this.triggerSimulatedSecondHandSwipe(dx > 0 ? 'right' : 'left');
      } else {
        this.updateSpreadFromCanvasPointer(e);
      }
    });

    this.canvasEl.addEventListener('pointerup', () => {
      this.isDraggingCanvas = false;
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') {
        this.triggerSimulatedSecondHandSwipe('right');
      } else if (e.key === 'ArrowLeft') {
        this.triggerSimulatedSecondHandSwipe('left');
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

  private updateSpreadFromCanvasPointer(e: PointerEvent): void {
    const rect = this.canvasEl.getBoundingClientRect();
    const relY = clamp((e.clientY - rect.top) / rect.height, 0.08, 0.92);
    const pct = Math.round((1 - (relY - 0.08) / 0.84) * 100);
    this.setSimulatedBloom(clamp(pct, 0, 100));
  }

  setSimulatedBloom(percentage: number): void {
    const clampedPct = clamp(percentage, 0, 100);
    this.simulatedPinchSpread = clampedPct / 100;
    this.bloomSliderEl.value = String(clampedPct);
    const landmarks = this.buildSimulatedHandLandmarks(
      this.simulatedPinchSpread,
      performance.now() / 1000,
    );
    this.currentClassification = classifyHandPose(landmarks);
    this.currentClassification.bloomPercentage = clampedPct;
    this.updateBloomReadoutUI(clampedPct, this.currentClassification);
    this.callbacks.onBloomTargetChange(clampedPct, this.currentClassification);
  }

  triggerSimulatedSecondHandSwipe(direction: 'left' | 'right'): void {
    this.secondHandSwipeFlash = 1.0;
    this.secondHandSwipeProgress = 0;
    this.secondHandSwipeDir = direction;
    const nextIdx =
      direction === 'right'
        ? (this.activeSpeciesIndex + 1) % FLOWER_LIBRARY.length
        : (this.activeSpeciesIndex - 1 + FLOWER_LIBRARY.length) %
          FLOWER_LIBRARY.length;
    this.selectSpecies(nextIdx, true);
    this.showGestureToast(
      `👋 左手挥动 · 切换至「${FLOWER_LIBRARY[nextIdx].nameZh}」`,
    );
  }

  selectSpecies(index: number, notifyCallback = false): void {
    this.activeSpeciesIndex =
      ((index % FLOWER_LIBRARY.length) + FLOWER_LIBRARY.length) %
      FLOWER_LIBRARY.length;
    const spec = FLOWER_LIBRARY[this.activeSpeciesIndex];

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

    this.showGestureToast(`✨ 场景切换 · ${env.nameZh} (${env.nameEn})`);

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

  private updateSimButtonsUI(): void {
    const isAuto = this.simMode === 'auto-showcase';
    this.autoDemoBtn.textContent = isAuto
      ? '🖐️ 模拟演练: 自动开合+换花'
      : '🖐️ 模拟演练: 手动拖拽指尖';
    this.autoDemoBtn.classList.toggle('active', isAuto);

    if (this.simInlineBtn) {
      this.simInlineBtn.textContent = isAuto ? '🖐️ 模拟: 自动' : '🖐️ 模拟: 手动';
      this.simInlineBtn.classList.toggle('active', isAuto);
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
    }, 2100);
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
    } else if (rounded >= 88) {
      stageLabel = '倾城满开 · Full Bloom';
    }
    this.bloomStateBadgeEl.textContent = stageLabel;
    this.poseBadgeEl.textContent = classification.labelZh;
  }

  private async initMediaPipeModel(): Promise<void> {
    if (this.mlLoading || this.handLandmarker) return;
    this.mlLoading = true;
    try {
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm',
      );
      try {
        this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numHands: 2,
          minHandDetectionConfidence: 0.45,
          minHandPresenceConfidence: 0.45,
          minTrackingConfidence: 0.45,
        });
      } catch {
        // Fallback to CPU delegate if WebGL2/GPU delegate is restricted in iframe/headless
        this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
            delegate: 'CPU',
          },
          runningMode: 'VIDEO',
          numHands: 2,
          minHandDetectionConfidence: 0.45,
          minHandPresenceConfidence: 0.45,
          minTrackingConfidence: 0.45,
        });
      }
    } catch (err) {
      console.warn('MediaPipe HandLandmarker fallback to interactive simulation:', err);
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
      // Normal if browser awaits explicit button click or no physical webcam is attached
    }
  }

  private attachWebcamStream(stream: MediaStream): void {
    const statusTextEl = document.getElementById('flora-cam-status-text');
    const dotEl = document.getElementById('flora-cam-dot');
    const labelEl = document.getElementById('flora-cam-btn-label');

    this.videoEl.srcObject = stream;
    void this.videoEl.play();
    this.webcamRunning = true;
    this.videoEl.classList.add('active');
    if (labelEl) labelEl.textContent = '📷 摄像头已开启';
    this.camToggleBtn.classList.add('active');
    if (this.camInlineBtn) {
      this.camInlineBtn.textContent = '📷 摄像头: 开';
      this.camInlineBtn.classList.add('active');
    }
    if (statusTextEl) {
      statusTextEl.textContent = 'LIVE 摄像头 + 骨骼追踪已开启';
    }
    dotEl?.classList.add('live');
    this.showGestureToast('📷 摄像头已开启 · 伸手入画即可控花，无手时自动叠加模拟骨骼');
    void this.initMediaPipeModel();
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
      if (labelEl) labelEl.textContent = '📷 开启摄像头';
      if (this.camInlineBtn) {
        this.camInlineBtn.textContent = '📷 开启摄像头';
        this.camInlineBtn.classList.remove('active');
      }
      if (statusTextEl) {
        statusTextEl.textContent = 'ML 骨骼模拟运行中 · 可叠加摄像头';
      }
      dotEl?.classList.remove('live');
      this.showGestureToast('已切换为纯手势骨骼模拟模式');
      return;
    }

    try {
      // Request getUserMedia immediately on click to preserve browser user gesture token
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {width: {ideal: 640}, height: {ideal: 480}, facingMode: 'user'},
        audio: false,
      });
      this.attachWebcamStream(stream);
    } catch (err) {
      console.warn('Camera access unavailable, using interactive simulation:', err);
      this.simMode = 'auto-showcase';
      this.updateSimButtonsUI();
      this.showGestureToast('💡 浏览器未授权或无物理摄像头 · 已为您开启全自动手势模拟');
    }
  }

  update(elapsedSec: number, dt: number): void {
    if (this.secondHandSwipeFlash > 0) {
      this.secondHandSwipeFlash = Math.max(0, this.secondHandSwipeFlash - dt * 1.45);
      this.secondHandSwipeProgress = clamp(
        this.secondHandSwipeProgress + dt * 2.2,
        0,
        1,
      );
    }

    // 1. Check live camera feed for real hand landmarks first
    if (
      this.webcamRunning &&
      this.handLandmarker &&
      this.videoEl.readyState >= 2
    ) {
      const nowMs = performance.now();
      if (this.videoEl.currentTime !== this.lastVideoTime) {
        this.lastVideoTime = this.videoEl.currentTime;
        const result = this.handLandmarker.detectForVideo(this.videoEl, nowMs);
        if (result.landmarks && result.landmarks.length > 0) {
          this.processLiveHandResult(result.landmarks, nowMs);
          return;
        }
      }
    }

    // 2. When no real hand is in front of the camera (or camera is off),
    // run the active simulation overlay so the user ALWAYS sees the live hand skeleton & flower blooming!
    if (this.simMode === 'auto-showcase') {
      const wave = 0.5 + 0.5 * Math.sin(elapsedSec * 1.25 - 0.4);
      this.simulatedPinchSpread = wave;
      const pct = Math.round(wave * 100);
      this.bloomSliderEl.value = String(pct);
      const landmarks = this.buildSimulatedHandLandmarks(wave, elapsedSec);
      this.currentClassification = classifyHandPose(landmarks);
      this.currentClassification.bloomPercentage = pct;
      this.updateBloomReadoutUI(pct, this.currentClassification);
      this.callbacks.onBloomTargetChange(pct, this.currentClassification);

      // Periodically demonstrate the second-hand horizontal swipe flower transition every 7.5 seconds
      if (elapsedSec - this.lastAutoCycleSwitchSec > 7.5) {
        this.lastAutoCycleSwitchSec = elapsedSec;
        this.triggerSimulatedSecondHandSwipe('right');
      }
    }

    const simLandmarks = this.buildSimulatedHandLandmarks(
      this.simulatedPinchSpread,
      elapsedSec,
    );
    this.currentClassification.bloomPercentage = Math.round(
      this.simulatedPinchSpread * 100,
    );
    this.drawHandHUD(
      [simLandmarks],
      this.currentClassification,
      !this.webcamRunning,
    );
  }

  private processLiveHandResult(
    hands: Point3D[][],
    nowMs: number,
  ): void {
    const mirroredHands: Point3D[][] = hands.map((h) =>
      h.map((pt) => ({x: 1 - pt.x, y: pt.y, z: pt.z})),
    );

    mirroredHands.sort((a, b) => b[0].x - a[0].x);
    const primaryHand = mirroredHands[0];
    const classification = classifyHandPose(primaryHand);
    this.currentClassification = classification;

    if (
      classification.pose === 'victory' &&
      nowMs - this.lastVictoryTriggerMs > 1800
    ) {
      this.lastVictoryTriggerMs = nowMs;
      this.selectEnvironment(
        (this.activeEnvIndex + 1) % ENVIRONMENT_LIBRARY.length,
        true,
      );
    }

    this.bloomSliderEl.value = String(classification.bloomPercentage);
    this.updateBloomReadoutUI(classification.bloomPercentage, classification);
    this.callbacks.onBloomTargetChange(
      classification.bloomPercentage,
      classification,
    );

    if (mirroredHands.length >= 2) {
      const secondHand = mirroredHands[1];
      const palmCenter = secondHand[9];
      const trig = this.secondHandDetector.updatePalmCenter(
        palmCenter.x,
        palmCenter.y,
        nowMs,
      );
      if (trig?.type === 'next-flower') {
        this.triggerSimulatedSecondHandSwipe(trig.direction);
      } else if (trig?.type === 'next-environment') {
        this.selectEnvironment(
          (this.activeEnvIndex + 1) % ENVIRONMENT_LIBRARY.length,
          true,
        );
      }
    }

    this.drawHandHUD(mirroredHands, classification, false);
  }

  private buildSimulatedHandLandmarks(
    spread01: number,
    elapsedSec: number,
  ): Point3D[] {
    const s = clamp(spread01, 0, 1);
    const breathe = Math.sin(elapsedSec * 2.2) * 0.008;

    const wrist: Point3D = {x: 0.68, y: 0.86, z: 0};
    const thumbAngles = [0.15, 0.35, 0.58, 0.85];
    const thumbSpreadX = -0.14 - s * 0.16;
    const thumbSpreadY = -0.18 - s * 0.06;

    const indexSpreadX = -0.04 + s * 0.06;
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
        x: wrist.x - 0.05 + indexSpreadX * f,
        y: wrist.y + indexSpreadY * f - breathe,
        z: 0,
      };
    }

    const fingerConfigs = [
      {baseIdx: 9, xOff: 0.01, yLen: -0.28 - s * 0.22},
      {baseIdx: 13, xOff: 0.065, yLen: -0.25 - s * 0.19},
      {baseIdx: 17, xOff: 0.115, yLen: -0.21 - s * 0.15},
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
      bgGrad.addColorStop(0, 'rgba(38, 34, 52, 0.92)');
      bgGrad.addColorStop(1, 'rgba(18, 16, 26, 0.96)');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.045)';
      ctx.lineWidth = 1;
      for (let gx = 30; gx < w; gx += 30) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, h);
        ctx.stroke();
      }
      for (let gy = 30; gy < h; gy += 30) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(w, gy);
        ctx.stroke();
      }
    }

    if (hands.length === 0) return;

    const primary = hands[0];

    ctx.strokeStyle = '#38d353';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    for (const [a, b] of HAND_CONNECTIONS) {
      const pa = primary[a];
      const pb = primary[b];
      ctx.beginPath();
      ctx.moveTo(pa.x * w, pa.y * h);
      ctx.lineTo(pb.x * w, pb.y * h);
      ctx.stroke();
    }

    for (let i = 0; i < primary.length; i++) {
      const pt = primary[i];
      const isPinchTip = i === 4 || i === 8;
      ctx.beginPath();
      ctx.arc(pt.x * w, pt.y * h, isPinchTip ? 5.2 : 3.2, 0, Math.PI * 2);
      ctx.fillStyle = isPinchTip ? '#ffe033' : '#c4f042';
      ctx.fill();
      if (isPinchTip) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    const pThumb = primary[4];
    const pIndex = primary[8];
    const tx = pThumb.x * w;
    const ty = pThumb.y * h;
    const ix = pIndex.x * w;
    const iy = pIndex.y * h;

    ctx.save();
    ctx.strokeStyle = '#ffda29';
    ctx.lineWidth = 2.6;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(ix, iy);
    ctx.stroke();
    ctx.restore();

    const midX = (tx + ix) * 0.5;
    const midY = (ty + iy) * 0.5;
    const labelText = `${Math.round(classification.bloomPercentage)}%`;

    ctx.font = '600 13px "JetBrains Mono", monospace';
    const textWidth = ctx.measureText(labelText).width;
    const boxW = textWidth + 16;
    const boxH = 22;

    ctx.fillStyle = 'rgba(20, 20, 28, 0.88)';
    ctx.strokeStyle = '#ffda29';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(midX - boxW / 2, midY - boxH / 2, boxW, boxH, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffea59';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(labelText, midX, midY + 0.5);

    // Draw second-hand palm tracking circle & directional vector arrow (matching the uploaded video)
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
        hands.length >= 2 ? 1.0 : clamp(this.secondHandSwipeFlash * 1.4, 0, 1);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(cx, cy, 19, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(cx, cy, 4.5, 0, Math.PI * 2);
      ctx.fill();

      const arrowLen = 36 * dirSign;
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + arrowLen, cy);
      ctx.lineTo(cx + arrowLen - 7 * dirSign, cy - 6);
      ctx.moveTo(cx + arrowLen, cy);
      ctx.lineTo(cx + arrowLen - 7 * dirSign, cy + 6);
      ctx.stroke();
      ctx.restore();
    }
  }

  getCurrentBloomPercentage(): number {
    return this.currentClassification.bloomPercentage;
  }

  getCurrentClassification(): HandPoseClassification {
    return this.currentClassification;
  }

  isWebcamActive(): boolean {
    return this.webcamRunning;
  }

  getSimulationMode(): SimulationMode {
    return this.simMode;
  }

  dispose(): void {
    const stream = this.videoEl?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((t) => t.stop());
    this.handLandmarker?.close();
    this.rootEl?.remove();
  }
}

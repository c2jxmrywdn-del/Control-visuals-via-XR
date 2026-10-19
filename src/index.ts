import * as xb from 'xrblocks';
import {FloraXRScript} from './flora/FloraXRScript';

async function startFloraStudio(): Promise<void> {
  const options = new xb.Options();
  options.setAppTitle('FLORA — 手势控制花朵开放与多维花境');
  options.setAppDescription(
    '结合 MediaPipe 机器学习手部骨骼追踪与 Three.js PBR 植物工作室，通过手指张合与挥手手势控制花朵绽放与品种变换。',
  );
  options.enableHands();
  options.enableGestures();
  options.enableReticles();
  options.gestures.setGestureEnabled('point', true);
  options.gestures.setGestureEnabled('spread', true);

  const floraScript = new FloraXRScript();
  xb.add(floraScript);
  await xb.init(options);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    void startFloraStudio();
  });
} else {
  void startFloraStudio();
}

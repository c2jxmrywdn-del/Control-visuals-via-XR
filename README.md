# FLORA — 多纲目植物图谱 · 智能多情境手势 3D 实验室
**FLORA Botanical Studio: Articulated 3D Gaussian Splatting, ML Hand-Gesture Kinematics & Firebase Cloud Presets**

FLORA 是一个融合 **铰接式 3D 高斯泼溅（Articulated 3D Gaussian Splatting）**、**次表面天鹅绒散射着色器（UE5 Subsurface Velvet + SH Degree-2 Radiance）**、**MediaPipe 实时机器学习手势识别** 以及 **Firebase 云端花谱同步** 的交互式 3D 植物形态学实验室。用户可通过摄像头手势、实测手势视频或触控/鼠标，自然流畅地控制 8 大植物纲目从紧闭花苞（Closed Bud, `0%`）到倾城盛放（Full Bloom, `100%`）的连续生物力学绽放过程，以及整株三维空间（X 俯仰 / Y 水平 / Z 翻滚）360° 全向旋转。

---

## 核心特性 (Core Features)

### 1. 铰接式 3D 高斯泼溅与有机花瓣着色 (Articulated 3DGS & Organic Subsurface Shading)
- **三种实时渲染管线 (`GaussianSplatMode`)**：
  - `hybrid-3dgs`（3DGS 实景：混合）：结合具有真实双面法线微凹凸、主/次级分叉叶脉纹理（Vascular Venation）的次表面植物网格与铰接式各向异性 3D 高斯辐射场微粒。
  - `pure-3dgs`（3DGS 实景：纯泼溅）：隐藏三角网格，纯粹通过 2D 协方差椭球投影（EWA Splatting Covariance Projection）与球谐函数（SH Degree-2）渲染体积光场。
  - `pbr-mesh`（3DGS 实景：仅网格）：展现植物标本级的叶脉肌理、内腔环境光遮蔽（Cavity AO）与天鹅绒边缘散射（Epidermal Velvet Sheen）。
- **防过曝影棚级布光与软膝高光压缩**：
  - 针对娇嫩花瓣校准的 ACES Filmic 曝光（`toneMappingExposure = 0.82`）与柔和光比，配合着色器内的软膝高光压缩（`directDiffuse /= (1.0 + directDiffuse * 0.36)`）与深层花萼内腔遮蔽（`0.42..1.0`），确保高光区域依然清晰呈现丝绸般的花脉与表皮细胞微凹凸细节。
- **严格不穿模包络与自然呼吸感**：
  - 黄金角螺旋（`137.50776°`）花序排布、S 型非对称自然卷曲、花瓣边缘波浪褶皱（Ruffle）、严格嵌套的无穿模花壳包络（`computeFloralShellEnvelope`），以及多频段正弦微风摇曳。

### 2. 机器学习多情境手势控制 (ML Hand-Gesture Recognition & Kinematics)
- **MediaPipe 21 关键点 3D 骨骼追踪 + 9 类神经手势分类 (`HandPoseLabel`)**：
  - `open-palm`：五指全张 · 倾城盛放 (`100%`)
  - `closed-fist`：握拳收拢 · 含苞待放 (`0%`)
  - `pinch-caliper`：双指卡尺 · 精准收拢成苞
  - `pinch-spread`：五指张合 · 连续控制花冠绽放度 (`0% ~ 100%`)
  - `pinch-grab`：OK 捏合抓取 · 锁定花姿并自由旋转整株 `(X/Y/Z)` 三轴角度
  - `pointing`：单指悬停指令 · 切换下一株植物品种
  - `victory`：双指 V 字指令 · 切换动态生态光场
  - `thumb-up`：竖起拇指 · 锁定鉴赏姿态
  - `finger-count`：多指伸展分级绽放控制
- **1€ 自适应卡尔曼低通滤波 (`HandSignalDenoiser`)**：
  - 支持「灵敏度校准 (`10% ~ 100%`)」与「强降噪滤波」，消除摄像头高频采样抖动。
- **三种防误触交互策略 (`InteractionLogicMode`)**：
  - `smart-context`（智能多情境）：张合控花、捏合转轴、单指/挥手换花自动协同。
  - `bloom-orbit-only`（锁定品种·仅控花与轴）：屏蔽换花手势，专注控制当前花朵开合与三轴旋转。
  - `dual-hand-split`（双手严格分工）：主手控制开花与旋转，仅当副手入镜挥动时切换花朵。

### 3. 八大植物纲目图谱 (`FLOWER_LIBRARY`)
| 序号 | 品种 ID (`id`) | 中文名称 | 学名 (`binomial`) | 植物学分类 (`classZh`) | 形态学结构 (`morphology`) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `01 / 08` | `lotus` | 九品粉莲 | *Nelumbo nucifera* | 基部双子叶纲 · 山龙眼目 · 莲科 | `lotus-pod`（蜂窝状莲蓬与舟形粉白莲瓣） |
| `02 / 08` | `peony` | 洛阳魏紫牡丹 | *Paeonia suffruticosa* | 核心双子叶纲 · 虎耳草目 · 芍药科 | `peony-ruffled`（千叶重瓣冠冕与柔波花缘） |
| `03 / 08` | `orchid` | 紫霞蝴蝶兰 | *Phalaenopsis aphrodite* | 单子叶植物纲 · 天门冬目 · 兰科 | `orchid-zygomorphic`（两侧对称蝶翼侧瓣与丝绒唇瓣） |
| `04 / 08` | `lily` | 星光金脉百合 | *Lilium orientalis* | 单子叶植物纲 · 百合目 · 百合科 | `lily-recurved`（三基数六出反卷星瓣与丁字花药） |
| `05 / 08` | `sunflower` | 曜金向日葵 | *Helianthus annuus* | 菊类双子叶纲 · 菊目 · 菊科 | `sunflower-capitulum`（斐波那契螺旋管状花盘与金黄舌状花） |
| `06 / 08` | `iris` | 蓝翼德国鸢尾 | *Iris germanica* | 单子叶植物纲 · 天门冬目 · 鸢尾科 | `iris-bearded`（三枚直立内拱旗瓣与反卷金须垂瓣） |
| `07 / 08` | `camellia` | 十八学士山茶 | *Camellia japonica* | 菊类双子叶纲 · 杜鹃花目 · 山茶科 | `camellia-fibonacci`（覆瓦状几何玉瓣六重黄金螺旋） |
| `08 / 08` | `udumbara` | 幽蓝星芒睡莲 | *Nymphaea caerulea luminis* | 基部被子植物群 · 睡莲目 · 睡莲科 | `waterlily-stellate`（星芒花冠与生物微光脉络） |

### 4. 四大动态生态光场 (`ENVIRONMENT_LIBRARY`)
- **晨雾禅池 (`zen-pond` / Misty Zen Sanctuary)**：温润晨光与水面涟漪。
- **月华流萤 (`moon-garden` / Moonlit Firefly Courtyard)**：清冷月色与流萤微光。
- **落日暖房 (`golden-solarium` / Amber Dusk Conservatory)**：琥珀暮光与逆光金尘。
- **翡翠植物志 (`botanical-atelier` / Emerald Herbarium Studio)**：博物馆级林间散射光。

### 5. Firebase 云端花谱与安全规则 (Firebase Cloud Presets & Zero-Trust Security)
- 集成 **Firebase Authentication (Google 账号登录)** 与 **Cloud Firestore**（顶部工具栏 `☁️ 云端花谱`）。
- 支持将当前花朵品种、花冠绽放度、生态光场、3DGS 渲染模式及三维空间姿态角 (`X/Y/Z`) 一键保存至云端、随时加载恢复或归档。
- 配备通过 `@firebase/eslint-plugin-security-rules` 静态检查与 14 项正反例单元测试验证的零信任安全规则（`firestore.rules`）。

---

## 项目目录结构 (Project Structure)

```text
├── index.html                           # 应用 HTML 入口
├── src/
│   ├── index.ts                         # XRBlocks 与 FLORA 3D 工作室启动入口
│   ├── index.css                        # 全局 HUD 界面与响应式样式
│   └── flora/
│       ├── FloraXRScript.ts             # 主场景控制器、弹簧阻尼运动学、跨品种渐变与整株三轴旋转
│       ├── FlowerModels.ts              # 8 大植物程序化几何、分叉叶脉纹理、法线生成、次表面着色器与铰接式 3DGS
│       ├── EnvironmentManager.ts        # 4 大生态光场、防过曝影棚布光与大气悬浮粒子
│       ├── HandTrackerOverlay.ts        # MediaPipe 手势识别、HUD 控制面板、视频演练与 Firebase 云端花谱抽屉
│       ├── gestureMath.ts               # 纯函数手势特征提取、9 分类神经推理、1€ 滤波、花壳防穿模包络与 3DGS 数学核
│       ├── firebaseClient.ts            # Firebase Auth (Google Popup) 与 Firestore 云端花谱 CRUD 客户端
│       ├── gestureMath.test.ts          # 手势数学、防穿模包络与 3DGS 单元测试
│       └── firestore.rules.test.ts      # Firestore 安全规则 "Dirty Dozen" 攻防单元测试
├── firestore.rules                      # 零信任 Firestore 安全规则
├── firebase-blueprint.json              # Firestore 实体与路径架构蓝图
├── firebase-applet-config.json          # Firebase Web 应用配置
├── security_spec.md                     # 安全规则不变量与攻防测试规范
├── eslint.config.js                     # Firestore 安全规则 ESLint 配置
└── package.json
```

---

## 本地运行与测试 (Local Setup & Testing)

### 1. 安装依赖
```bash
npm install
```

### 2. 启动开发服务器
```bash
npm run dev
```
启动后在浏览器访问 `http://localhost:3000`。

### 3. 运行类型检查、安全规则检查与单元测试
```bash
# 1. TypeScript 严格类型检查
npm run lint

# 2. Firestore 安全规则静态检查
npx eslint firestore.rules

# 3. 运行手势运动学、3DGS 与 Firestore 安全规则单元测试
npx tsx --test src/flora/gestureMath.test.ts src/flora/firestore.rules.test.ts

# 4. 构建生产环境代码包
npm run build
```

---

## 上传到 GitHub 指南 (How to Push to GitHub)

### 方式一：使用 Google AI Studio 内置 GitHub 导出（推荐，一键同步）
1. 点击 AI Studio 界面右上角工具栏中的 **GitHub 图标（Export to GitHub / Save to GitHub）**。
2. 授权你的 GitHub 账号后，输入仓库名称（例如 `flora-3dgs-botanical-studio`），选择 **Public** 或 **Private**。
3. 点击确认即可将完整项目代码与提交历史直接推送到你的 GitHub 仓库。

### 方式二：使用 Git 命令行推送
本地 Git 仓库已初始化并完成提交。若在本地终端或已配置 GitHub 凭据的环境中，可执行：

```bash
git remote add origin https://github.com/<你的GitHub用户名>/<你的仓库名>.git
git branch -M main
git push -u origin main
```

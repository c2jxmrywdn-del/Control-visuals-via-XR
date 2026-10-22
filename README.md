# FLORA — 多纲目植物图谱 · 智能多情境手势 3D 实验室
**FLORA Botanical Studio: Articulated 3D Gaussian Splatting, ML Hand-Gesture Kinematics & Firebase Cloud Presets**

FLORA 是一个融合 **铰接式 3D 高斯泼溅（Articulated 3D Gaussian Splatting）**、**次表面天鹅绒散射着色器（UE5 Subsurface Velvet + SH Degree-2 Radiance）**、**MediaPipe 实时机器学习手势识别** 以及 **Firebase 云端花谱同步** 的交互式 3D 植物形态学实验室。用户可通过摄像头手势或触控/鼠标，自然流畅地控制 8 大植物纲目从紧闭花苞（Bud, `0%`）到完全盛放（Full Bloom, `100%`）的连续生物力学绽放过程，以及整株 360° 全向空间旋转。

---

## 核心特性 (Core Features)

### 1. 铰接式 3D 高斯泼溅与有机花瓣着色 (Articulated 3DGS & Organic Subsurface Shading)
- **三种实时渲染管线 (`SplatRenderMode`)**：
  - `hybrid-3dgs`（混合高保真模式）：结合具有真实双面法线凹凸、主/次级分叉叶脉纹理（Vascular Venation）的有机花瓣网格与 ~9,000 个铰接式各向异性 3D 高斯微粒。
  - `pure-3dgs`（纯 3DGS 辐射场模式）：隐藏三角网格，纯粹通过 2D 协方差投影（2D Covariance Splat Projection）与球谐函数（SH Degree-2）渲染体积光场。
  - `pbr-mesh`（次表面丝绒网格模式）：展现植物标本级的叶脉肌理、内腔环境光遮蔽（Cavity AO）与天鹅绒边缘散射（Epidermal Velvet Sheen）。
- **防过曝影棚级布光与高光压缩**：
  - 针对娇嫩花瓣校准的 ACES Filmic 曝光（`toneMappingExposure = 0.82`）与柔和光比，配合着色器内的软膝高光压缩（Soft-knee Highlight Compression）与深层花萼内腔遮蔽（`0.42..1.0`），确保高光区域依然清晰呈现丝绸般的花脉与表皮细胞微凹凸细节。
- **自然生物力学与微风呼吸感**：
  - 黄金角螺旋（`137.50776°`）花序排布、S 型非对称自然卷曲、花瓣边缘波浪褶皱（Ruffle），以及多频段正弦微风摇曳（Per-petal Organic Wind Sway）。

### 2. 机器学习多情境手势控制 (ML Hand-Gesture Recognition & Kinematics)
- **MediaPipe Hands 21 关键点实时推理 + 9 分类神经姿态识别**：
  - 识别 `OPEN_BLOOM`（五指张开盛放）、`PINCH_BUD`（捏合合拢成苞）、`PEACE_NEXT_SPECIES`（V 字手势切换植物纲目）、`THREE_FINGER_ENV`（三指切换生态光场）、`THUMBS_UP_FAVORITE`（点赞收藏姿态）、`POINT_INTERACT`（单指自由引蝶/拨动）等手势。
- **1€ 自适应低通滤波器 (1-Euro Filter)**：
  - 对手腕旋转、手掌中心位置与花朵开合度进行低延迟防抖滤波，消除摄像头采样抖动与僵硬跳变。
- **无冲突双模式手势映射**：
  - **手掌开合距离 (`bloomOpenness`)** 独立控制花苞合拢至完全盛开（`0% ~ 100%`）。
  - **手掌空间移动与手腕翻转 (`targetRotationX / Y / Z`)** 独立控制整株植物（包含花冠、花萼、花茎、叶片）的 3 轴连续自由旋转，互不干扰。

### 3. 八大植物纲目图谱 (8 Botanical Classes & Morphologies)
| 纲目 ID | 中文名称 | 学名 | 形态学结构 (`Morphology`) |
| :--- | :--- | :--- | :--- |
| `nymphaea` | 睡莲纲 · 圣洁莲 | *Nelumbo nucifera* | `cup-lotus`（碗状多层渐开花冠 + 金黄莲蓬雄蕊群） |
| `magnoliids` | 木兰类 · 玉堂春 | *Magnolia denudata* | `stellate-magnolia`（高挑厚瓣杯状玉兰） |
| `monocots` | 单子叶 · 幽谷兰 | *Phalaenopsis aphrodite* | `zygomorphic-orchid`（两侧对称唇瓣 + 3 萼片 + 2 侧花瓣） |
| `eudicots-ranunculales` | 毛茛目 · 洛阳红 | *Paeonia suffruticosa* | `ruffled-peony`（60 瓣繁复层叠波浪褶皱花冠） |
| `rosids` | 蔷薇类 · 大马士革 | *Rosa damascena* | `spiral-rose`（高密度螺旋包裹卷边花心） |
| `asterids` | 菊类 · 蓝星睡莲 | *Nymphaea caerulea* | `ray-composite`（放射状星芒尖瓣） |
| `caryophyllales` | 石竹目 · 仙人指 | *Epiphyllum oxypetalum* | `tubular-epiphyllum`（修长月光白重瓣昙花） |
| `proteales` | 山龙眼目 · 帝王花 | *Protea cynaroides* | `bract-protea`（天鹅绒苞片皇冠 + 密集丝状花蕊球） |

### 4. 四大动态生态光场 (4 Dynamic Sanctuary Environments)
- **晨曦温室 (`morning-glasshouse`)**：通透暖阳与体积丁达尔光束。
- **幽暗植物志 (`midnight-botanica`)**：深邃博物学暗调影棚，凸显丝绒边缘光与微距脉络。
- **黄金时刻 (`golden-hour`)**：琥珀色夕阳逆光，强化花瓣次表面透光感。
- **迷雾雨林 (`misty-rainforest`)**：清冷青翠雨林漫射光与悬浮孢子微粒。

### 5. Firebase 云端花谱与安全规则 (Firebase Cloud Presets & Zero-Trust Security)
- 集成 **Firebase Authentication (Google 登录)** 与 **Cloud Firestore**。
- 支持一键保存当前花朵品种、绽放开合度、生态光场、高斯渲染模式及整株三维空间姿态至云端，或设为公开社区花谱供所有访客加载体验。
- 配备通过 `@firebase/rules-unit-testing` 与 `eslint-plugin-firestore-rules` 验证的零信任安全规则（`firestore.rules`）。

---

## 项目目录结构 (Project Structure)

```text
├── src/
│   ├── main.ts                        # 应用入口与 DOM 挂载
│   ├── flora/
│   │   ├── FloraXRScript.ts           # 主场景控制器、3D 相机、手势与整株旋转运动学循环
│   │   ├── FlowerModels.ts            # 8 大植物程序化几何、叶脉纹理、法线生成与次表面着色器
│   │   ├── GaussianSplatFlora.ts      # 铰接式 3D 高斯泼溅生成器与 SH Degree-2 球谐着色器
│   │   ├── EnvironmentManager.ts      # 4 大生态光场、防过曝影棚布光与大气悬浮微粒
│   │   ├── HandTrackerOverlay.ts      # MediaPipe 手势识别、HUD 控制面板与云端花谱抽屉 UI
│   │   ├── gestureMath.ts             # 纯函数手势特征提取、9 分类推理与 1€ 滤波器
│   │   ├── firebaseClient.ts          # Firebase Auth 与 Firestore 云端花谱 CRUD 客户端
│   │   ├── gestureMath.test.ts        # 手势数学与运动学单元测试
│   │   └── firestore.rules.test.ts    # Firestore 安全规则模拟器单元测试
├── firestore.rules                    # 零信任 Firestore 安全规则
├── firebase-blueprint.json            # Firestore 数据结构蓝图
├── security_spec.md                   # 安全规则架构规范说明
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

### 3. 运行单元测试与安全规则检查
```bash
# 运行手势运动学与 Firestore 安全规则测试
npx tsx --test src/flora/gestureMath.test.ts src/flora/firestore.rules.test.ts

# 静态检查 Firestore 安全规则
npx eslint firestore.rules

# 生产环境类型检查与构建
npm run build
```

---

## 上传到 GitHub 指南 (How to Push to GitHub)

### 方式一：使用 Google AI Studio 内置 GitHub 导出（推荐，一键同步）
1. 点击 AI Studio 界面右上角工具栏中的 **GitHub 图标（Export to GitHub / Save to GitHub）**。
2. 授权你的 GitHub 账号后，输入仓库名称（例如 `flora-3dgs-botanical-studio`），选择 **Public** 或 **Private**。
3. 点击确认即可将完整项目代码与提交历史直接推送到你的 GitHub 仓库。

### 方式二：使用 Git 命令行推送
本地 Git 仓库已初始化并完成提交。如果你在本地终端或配置了 Personal Access Token / SSH Key 的环境中，只需绑定你的远程 GitHub 仓库地址并推送：

```bash
# 1. 在 GitHub 上新建一个空仓库（例如 https://github.com/<你的用户名>/flora-3dgs-studio.git）
# 2. 绑定远程仓库并推送 main 分支
git remote add origin https://github.com/<你的用户名>/flora-3dgs-studio.git
git branch -M main
git push -u origin main
```

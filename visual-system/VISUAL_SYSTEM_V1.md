# isle live｜Visual System V1.0 初版

依据 V6 图册第 6 页的 Story Land / Red Land 对照、V7 运行资产、V10 本地源码及三个模式截图。正式四张 UI 参考原件收到后补做字形、边框和布局对照。

## 1. Art Direction

Dark Vaporwave × Retro Pixel RPG × CRT Terminal。世界采用紫色宇宙、薰衣草与薄荷地表、分层岸壁和可辨认的玩具形体。Story Land 的自然空间与 Red Land 的街区节点使用同一世界语言。保留 V10 紫色终端、多层像素外框、金色焦点和档案相框。

## 2. Color Palette

世界色板采用 Night Ink `#181329`、Terminal Purple `#292040`、Deep Indigo `#403974`、Muted Purple `#7763AD`、Lavender `#AAA2E9`、Mint `#A4DFC7`、Bubblegum Pink `#F3C3DF`、Dusty Pink `#E8B2D5`、Electric Blue `#586DCA`、Cream White `#FFF0E8`、Light Yellow `#F8E990`。现实物件保留识别色。

UI 继续以 `dist/native-tokens.css` 为运行基线，例如现有 ink `#20172F`、terminal `#38236C`、lavender `#C995EB`。先记录语义映射，再逐个组件评估换色。

## 3. Typography

本地 IslePixel 用作英文状态、编号和短标签，ObserverCN 承担中文及长正文。统一同类控件的数字风格、字号、行高和中英文基线。检查用户备注、生僻字、数字和系统回退，保留原生可选文本。

## 4. Pixel Rendering Rules

Phaser 使用 pixelArt、roundPixels，UI Sprite 以 contain 和像素采样呈现。以规整像素簇和深紫轮廓组织形体，轮廓初值为逻辑像素 1 px，内部用有限明暗和统一左上光。缩小到实际游戏尺寸后审核边缘与半透明锯齿。等比显示优先，整数倍率可用时优先选用。

## 5. Perspective & Scale

Orthogonal 2D Tilemap，配合 top-down 3/4 Sprite。地砖 16×16 逻辑像素，居民逻辑显示高 17 px，探探正面源图 165×224。源图、游戏视觉尺寸、逻辑占地、接地点分别记录。苹果源图 137×159、绘制 12×14；苹果屋运行源图 59×52，逻辑占地 3×2 格。检查画布及对象各自的等比误差。

## 6. Terrain Rules

沿用 128×128 的 8×8 Atlas。地表、岸线、可放置、可走和阻挡分开配置。新增 Chunk 保持正交世界坐标与已有格，拼接后重算暴露岸线。岛壁正面分层，连接口在扩张后更新。整岛母版作为迭代参考。

## 7. Character Sprite Rules

复用三人四向透明图。脚点 `[0.5,1]`，目标可见高约 17 逻辑 px。跨方向帧对齐同一脚点和体量，按接地 Y 排序；现有静帧和步进摆动为基线。新增动作按真实支持的帧与状态登记。

## 8. Object Sprite Rules

通常使用底部中心接地，有特殊支点时单独配置。透明边距按脚点校准，视觉轮廓可越过占地。先在 16 px 网格上确认大小，再单独配置碰撞和可达互动点。纯图鉴展示物件需明确展示用途。

## 9. Evolution Asset Rules

沿用苹果→巨型苹果→苹果屋的资产关系。形态有独立 Sprite、尺寸、占地和互动点，切换前验证扩张后的占地和门前格，失败保留旧形态。其它演变先通过素材与规则验收再加入候选。

## 10. UI Component Rules

沿用 CRTShell、PixelFrame、PixelButton、ModeKey、PhotoFrame、ArchiveTabs 和 TimelineItem 的层次与焦点语言。World 仅留轻量 HUD；Collection 与 Memories 使用全屏独立布局。优先为 4:3 重排区块和增加触控间距，主要触控目标先按 44 CSS px 校验。保留响应、焦点、选中与禁用状态。

## 11. CRT Effects

扫描线、暗角、噪声、辉光和信号呼吸保持独立显示层与 pointer-events none。延续 Off / Low / Medium 及 reduced-motion 支持。逐档检查照片、正文和操作反馈。

## 12. Asset Export Standards

按 terrain、residents、objects、evolutions、atmosphere、ui、easter-eggs 分类。使用小写短横线命名，角色方向沿用 `-front/-back/-left/-right`，既有 `zaozhao` ID 继续兼容。Sprite 输出透明 PNG，照片和大幅预览可用 JPEG/WebP，逻辑数据用 JSON。登记 `assetId`、`sourcePath`、`displayName`、`category`、`logicalWidth/Height`、`anchor`、`footprint`、`collision`、`interactionPoints`、`animationStates`、`supportedTransformations`，附源尺寸、许可与状态。先以现有 JSON 作映射，避免两套运行时配置漂移。

## 13. AI Generation Prompts

- 物件模板：以提供的原物主体和颜色为准，绘制单个 top-down 3/4 RPG 像素物件。采用深紫轮廓、左上光、清晰像素簇与透明背景。沿用该类部件的逻辑尺寸，底部接地点清楚，世界中按 16 px 网格验收。
- 地形模板：制作 16×16 正交地块，按 V7 Atlas 对应地表族和岸线接口输出，维持薰衣草、薄荷与深紫岸壁色阶。提交 edge 方向与可拼接预览。
- 演变模板：保留原物最显著的识别色和形态线索，按批准的功能变化绘制独立 Sprite，提供顶部与正面可见面、底部接地点及占地草图。

## 14. Quality Assurance Checklist

- 核对 alpha、轮廓、实际视觉尺寸、调色板、许可和引用路径。
- 检查拼缝、扩张、脚底贴地、前后遮挡、占地、门口可达性及失败演变回退。
- 比较目标 4:3 截图与参考，核对世界几何、字体回退、触控尺寸、CRT 档位和安全区。
- 离线检查照片、字体、导入示例，以及从放置、居民互动到真实事件回显的完整链路。

## V10.2 游戏尺度与像素验收

- **逻辑单位。** 一格为 16×16；居民平时可见高度 17 逻辑 px（1.06 格），交互中的慢慢使用现有 15 px 动作高度。四向分别保留原来的体宽。平板模拟的 Canvas 放大约 1.66× CSS，DPR 2 只影响设备输出采样。
- **物件尺度。** 单格随身物以约 12–22 px 最长边为起点，仍以居民辨识和占地关系校准。苹果实际约 12×13.93，巨型苹果 25×28.08，苹果屋 59×52。新小建筑须通过 3×2 格和门口可达测试。面积、屋顶投影和碰撞独立记录。
- **像素密度。** 原生地砖 1 源 px 对应 1 逻辑 px；苹果屋也可 1:1。高分辨率居民和基础物保留母图，首次交付时还须在真实逻辑显示尺寸预览最近邻采样。标注 source px / logical px 比率，只有出现轮廓跳动、细节消失或方向轮廓不一致时，才导出独立的低分辨率运行版。母图仍保留供 Collection 使用。
- **先度量再导出。** 记录文件尺寸、RGBA、透明边界与底部接触位置；输出 PNG，以及单独记录逻辑外接盒、锚点、占地与互动点的配置。显示宽高为源宽高乘以同一个缩放倍率。需要画幅留白时调整透明边距或资源锚点，并在四方向与遮挡切换中复核。屋前互动点以地图格为准。
- **美术复核。** 原生尺寸和放大像素预览都要看到明确的深紫轮廓、左上光与干净的明暗块。在薰衣草和薄荷地面各验一次对比度。独立 Sprite 保持透明，不带地形、阴影滤镜或 CRT 烘焙。发布前用开发校准覆盖层验证格、bounds、footpoint 和可达点，并关掉覆盖层检查实际构图。
- **非对称占地。** 巨型苹果的游戏落点保持原格，锚点 x 为 .18，使等比显示的 25 px 轮廓居中覆盖原有向右扩展的两个格。正式尺寸、锚点与导出说明一起更新。

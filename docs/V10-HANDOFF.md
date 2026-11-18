# isle live｜Observer UI V10.0

## 本轮实现

在 V7 现有仓库上增量实现 React 原生终端。修改前的 Git 基线为 `661686b0b907e84c03a24e51938ef3a37598363a`；本地标签 `observer-pre-v10-20261118`，开发分支 `observer-v10-native`。站点修改前为保存版本 3。回退可使用该基线，旧 UI 源码和原有静态文件也仍保留。

UI 没有加载上一轮的截图组件、边框切片、Figma 导入模型或完整参考图。参考图仅用于离线视觉对照，未复制到 dist。所有标题、正文、按钮为 HTML；面板、按钮、选框、图标和 CRT 外框由 SVG/CSS 实现。杯子为原生 SVG 示意，不是从参考截图裁切。

## 文件边界

| 文件 | 职责 |
|---|---|
| src/native-components.jsx | CRTShell、PixelFrame、RetroPanel、PixelButton、ModeKey、ObjectSlot、ObjectCard、PhotoFrame、ArchiveTabs、TimelineItem、StatusIndicator、SignalIndicator、ResidentInfo、TransmissionOverlay、CRTOverlay |
| src/observer-v10.jsx | Boot、World HUD、Collection、Memories、原图对照、Import、键盘与旋钮模拟、共享数据订阅 |
| dist/native-tokens.css | 色彩、字体、轮廓、阴影、间距、像素单位、动画及组件填充变量 |
| dist/native.css | 原生视觉、布局、独立 CRT 图层、游戏宿主尺寸与触控样式 |
| scripts/build.mjs | 本地 React/esbuild 编译，无运行时 CDN |
| scripts/pixel-font.py | 原创 5×7 英文终端字体构建；正文仍为可选择、可编辑文本 |
| tests/native-policy.cjs | 检查未加载截图复刻资源；验证五个核心游戏文件与基线完全一致 |
| dist/index.html | 加载 V10 bundle；保留原游戏加载顺序和旧游戏控件 DOM |
| dist/fonts/ | 原创像素字体、中文字体子集与 Noto 许可 |

`dist/main.js`、`world.js`、`terrain.js`、`observer-store.js`、`observer-bridge.js` 均保持基线字节不变。没有重写地图、居民、碰撞、寻路、扩张或世界实例。

## Canvas 与 React

Phaser 仍由原来的单次脚本初始化。React 的 GameViewport 通过 portal 把已存在的游戏 DOM 接入独立物理像素宿主，不重新创建 Phaser。页面切换只隐藏游戏宿主并禁用交互，不销毁 Canvas。宿主位于 UI 等比缩放容器之外，避免 Canvas 被缩放两次；原 Phaser FIT 与输入坐标换算继续工作。

设计坐标 1662×930，按原图近 16:9 比例等比显示。Phaser 逻辑画布保持 688×432。二者比例不同，因此使用居中 FIT 和统一紫色余白，保留完整岛屿；没有横向拉伸。UI 不占固定左右栏或底部导航。

游戏继续处理点击居民、地图放置、碰撞和实际寻路。ResidentInfo 读取既有居民信息 DOM 的变化作为适配接口，不伪造角色行为。放置与演变沿用 IsleGameBridge 的请求和事件。该 DOM 适配层后续可以由原生居民选择事件替换。

## 组件与交互

- 启动：原生 Logo 文本、终端副标题、SVG 小岛标记、三键按钮；只在首次加载出现。
- World：真实 Phaser、LIVE、岛名、信号、时间、取景框、居民信息。右下菜单可开启原有测试工具。
- Collection：3×3 对象网格、金色角标、详情、真实照片与 Sprite、演变预览。PHOTOS / OBJECTS 为内部视图。原图 / Sprite / Compare 为详情状态。
- Memories：四条预置故事与实际事件分别标记；真实事件按当前岛筛选。相框通过 CSS border、shadow、transform 叠放。底部是实际可选的静态记忆索引，不冒充视频进度。
- Import：Explorer 与 Collection 共用一套 preview / editing / placing / completed 流程。确认投放才写入成功事件。取消不写入成功放置，设备 ID 去重沿用原 Store。
- 数据：原有收藏、实例、回忆和多岛数据继续使用原 Store 与存储键。本轮没有清空用户历史。测试重置只恢复当前地图，保留回忆。

## CRT 与输入

菜单提供 Off / Low / Medium；扫描线、暗角、辉光、SVG 程序噪声、慢速信号呼吸为独立无交互图层。`pointer-events: none`；没有对 Canvas 或中文文字使用 blur 或扭曲变换。Off 完全移除这些新增效果。`prefers-reduced-motion` 关闭转场和信号呼吸。可选色差未实现。

1 / 2 / 3 直接选择 World / Collection / Memories；重复键保持当前模式。Q / E 更改全局岛屿上下文而不改主模式。T 模拟同一个采集 ID。Escape 关闭临时操作。长按 repeat、输入框焦点、输入法组合输入和修饰键均有保护。Keyboard Debug / CRT Debug 独立开关。尚未进行真实硬件联调。

## 实测结果

构建通过；`npm test` 共 14 项通过。包括地形扩张、边界、居民合法路径、障碍占地、探索反应、演变、水域、重置、持久化、去重、快捷键及原生资源约束。

桌面浏览器实际通过：

1. 启动原生 UI 可见，1 进入真实游戏，2/3 切换全屏模式。
2. Off 选中后 DOM 的 `data-crt=off`，覆盖层隐藏；Low 可恢复。
3. Collection 的 Photos 可浏览已有原始示例影像，详情可切换三个查看状态。
4. 备注输入框按 1 输入字符，没有导航。
5. 从 Collection 进入共用 Import；点击地面得到 `(18,12)`，确认后创建真实苹果实例。
6. 探探沿路径靠近，真实 reaction 为“这颗果实是什么？”。
7. 扩张从 405 格到 492 格，苹果 ID 和 `(18,12)` 坐标不变。
8. 2→3→1 后扩张和实例仍保留，页面只有一个 Canvas。
9. 点击真实探探后出现 React ResidentInfo，状态来自原游戏。
10. 回忆切换到真实事件可看到上述记录；E 切到 Red Land 后仍停留 Memories，显示该岛实际记录为空。
11. 取消 Collection 导入返回原界面；重复 T 显示去重提示。
12. 刷新后历史保留。最后用于截图的地图已通过原有重置恢复空白。

触屏代码路径继续使用原 Phaser 逻辑，但没有真实平板或实体 HID 硬件实测；不同宽高比和系统字体回退尚需目标设备验收。

## 与参考图的具体差异

- 外框由参数化 SVG 构成，比原图手绘像素边缘更规整；高光纹理、磨损、局部锯齿尚非逐像素一致。
- Logo 与英文为原创像素字体，中文为 Noto Sans CJK 子集，字形、字距与原图不完全相同。
- Boot 复用现有独立天空素材，云层和月亮位置与原图不同；中央标记是原生 SVG 近似。
- World 保留真实 V7 地形、比例、居民与 Sprite。没有为了匹配参考插画而重画地图或预置苹果屋。
- Collection 使用真实已有素材，因此苹果、花朵、猫咪、椅子等外形不同；晶石暂用已有晶花示意。状态与页数按实际收藏数量计算，不伪造“已放置”或 3 页数据。
- Memories 使用已有游戏静态影像，取景与原图苹果屋近景不同。真实事件没有截图时明确显示物件图示。
- 按要求新增二级视图与真实事件切换；静态影像索引替代没有视频功能的假播放进度。

本轮通过原生实现与核心交互的第一轮验收，但不能宣称已达到原图逐像素一致。下一轮应以真实显示屏逐项精修边框磨损、字体宽度及素材一致性，同时保持游戏逻辑不变。

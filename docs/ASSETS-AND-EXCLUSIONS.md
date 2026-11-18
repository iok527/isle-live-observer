# 素材、外部依赖与未包含项

## 已包含

完整 React 源码、原生 CSS/Visual Tokens/CRT、可编辑游戏业务 JS、Store/Bridge、键盘与导入逻辑、地图 Atlas 和 JSON、扩张 Chunk、边界/Mask/锚点、三位居民四方向素材、苹果/苹果屋与设施素材、50 个 dist/assets 文件、本地字体、预置故事与采集示例。来源以 dist/assets/asset-manifest.json 为准，未凭空补写素材许可。

apple-source-sample.png、sample-leaf.jpg、sample-stone.jpg、event-*.png 和预览岛屿等为已有演示素材，不是本次导出的用户真实采集历史。部分原素材未提供完整授权链；保留项目现有文件不等于授予第三方素材再分发权，正式公开开源前需核查素材权利。React、React DOM、esbuild 的许可证通过 npm 安装获得；额外复制在 licenses/ 中供审阅。Phaser MIT 许可在 dist/PHASER-LICENSE.md，Noto 许可在 dist/fonts/LICENSE-NOTO.txt。

## 未包含 / 无法随源码迁移

- 线上用户浏览器 localStorage 中的私人收藏、世界布局、真实历史；源仓库不包含这些数据。
- ChatGPT Sites 托管账户、登录状态、平台凭证、服务器配置或私有密钥。该版本本地运行不需要它们。
- Git 历史和 .git、node_modules、npm 缓存；用 npm ci 根据锁文件安装依赖。
- 原始 V6 PDF、完整未处理视觉包、PSD/Aseprite 源文件等未在工程中存在的原始设计文件。运行所需的现有导出素材已包含。
- Phaser 引擎上游未压缩开发源码仓库；包含的是该版本本地分发库及游戏业务源码。
- 真实 AI、图像识别服务、实体采集器、ESP/HID 联调和云端数据库：当前版本并未连接这些服务，因此没有可以导出的服务端工程或数据。

## 可选工具依赖

网页仅需 Node/npm。若重新运行 tools/make_terrain.py 需 Python + Pillow，scripts/pixel-font.py 需 Python + fontTools。准备好的地砖与字体已包含，不运行这两个工具也可以安装、构建和使用网页。

## 环境变量

必需：无。可选：HOST、PORT（本地 HTTP 服务）。不含密钥，无须创建 AI API Key。

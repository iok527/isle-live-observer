# isle live · Observer V10 完整源码导出

这是当前已发布 Observer V10 的源码导出，非截图拼装包。来源站点虽沿用 V7 Terrain Lab 域名，当前源码版本为 10.0.0、Sites 保存版本 4。

- 来源提交：`4c9d37b18af4ff2315d9bae5cd056549e3e75fea`
- 发布地址：https://isle-live-v7-terrain-lab.jiaqilong527.chatgpt.site
- 导出验证日期：2026-11-18
- 本包未修改 UI、地图或游戏功能，也未更新线上部署。

## 本地启动

安装 Node.js 24（本次测试 24.22.3，npm 11.9.0），解压后在包含 package.json 的目录执行：

```bash
npm ci
npm run dev
```

打开 http://localhost:5173 。停止服务按 Ctrl+C。

```bash
npm run build
npm test
npm run preview
```

生产预览：http://localhost:4173 。首次安装需要访问 npm registry；安装后运行不需要 ChatGPT/Sites 登录、API 密钥或外部 CDN。

同一局域网的平板测试：`npm run dev -- --host 0.0.0.0 --port 5173`，平板打开电脑局域网 IP 的 5173 端口。请只在可信网络使用该开发服务。本次没有进行真实平板或 macOS 实测。

开发服务监视 React 源码并重建 bundle，修改后手动刷新；未配置 HMR。CSS 与游戏 JS 位于 dist，保存后刷新即可。

## 真实技术栈

| 层 | 当前实现 |
| --- | --- |
| UI | React / React DOM 19.1.1，原生 HTML、CSS、SVG |
| 世界 | Phaser 3.90.0，随项目本地分发 |
| 构建 | esbuild 0.25.8，非 Vite |
| 状态 | 本地 JavaScript Store、事件桥、localStorage |
| 服务 | 新增 Node 内置静态开发/预览服务，无后端数据库 |

Phaser 引擎以 `dist/phaser.min.js` 和 MIT 许可证交付；游戏业务源码为可编辑 JS，不是仅有压缩引擎文件。

## 文件导航

| 路径 | 用途 |
| --- | --- |
| src/observer-v10.jsx | Boot、World HUD、Collection、Memories、Import、快捷键 |
| src/native-components.jsx | 原生复用 UI 与 CRT 组件 |
| dist/native.css、native-tokens.css | 正式 V10 样式与变量 |
| dist/main.js | Phaser 场景、居民行为与游戏控制 |
| dist/world.js、terrain.js | 网格、寻路、碰撞、扩张与地形绘制 |
| dist/observer-store.js | 收藏、实例、回忆、持久化与去重 |
| dist/observer-bridge.js | React 与 Phaser 事件桥 |
| dist/assets/ | 50 个现有素材及地图/占地/锚点配置文件 |
| dist/fonts/ | 本地字体及 Noto 许可 |
| scripts/ | 构建、开发服务、预览与字体生成 |
| tools/make_terrain.py | 可选地形生成工具 |
| tests/ | 14 项现有测试及便携基线 |
| migration/ | 原始配置与发布文件哈希，用于追溯 |
| docs/ | 原有交接及本次导出说明、验证结果 |
| archive/ | 原项目保留的历史资料；不作为当前入口 |

**重要：不要清空 dist 后再构建。** 现有工程将可编辑游戏 JS、CSS、静态资源也放在 dist，build 只重新生成 observer-v10.js 及 sourcemap。这是原工程结构，迁移时未擅自重构。

## 操作

启动页点击三个模式入口，或键盘 1 / 2 / 3 进入 World / Collection / Memories。Q / E 切换岛屿上下文，T 模拟采集器，Escape 关闭临时层。右下终端控制菜单提供 CRT 档位、Keyboard Debug 和游戏测试工具。照片、采集与记忆示例均为演示数据，未接入真实 AI 或硬件。未完成地图使用明确的 Preview 状态。

## 数据与环境变量

必需环境变量：无。可选启动参数环境变量名为 HOST、PORT；详见 .env.example（不含密钥）。开发服务不会自动加载 .env。

浏览器 localStorage 以 origin 隔离。源码包包括预置示例数据，不包含用户在现有线上站点浏览器中产生的私人历史；本地首次运行不会自动继承这些记录。不要以为换域名后数据会自动搬迁。

## 构建和部署

在本地执行 npm ci、npm run build，把整个 dist 目录部署到支持静态站点的服务即可。不能只上传 React bundle，必须带上本地 Phaser、CSS、字体及 assets。无需原 Sites 项目凭证。

.openai/hosting.json 仅保留静态目录说明，移除了原站点绑定。没有创建、推送或部署新仓库。需要 GitHub 时可在解压目录创建自己的仓库，选择你控制的 remote；node_modules 和环境文件已被 .gitignore 排除。

## 本次便携适配

新增 dev/start/preview 启动脚本、Node 版本提示和迁移文档；锁文件根版本从旧的 8.0.0 对齐当前 10.0.0（依赖版本与完整性不变）。原测试依赖旧 Git 提交，现改为随包 SHA256 fixture，保证没有 .git 也能测试。原始版本保存在 migration/。

重新构建后，全部 68 个发布 dist 文件与来源提交逐字节一致。详见 docs/VALIDATION.md、docs/ASSETS-AND-EXCLUSIONS.md。

# 导出验证 · 2026-11-18

已核对当前 Sites 保存版本 4、发布成功记录与提交 4c9d37b18af4ff2315d9bae5cd056549e3e75fea。域名沿用 V7，实际为 Observer V10。

## 本次执行

- 从精确提交 git archive 创建独立目录，无 .git、无原 node_modules，使用独立空 npm 缓存执行 npm ci 成功（安装 5 个包）。
- Linux、Node 24.22.3、npm 11.9.0；npm run build 成功，npm test 14/14 通过。
- 重新构建后的全部 68 个 dist 发布文件 SHA256 与来源提交一致。
- HTTP 入口、React bundle、Phaser、地图 JSON、中文字体均返回 200，详见 http-checks.json。
- 浏览器从导出目录正常显示 Boot；按 1 进入真实 Phaser，data-ready=true、Canvas 数量 1；按 2 显示 Collection，按 3 显示 Memories，按 1 返回 World，仍为单 Canvas 且 ready=true，无页面重载。
- 未观察到应用来源 error 日志；浏览器扩展自身有一条 metadata 发送错误，与项目无关。

14 项自动化涵盖原生资源约束、游戏文件基线、事件去重、岛屿独立历史、输入保护、采集入库、随机行走、占地验证、探索反应、演变、水域阻挡、真实扩张及重置。

## 范围与限制

本轮没有重新逐项手动操作所有游戏机制，依靠保留的自动化和业务文件字节一致性验证。V10-HANDOFF.md 是原有交接历史，不能当成本次重新执行记录。没有 macOS、真实平板、HID 或真实 AI 服务测试。npm 的 http-proxy 提示来自测试宿主环境，不是项目配置。

未改线上站点，未创建 GitHub 仓库。migration/published-files.sha256.json 记录原发布文件哈希；EXPORT-FILES.sha256 记录导出文件哈希（自身除外）。ZIP 外附下载校验摘要。

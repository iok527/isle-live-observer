# iPad Typography QA · V10.5.2

## 复现与原因

此前 Mac Chromium 的字形日志确认：标题、按钮、正文及气泡命中本机 FZXS16，状态、编号及时间轴命中 FZXS12，Logo 用随包 Isle Terminal Pixel。旧 CSS 的方正入口只有 `local()`，iPad 无对应安装时标题、正文与气泡会依次落到随包 ObserverCN（旧 Noto 子集）和系统中文字体，辅助信息先尝试 Isle Terminal Pixel。iPad 实际每个字形使用哪款字体尚无实机渲染日志。固定 CSS 字号、行高、字距、面板尺寸不会因字体加载自动改值；字宽、基线墨迹范围和换行可能变化，尤其影响状态栏、物件名、时间轴和居民气泡。

## 发布字体

主文字统一请求同源 Fusion Pixel 12px proportional zh-Hans WOFF2，标题、正文、状态继续走现有字体 token 和不同字号。Logo 与品牌斜体维持既有字形。缺字回退 ObserverCN、PingFang SC 等系统字体；辅助英文还可回退 Isle Terminal Pixel。没有使用方正文件，也没有对其转换或裁剪。

固定上游 2026.08.11 发布，原样保存 zh-Hans WOFF2，SHA-256 为 `e7e57f471045328b6c9583cbd70fa45122c66c78038c3777abfd7a29d476cf44`。随包保留上游 OFL 和依赖字体许可。该网页字体文件不依赖 CDN 或设备安装。 [官方发布](https://github.com/TakWolf/fusion-pixel-font/releases/tag/2026.08.11) · [OFL](https://github.com/TakWolf/fusion-pixel-font/blob/master/LICENSE-OFL)

## 验证

诊断页 `/typography-qa.html` 报告 CSS 视口、DPR 和同源字体加载结果，同时展示标题、中英编号、长对话、罕见字与参考回退。加载状态说明网页字库可用，不能逐字证明 Safari 没有回退。

Simulator Passed 于 1210×834 CSS px、DPR 2。Chromium 实际字形报告验证 Terminal、World、Collection、Memories 均使用 Fusion Pixel，动作证据中可核对居民气泡。iPad 还需记录诊断页实测尺寸，并对四模式和居民气泡逐项检查基线、断行、文字清晰度、触控目标和动作比例。截图在外层 `evidence/v10.6/`。

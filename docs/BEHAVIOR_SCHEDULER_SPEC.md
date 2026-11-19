# V10.8 Behavior Scheduler

基线 `b0613e5`，独立分支 `feature/v10.8-living-world-core`。天气 V10.7 保留。未修改 Weather Renderer、图层、原紫色星空、天气事件或持久化结构。未接入 Work V4/V5 天气。

- 新物件或成功演变按世界实例入队。相同实例当前在队列或正在互动时合并。每次取一个物件作业，按 discovery/research/facility 权重选居民，主偏好 3、默认 1，同权沿用原先顺序。
- 每位居民一次拿一个可到达互动格。排序按曼哈顿距离，实际通行用现有 BFS。其他居民占用的当前格、下一格和目标格排除。居民寻路被打断后释放当前任务的演员，保留任务顺序供下一轮选点。暂不可达沿用 4 秒等待和跳过规则。
- 每次真实互动签记 4 秒的同居民、同实例、同形态冷却。重复任务会等待冷却，而不是同一交互连发。下一形态重新具备兴趣。
- 用户确认普通苹果 Build 时暂停探索调度并释放当前互动格，保留其他作业进度，其他居民仍可游荡。抵达合法格并完成动作后继续使用原有 World/Bridge 验证及提交。失败、Escape、重置或刷新有各自的退出路径。内存动作不写存档，未完成 Build 刷新不提交；成功的演变、实例身份和回忆继续持久化。

## 验收与真机

构建通过，V10 26/26、V7 6/6。自动化覆盖 18 组实际抵达、任务中断/恢复、冷却和重复入队。Chromium 1210×834 CSS px、DPR 2 回归三位居民动作、苹果、叶子船、Capture、Memories、模式、旋钮和单 Canvas。天气回归覆盖预览/取消、刷新保持和六个真实机位/天气组合；字体确认 Fusion Pixel。证据位于外层 `evidence/v10.8/`。

iPad 历史 Device Passed：Fusion Pixel 网页字库加载、天气变化与天空贴合。V10.8 真机需复验当前版本的字体视觉、触控落点、World / Collection / Memories、实体键与旋钮、各居民提示清晰度、后台唤醒和保存恢复。模拟器结论独立于真机结果。

## 文件范围

`dist/behavior-scheduler.js`、`dist/resident-actions.js`、`dist/world.js`、`dist/main.js`、`dist/observer-bridge.js`、两张检定 Inspect PNG、入口及版本、React bundle 与 source map。回归在 `tests/world.test.cjs`。

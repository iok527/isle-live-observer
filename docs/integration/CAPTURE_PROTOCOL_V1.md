# Explorer → Observer Capture Protocol V1

既有 V10.4 由 Store 按 captureId 接收、Collection 显示待登岛物件、Bridge 执行放置与演变。V10.5 在此之外提供只读 HTTP 批次适配器。真实 Explorer 上传和实际 AI 上游仍由设备或中间服务实现。

## 请求与字段

Observer 从操作员提供的批次 URL 发出 GET，响应为 JSON 最新快照。V1 不要求长连接、USB 或串口，批次地址不写入游戏存档。

- `protocolVersion` 必填整数，V1 为 `1`。
- `batchId`、`sourceDeviceId` 必填稳定字符串。
- `captures` 必填数组，1–8 条。每条 `captureId` 为跨设备全局唯一且稳定的必填字符串。
- `captureTimestamp` 必填，ISO 8601 含时区。 `revision` 必填非负整数，同一采集的 AI 更新严格增加。
- 每条采集须提供 `originalImageUrl` 或 `localFileRef` 之一。两者都是 HTTP(S) URL 或相对于批次响应 URL 的文件路径。后者由中间服务映射至可读取的本地文件。网页无法访问服务端绝对文件路径，V1 拒绝 `file:`、`blob:` 和 `data:` 传输引用。
- `objectLabel` 可选字符串，显示用；`objectCategory` 可选字符串，使用 apple / leaf / stone。初始处理阶段可省略。
- `spriteAssetId` 可选字符串，只能与本地分类审核条目匹配。`supportedEvolutionIds` 可选字符串数组，由 Observer 与已支持演变名单取交集，不能授予游戏新能力。
- `status` 必填，`processing`、`ready`、`failed` 或 `unsupported`。 `note` 与 `errorCode` 可选字符串。Observer 分开保存 AI 备注与用户编辑后的备注。
- 标识符只接受 1–96 个字母、数字及 `._:-`。JSON 上限 64 KiB。照片接受 JPEG、PNG、WebP，新下载原图每张至多 2.5 MiB，每批合计至多 3 MiB。

## 状态和重试

Detect 等待并验证批次清单。Transfer 下载缺失的图像字节。Decode 由浏览器验证可解码图像、匹配本地资源。Arrive 仅在批次成功写入本地存储后出现。每次操作都可以取消，取消尚未提交的批次不会产生部分收藏。断线、损坏图片或存储空间不足时可重试同一 URL。没有强行延迟的成功状态。

照片可以先以 processing 或 failed 到达并留在口袋。中间服务之后返回同批同 ID 的更高 revision，Observer 的「重试 / 刷新 AI 状态」拉取最新快照。未知类别、无审核 Sprite 或不合法 Sprite 声明保留原图并标记不支持。已就绪或不支持的记录可由服务发布更高版本的修正结果，已上岛实例及其历史由游戏继续管理。重复或过时 revision 忽略，重复请求不会重复下载已保存的同一原图。V1 将原图视为不可变，新图需新 captureId。已有 ID 如来自其他设备或批次，整个请求失败。用户备注和实例来源不随着 AI 更新被覆盖。

持久化把原始图像字节编码为 data URL 写原有本地存档，临时解码不接受资源 URL 作为永久地址。在同一个浏览器及源下刷新可恢复；累计容量受浏览器配额限制，失败不覆盖当前档案。限额、真实设备拍照尺寸及正式归档服务待联调。

## 局域网和 iPad

建议让中间服务在固定 LAN IP 或经现场确认可解析的主机名上同源提供 Observer、批次 JSON 和图像。测试可运行 `CAPTURE_FIXTURE=1 npm run preview -- --host 0.0.0.0`，在同 Wi-Fi 设备上以服务电脑的 LAN IP 和 4173 端口打开页面，口袋的网络接收地址填 `/capture-fixture/processing`，再使用同一批的 `/capture-fixture/ready` 检查更新。测试照片是仓库已有苹果与叶子照片，通过真实 HTTP 下载，与 T 键数据不同 ID。Fixture 仅在显式启用时提供。

跨源部署须对 JSON 和照片都允许 Observer 源的 CORS。本适配器不发送跨源凭据且拒绝重定向。HTTPS Observer 应配合可信 HTTPS 的中间服务和图像，同源 LAN HTTP 演示避免依赖混合内容例外。标签内取消、断线后的手动重试、已保存照片刷新恢复均可用。离线用 T。真实 iPad 网络权限、接入方式、TLS 与上游字段对接为 **Device Pending**。

参见 [Fetch 标准](https://fetch.spec.whatwg.org/) 和 [Mixed Content 标准](https://www.w3.org/TR/mixed-content/)。

## V10.5 验收与修改清单

- `src/capture-adapter.mjs` 管理 HTTP 请求、批次校验、下载上限、图像解码与状态；`src/capture-assets.mjs` 是苹果、叶子、石头的审核子集。`src/capture-panel.jsx`、`src/observer-v10.jsx` 和 `dist/native.css` 接入 Collection 的面板与状态。
- `dist/observer-store.js` 合并并持久化网络批次，`dist/observer-bridge.js` 对网络采集限制提议到审核通过的演变 ID。Phaser 和地图未修改。HTML、版本号、React bundle 与 source map 已更新。
- `scripts/capture-fixture.mjs`、`scripts/preview.mjs` 提供显式启用的真实 HTTP 测试路径。`tests/capture-adapter.test.cjs` 增加网络和存储回归。
- 构建通过，V10 22/22、独立 V7 6/6。Chromium 以 1210×834 CSS px、DPR 2 验证两张原始照片通过本机 HTTP 入袋；中间状态 processing → failed → ready 保留图像；重放不增长，取消和离线失败不写入半批，恢复联网后重试及刷新恢复均通过。
- 两条独立浏览器回归均使用网络批次。苹果两阶段演变及苹果屋互动通过；叶子跨地形、岸边互动、回忆、三模式、Q/E 和同一 Canvas 通过。叶子原图经 base64 解码，与源文件字节一致。
- 局域网地址在当前测试环境不可达，验证回退到同源回环 HTTP。iPad Safari、真实 Explorer 与 AI 上游仍为 Device Pending。浏览器截图和日志位于外层工作区 `evidence/v10.5/`。

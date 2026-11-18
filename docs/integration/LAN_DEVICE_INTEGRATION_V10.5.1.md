# V10.5.1 Mac → Observer 局域网联调

## 诊断结论

已查验 V10.4 `018fac3` 与 V10.5 `41bad12` 均是当前功能分支祖先。默认预览只监听 `127.0.0.1`。本工程使用 Node HTTP 和 esbuild；没有 Vite 服务。V10.5.1 的 LAN 入口明确监听 IPv4 `0.0.0.0:4173`，启动时列举实际网卡地址。静态网页、批次和媒体同源；Capture Adapter 接受相对网络 URL，未把 localhost 写进浏览器请求。

测量时 Mac 的 `en0` 为 `100.78.181.162`，应用防火墙查询返回关闭。`lsof` 实测监听所有 IPv4 接口。直接访问网卡地址，网页、健康检查、批次列表、批次清单和媒体全部返回 200。经系统配置的本机 HTTP 代理访问同一地址，代理 TCP 可连接，网页请求未获得成功响应。同一 Mac 上的 Chrome 禁用代理后通过网卡地址打开网页并下载照片。证据定位到**本机代理访问路径**，未修改系统代理或防火墙。随后用户在第二台设备明确确认 iPad Safari 能打开启动页及直接访问叶子原图，证明本次局域网存在一条设备间可用路径。

分层排查：

1. 网页打不开，先核对 Wi-Fi 互访、正确的 IPv4、`lsof` 监听和 URL 端口。Mac 本机无代理测试可用 `curl --noproxy '*'`。浏览器若经代理，把 Mac 地址加入正常的局域网代理例外。
2. 网页正常，检查同源 `/api/capture/v1/health` 和 `/api/capture/v1/batches`。启动普通 preview 不能提供上传服务。批次未发 Dock 会显示 404。
3. API 正常，打开批次中的 `localFileRef` 检查 MIME 与响应；原图只有 Dock 成功后公开。服务不返回 Mac 绝对路径。
4. 图片正常但世界状态不同，各浏览器分别用本地存档。两台设备可从同一服务器接收相同批次，游戏进度、收藏缓存和已读取 revision 不会自动跨设备同步。同一设备换主机名、协议或端口也会进入新的浏览器源。

同源 HTTP 路径不依赖 CORS，也不需要串口、WebUSB 或相机权限。若未来从 HTTPS 页面连接，网页、批次和媒体应使用同源可信 HTTPS 或明确配置的 HTTPS 跨域服务。HTTPS 页面发起 HTTP fetch 会受到混合内容规则限制。见 [Fetch 标准](https://fetch.spec.whatwg.org/) 与 [Mixed Content 标准](https://www.w3.org/TR/mixed-content/)。

## 在 Mac 启动

在 `isle-live-observer-v10` 工程目录执行：

```sh
npm run build
mkdir -p .capture-data
chmod 700 .capture-data
test -s .capture-data/upload-token || (umask 077 && openssl rand -hex 24 > .capture-data/upload-token)
export CAPTURE_UPLOAD_TOKEN="$(cat .capture-data/upload-token)"
npm run capture:lan
```

在第二台设备打开启动日志里的实际网卡地址，例如 `http://100.78.181.162:4173/`。地址应以现场 Wi-Fi 为准。通过 Collection → Discovery Pocket → Explorer 网络接收，填写 Dock 返回的相对批次路径。当前服务已登记两张项目样张，批次路径为 `/api/capture/v1/batches/lan-check-01`。网络不可用时可在已打开的界面按 T。普通 `npm run preview` 仍仅提供静态预览。

LAN HTTP 为互相信任的展览网络运行方式。写请求须提供 Bearer 令牌。已 Dock 的批次及图片可由同一网络中能访问该服务的浏览器读取。令牌通过团队既有私密渠道配置给 Explorer，使用公开网络时应在前面增加可信 HTTPS 与访客访问控制。服务自身不暴露文件列表、令牌或本地路径。

## Explorer 请求

基础路径为 `/api/capture/v1`。Explorer 为每次实体采集生成一次稳定的全局唯一 captureId，例如 UUID，并复用同一 ID 重试。同一批的 batchId 和 sourceDeviceId 在上传、AI 更新和 Dock 间保持一致。下列示例读取工程内本地令牌，使用叶子样张模拟一条固件请求。

```sh
export OBSERVER_BASE="http://100.78.181.162:4173"
export CAPTURE_UPLOAD_TOKEN="$(cat .capture-data/upload-token)"

python3 - <<'PY' | curl --noproxy '*' --fail-with-body \
  -X PUT "$OBSERVER_BASE/api/capture/v1/captures/explorer-test-leaf-01" \
  -H "Authorization: Bearer $CAPTURE_UPLOAD_TOKEN" \
  -H 'Content-Type: application/json' --data-binary @-
import base64, json
from pathlib import Path
print(json.dumps({
    "batchId": "explorer-test-01", "sourceDeviceId": "explorer-test",
    "captureTimestamp": "2026-11-19T08:00:00+08:00",
    "objectLabel": "叶子", "imageContentType": "image/jpeg",
    "imageBase64": base64.b64encode(Path("dist/assets/sample-leaf.jpg").read_bytes()).decode()
}))
PY

curl --noproxy '*' --fail-with-body -X POST "$OBSERVER_BASE/api/capture/v1/dock" \
  -H "Authorization: Bearer $CAPTURE_UPLOAD_TOKEN" -H 'Content-Type: application/json' \
  --data '{"eventType":"EXPLORER_DOCKED","batchId":"explorer-test-01","sourceDeviceId":"explorer-test","captureIds":["explorer-test-leaf-01"]}'

curl --noproxy '*' --fail-with-body -X PATCH "$OBSERVER_BASE/api/capture/v1/captures/explorer-test-leaf-01" \
  -H "Authorization: Bearer $CAPTURE_UPLOAD_TOKEN" -H 'Content-Type: application/json' \
  --data '{"batchId":"explorer-test-01","sourceDeviceId":"explorer-test","revision":1,"status":"ready","objectCategory":"leaf"}'

curl --noproxy '*' --fail-with-body "$OBSERVER_BASE/api/capture/v1/batches"
```

- **PUT /captures/{captureId}** 首次成功返回 201，包含 captureId、batchId、mediaUrl。相同 ID、来源、批次和图片字节重放返回 200 与 `duplicate:true`。冲突返回 409。默认 processing / revision 0；可带现有 Capture Protocol 字段。
- **POST /dock** 所有上传都已保存后，传事件类型、批次 ID、设备 ID 和完整有序 captureIds。201 返回相对 batchUrl。相同 Dock 请求重放为 200。缺件或不同名单返回 409。
- **GET /batches** 列出已 Dock、未删除的批次。**GET /batches/{batchId}** 返回 V1 批次快照。每台 Observer 自行去重和拉取；列表不随某台 Observer 读取而消失。**GET /media/{captureId}** 提供已登记且已 Dock 的原图。
- **PATCH /captures/{captureId}** 由中间服务异步更新元数据，不需要重发照片。revision 必须递增；相同或旧 revision 不变更。状态进入 ready 后，Observer 刷新批次可匹配本地 Sprite。
- 错误体为 `{"errorCode":"…"}`。401 检查令牌，409 核对 ID 和完整名单，413 缩小图像或拆批，415/422 修复编码和字段。网络中断或 5xx 可以退避后重试原请求。完整确认前 Explorer 应保留本地文件。

## 文件存储和清理

默认数据目录为 `.capture-data/`，也可设置 `CAPTURE_DATA_DIR`。每个 captureId 通过 SHA-256 映射到 `captures/<hash>.json`，其中原图以原始字节的 base64 保存，与元数据作为一个记录提交。批次映射和删除标记存于 `batches/<hash>.json`。原图 URL 只按登记的 captureId 查找并读取相应字节。没有按用户提供的文件系统路径读取的接口。

上传接受 JPEG、PNG，单图 ≤2.5 MiB，边长 ≤4096，面积 ≤1200 万像素，合计每批 ≤3 MiB、最多 8 件。服务验证编码、图像标头和尺寸，浏览器另做完整解码。中断上传不会发布不完整记录；文件用同目录临时文件加 rename 提交，正常失败清理临时文件。异常退出留下的 `.tmp` 在重启时忽略，可停服后清理。有效记录及 Dock 状态会在重启后从磁盘重新读取。

使用带令牌的 `DELETE /api/capture/v1/batches/{batchId}` 撤回一整个批次并删除服务端图像，只保留批次和采集 ID 的删除标记，旧客户端不可重新打开该批次或复用已删除 ID。浏览器已下载的照片与存档仍在设备本地，展览结束可在备份后从 Safari 的网站数据清理中移除。备份时停服并复制 `captures/` 和 `batches/`，恢复到相同数据目录，再用授权令牌启动。令牌单独保管。

## iPad 清单

- **Simulator Passed**（Mac Chromium 触摸模拟）| 1210×834 CSS px、DPR 2、横屏界面、CRT、照片加载、触控投放、三模式、Q/E、刷新与网络断线后重试。
- **Host Passed** | 网卡 IPv4 直连网页、API、PNG/JPEG；上传、Dock、同 ID 重放、异步更新、媒体字节一致、落盘重开与删除测试。
- **Device Passed** | 用户在 iPad Safari 确认通过 Mac 网卡地址打开启动页，并查看同源媒体接口提供的叶子原图。
- **Device Pending** | Safari 实际 CSS viewport/DPR、横屏安全区、CRT 和字体回退、Discovery Pocket 导入、触控落点、三模式、实体按键与旋钮、刷新与断线恢复、加入主屏幕后启动与存档保留。真实 Explorer 固件及 AI 服务尚未接入。
- 浏览器运行记录与截图位于外层工作区 `evidence/v10.5.1/`。本机使用网卡地址的回归属于 Host/Simulator，不等同第二设备验收。

## 文件清单

`scripts/capture-lan.mjs` 实现上传、AI 更新、Dock、媒体、批次和清理。 `scripts/lan.mjs`、`scripts/server.mjs`、`package.json` 和 `package-lock.json` 增加 LAN 启动命令。 `.gitignore` 排除本地照片和令牌数据。 `tests/capture-lan.test.cjs` 覆盖路由回归。HTML、React 界面版本号及构建产物升级至 10.5.1。

构建、V10 23/23 和 V7 6/6 测试通过。LAN 回归使用两张经上传接口落盘的项目样张，模拟 AI 通过 PATCH 更新状态。设备端页面和媒体由 iPad Safari 用户确认；完整游戏回归由 Chromium 模拟完成。

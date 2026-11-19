# V10.9 岛屿布置簿

World 的「岛屿布置簿」用现有 CRT 弹层呈现，不增加主模式。输入自定义名称，或留空使用默认名称。每次保存独立一页，最多 12 页；历史页可选择预览，删除前需明确确认。当前布局标签标记和实时位置、形态、扩张及天空一致的最新一页。保存时间使用 ISO 8601，界面按本地时间显示。

## 数据结构

`layouts[]` 添加到现有 Observer Store，本地持久化沿用既有存档键。旧存档默认为空列表。

```json
{
  "layoutId": "生成的布局 ID",
  "schemaVersion": 1,
  "timestamp": "2026-11-19T04:00:00.000Z",
  "islandId": "story",
  "name": "初访 · 苹果屋",
  "expanded": false,
  "skyStateId": "stardust-clear",
  "thumbnail": "data:image/webp;base64,…",
  "objects": [{
    "objectInstanceId": "WorldInstance.collectionId",
    "objectFormId": "apple-house",
    "position": {"x":20,"y":9},
    "orientation": 0,
    "footprint": [{"x":20,"y":9},{"x":19,"y":9},{"x":21,"y":9},{"x":20,"y":8},{"x":19,"y":8},{"x":21,"y":8}],
    "floating": false
  }]
}
```

运行世界负责产生布局数据；Store 校验当前岛屿、有效实例 ID、唯一性、实时形态、坐标、扩张和天空。历史快照记录保存时仍有效的实例，不重建 Collection，也不复制照片、事件、居民路线或世界存档。朝向保留为 0，因为当前物件没有运行时旋转机制。缩略图由现在的真实地形和物件贴图独立重绘，大小 344×216，包含天气底图，省去 CRT、照片、气泡和临时预览。Safari 无 WebP 编码时可保存 PNG，单图编码后上限 200,000 字符。

## 样包兼容与恢复评估

已检查 Work `references/candidates/living-world-kit/integration/LayoutBook.jsx` 和相邻 CSS。复用标题、缩略图、时间、当前/历史状态的设计结构和明确确认语义。接入使用 Observer 自带的 TransmissionOverlay、PixelButton、Fusion Pixel 和焦点管理。复用既有弹层而不挂载样包的独立 CSS/恢复回调。文本输入保持短键保护。

恢复功能本轮不开放。历史快照只能预览。未来恢复先基于当前可用实例和形态生成完整候选布局，遇到实例已收回、原形态失效、占地冲突、缺少靠岸入口或居民无可达通道，给出逐项原因。通过整图校验并显式确认后，世界与相关条目应在一个可回滚存储事务中更新。恢复不得删除真实 Memories，也不得重复使用旧 captureId 造出新的世界实例。在开放恢复前须测试部分失败、已迁移叶子船、回滚和刷新。

## iPad 真机待验

World 二级入口、名字输入与软键盘、安全区、快照列表滚动、缩略图清晰度、确认删除、默认名、窗灯开关、刷新恢复及模式/旋钮切换。模拟视口与设备实测结论分别记录。

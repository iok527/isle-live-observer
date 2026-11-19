# V10.8 Resident Interaction Registry

`dist/behavior-scheduler.js` 声明物件允许的互动能力、居民偏好顺序和原有分工权重。World 先验证占地、岸边/正门互动点、BFS 路径和目标格预订。居民抵达后才选择及触发动作。陌生类型默认 Inspect。

## 居民 × 物件测试矩阵

- **苹果**｜探探 Inspect → Curious；造造 Inspect → Think，用户确认后可 Build；慢慢 Inspect。
- **树叶**｜探探 Inspect → Curious；造造 Inspect → Think；慢慢 Inspect。漂浮树叶沿用现有岸边规则。
- **石头**｜探探 Inspect → Curious；造造 Inspect → Think；慢慢 Inspect。
- **巨型苹果**｜探探 Inspect → Curious；造造 Inspect → Think；慢慢 Inspect。苹果屋的原地演变仍由用户确认。
- **苹果屋**｜探探 Inspect；造造 Inspect → Think；慢慢 Inspect → Rest。在门外到访，不进入碰撞体。
- **叶子船**｜探探 Inspect；造造 Inspect → Think；慢慢 Inspect → Use。到岸边观察，不进入水域。

18 组均由自动化测试实际运行 World 到抵达，检查合法互动格与动作名。Build 单独走真实浏览器确认链路。用正式 Sprites 保留行走和各向基本外形。三位居民的 Inspect 使用通过 SHA-256 核验的 48×48 四向技术帧；造造 Think / Build 沿用 V10.6。脚点仍为 (24,40)，不移动 actor、不拉伸身体。朝向按居民与互动对象的相对位置；动作结束恢复普通方向帧。Curious 使用朝向、意图标记和焦点。Rest / Use 使用朝向、对象提示线、可见标题和既有气泡。休息与使用均是可辨认的简化反馈，完整坐姿、工具和登船动画待正式美术。

Memories 的发现和互动来自实际抵达；单纯规划路线仅触发临时 HUD。事件标题写明实际动作，沿用实例 ID、来源、形态以及原有去重键，重复探索同一形态不刷出相同历史。原有存档可继续读取。

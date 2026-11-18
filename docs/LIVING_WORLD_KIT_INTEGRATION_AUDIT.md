# Living World Kit 01 兼容性与接入

原始 `isle-living-world-kit-01.zip` 已解包到 `references/candidates/living-world-kit/`，源包 93 条 SHA-256 记录全部通过。原始 ZIP 与候选目录留在本地。包内基线是早期 V10，正式地图和物件配置继续使用当前工作版本。对应权利记录见包内 `docs/SOURCE-AND-RIGHTS.md`，既有源资产的公开再分发许可未由样包改变。

- **居民身体帧。** 三人各 Inspect、Think、Build，192×192 RGBA，α 0–255。四方向按 front/back/left/right 行排列，每行四个 48×48 帧。源脚点 (24,40)，等比接入时按源帧绘制，帧内身体约 17 px。Inspect 180 ms/帧、约 0.72 s；Think 220 ms/帧、约 0.88 s 每轮；Build 120 ms/帧、约 0.48 s。动作没有独立 footprint，角色使用当前游戏 resident 格位。Think 身体帧刻意静止，依靠意图层区分。
- **意图与演变 FX。** 三种 192×48 意图条和身体动作同拍，不含手臂或工具。四种演变 FX 为 512×64 透明片，8 帧 × 100 ms，脚点 (32,44)，无碰撞。已审查苹果长大、苹果屋、叶子船和下水；本轮正式加载仅 apple-growth。
- **天气。** Rain 64×64、Mist 128×64、Starlight 64×64，均 8 帧可平铺，周期分别 .64 / 1.76 / 1.44 秒。实测有透明像素，alpha 峰值分别 128 / 29 / 245。Sunset 16×64 RGBA，alpha 峰值 33。可作为下一阶段的独立视口装饰层，地图、水域和通行数据仍归世界逻辑。
- **Phaser 示例。** 帧尺寸、脚点和播放时间可直接复用，示例的独立 actor 创建与演变 reservation 不用于当前事务。正式场景把动作帧放在原 actor 容器，复用原本终态校验与持久化。
- **Island Layout Book。** 提供 React JSX 加 CSS，props 为 layouts/currentId/onSave/onRestore/onClose。下一阶段从 World 临时菜单接入。接入前需对快照 schema、脱离 HUD 的缩略图、还原原子性、焦点与 Escape 做正式设计。当前代码尚未挂载。

## 接入清单

已使用 `zaozhao-{inspect,think,build}.png`、`intent-{inspect,think,build}.png` 与 `apple-growth.png`。保留正式静帧、原地图和对象素材。其余居民动作、苹果屋及叶子船 FX、天气、布局簿仍是候选，不进入本轮运行依赖。

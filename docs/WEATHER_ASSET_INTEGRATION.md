# Work Surreal Weather v2 资源接入

检查本地 `isle-surreal-weather-v2.zip` 的 PNG、manifest 与 Phaser 参考实现。导入的 15 个 manifest 图层引用逐项比对 SHA-256 通过。星尘片由两套天气共享。原 ZIP 保留在本地。未迁入预览合成图、参考 Story Land 地图或截图。

- 三套 Sky Base 均为 688×432 RGBA 且 alpha 恒 255。每套天体和云均为单独 688×432 RGBA，alpha 0–255。
- 三套环境光均为 16×64，alpha 区间分别为星尘晴 4–11、星雨 15–36、宇宙晚霞 17–40。
- Rain 和 Starlight 为 512×64、8 个 64×64 帧；星雨使用 80 ms/帧，星尘按对应 preset 时间参数播放。Mist 1024×64、8 个 128×64 帧；Warm Glow 16×64。Rain 与 Starlight 正式播放，Mist 与 Warm Glow 作为兼容保留资源，当前三套 preset 自带独立照明。
- 参考 renderer 的最近邻采样、相机补偿、视差、切换和清理逻辑已适配。Normal 保留量产画面比例，Overview 扩展取景；实际安装尺寸与工作样包对比图的 zoom 不绑定。
- 工程加载 `dist/weather-config.js` 投影后的图层配置；`dist/living-sky.js` 是改造后的 Phaser renderer，`dist/assets/weather/` 为独立资源。其余变更限于现有场景/相机、Store、React 天气面板、样式、构建产物及回归。原岛屿、居民动作、苹果和叶子船规则仍由原逻辑管理。

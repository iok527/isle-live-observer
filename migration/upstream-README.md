# isle live · Observer V10.0

React + native SVG/CSS reconstruction of the confirmed Observer references, integrated into the existing V7 Phaser project.

- Run `npm run build`, then serve `dist/` as a static site.
- Run `npm test` for game, store, keyboard and native-asset policy checks.
- UI: `src/observer-v10.jsx` and `src/native-components.jsx`.
- Theme: `dist/native-tokens.css` and `dist/native.css`.
- Design base: 1662×930; actual game: original 688×432 Phaser Canvas, fitted without stretching.
- 1/2/3: World/Collection/Memories. Q/E: island context. T: simulated transfer. Escape: close temporary operation.
- Right corner menu: CRT Off/Low/Medium, CRT Debug, Keyboard Debug, original game test controls.

Existing game algorithms and data store are unchanged. Saved baseline: `661686b0b907e84c03a24e51938ef3a37598363a` (Site version 3). See `docs/V10-HANDOFF.md` for component inventory, regression results, visual differences and remaining work.

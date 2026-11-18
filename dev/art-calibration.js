(() => {
  'use strict';

  // A fresh in-memory Store keeps this route independent of the Observer save.
  const observer = globalThis.IsleObserver;
  observer.store = observer.createStore();

  const candidates = [
    {
      id: 'leaf-boat', sprite: 'leaf-boat', name: '叶子船',
      drawSize: [32, 29], anchor: [.5, 1], allowWater: true,
      footprint: [[0, 0]], interactionPoints: [[0, 1], [-1, 0], [1, 0], [0, -1]],
      reactions: ['帆在水面上移动。'],
    },
    {
      id: 'stone-rest', sprite: 'stone-rest', name: '石头休憩点',
      drawSize: [53, 44], anchor: [.5, 1],
      footprint: [[-1, 0], [0, 0], [1, 0], [0, -1]],
      interactionPoints: [[0, 1], [-1, 1], [1, 1]],
      reactions: ['这里可以休息一下。'],
    },
  ];

  const placements = [
    ['apple-house', 23, 12], ['stone-rest', 23, 17], ['apple-large', 24, 14],
    ['apple', 19, 12], ['leaf', 19, 16], ['stone', 26, 17],
    ['leaf-boat', 9, 12], ['cat', 16, 19],
  ];

  const layers = [
    ['grid', '16×16 网格'], ['bounds', 'Sprite 边界 · 青'],
    ['anchor', '锚点 · 白'], ['footprint', '占地 · 紫'],
    ['collision', '阻挡 · 粉'], ['interaction', '可达互动点 · 黄'],
  ];

  function seed(world) {
    for (const [type, x, y] of placements) {
      const result = world.place({x, y}, type);
      if (result.error) throw new Error(`Calibration placement ${type} (${x},${y}): ${result.error}`);
    }
  }

  function attach(scene, tileSize) {
    const panel = document.createElement('details');
    panel.className = 'art-calibration-panel';
    const summary = document.createElement('summary');
    summary.textContent = 'Art Calibration';
    panel.append(summary);

    function checkbox(label) {
      const row = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = true;
      row.append(input, label);
      panel.append(row);
      return input;
    }

    const enabled = checkbox('显示校准覆盖层');
    const toggles = Object.fromEntries(layers.map(([id, label]) => [id, checkbox(label)]));
    enabled.checked = false;
    const placement = checkbox('检查放置规则');
    placement.checked = false;
    const select = document.createElement('select');
    select.setAttribute('aria-label', '放置测试物件');
    for (const type of scene.world.types.values()) {
      select.add(new Option(type.name, type.id));
    }
    panel.append(select);

    const rules = {
      valid: ['可放置', 0x8de9b1],
      occupied: ['已占用', 0xf984ad],
      resident: ['居民经过', 0xffb36c],
      terrain: ['地形不允许', 0x8190d8],
      footprint: ['占地不足', 0xe5af56],
      route: ['路径受阻', 0xed766c],
      entrance: ['入口受阻', 0xcf88e8],
      outside: ['岛屿边界外', 0xa3a3b7],
    };
    const legend = document.createElement('ul');
    legend.className = 'placement-legend';
    for (const [label, color] of Object.values(rules)) {
      const item = document.createElement('li');
      item.style.setProperty('--swatch', '#'+color.toString(16));
      item.textContent = label;
      legend.append(item);
    }
    const result = document.createElement('output');
    result.className = 'placement-result';
    result.setAttribute('aria-live', 'polite');
    result.textContent = '点击格子查看当前物件的判定。';
    panel.append(legend, result);
    let selected;
    scene.placementProbe = at => {
      if (!placement.checked) return false;
      selected = at;
      const check = scene.world.checkPlacement(at, select.value);
      result.textContent = `(${at.x}, ${at.y}) · ${rules[check.code][0]}${check.error ? ' — '+check.error : ''}`;
      return true;
    };
    select.addEventListener('change', () => {
      if (selected && placement.checked) scene.placementProbe(selected);
    });

    const style = document.createElement('style');
    style.textContent = `
      .art-calibration-panel { display:none; position:fixed; z-index:200; top:12%; right:6%;
        background:#292040f5; border:2px solid #aaa2e9; color:#fff0e8; padding:10px 14px;
        font:15px/1.5 system-ui,sans-serif; border-radius:4px; }
      body[data-mode="world"]:has(.game-surface[aria-hidden="false"]):not([data-import="true"]) .art-calibration-panel { display:block; }
      .art-calibration-panel summary { cursor:pointer; }
      .art-calibration-panel { max-width:260px; max-height:75vh; overflow:auto; }
      .art-calibration-panel select { width:100%; }
      .placement-legend { display:grid; grid-template-columns:1fr 1fr; gap:4px 10px; padding:0; list-style:none; }
      .placement-legend li::before { content:''; display:inline-block; width:10px; height:10px; margin-right:5px; background:var(--swatch); }
      .placement-result { display:block; min-height:3em; }
      .art-calibration-panel label { display:flex; align-items:center; min-height:32px; gap:6px; }
    `;
    document.head.append(style);
    document.body.append(panel);

    const heatmap = scene.add.graphics().setDepth(835).setVisible(false);
    let lastScan = -Infinity;
    let lastSignature = '';
    let lastWorld;
    const grid = scene.add.graphics().setDepth(840).setVisible(false);
    const markers = scene.add.graphics().setDepth(850).setVisible(false);
    const cellCenter = coordinate => (coordinate + .5) * tileSize;
    let drawnRevision = -1;

    scene.events.on('postupdate', time => {
      heatmap.setVisible(placement.checked);
      const {world} = scene;
      if (placement.checked && (time - lastScan >= 160 || world !== lastWorld)) {
        const residents = world.residents.map(p => [p.at.x,p.at.y,p.next?.x,p.next?.y].join(',')).join(';');
        const signature = [select.value, world.revision, residents].join(':');
        if (signature !== lastSignature || world !== lastWorld) {
          lastWorld = world;
          lastSignature = signature;
          heatmap.clear();
          const columns = scene.scale.gameSize.width / tileSize;
          const rows = scene.scale.gameSize.height / tileSize;
          for (let y = 0; y < rows; y++) {
            for (let x = 0; x < columns; x++) {
              const check = world.checkPlacement({x,y}, select.value);
              const color = rules[check.code][1];
              heatmap.fillStyle(color, check.code === 'outside' ? .09 : .42);
              heatmap.fillRect(x * tileSize + 1, y * tileSize + 1, tileSize - 2, tileSize - 2);
            }
          }
        }
        lastScan = time;
      }

      grid.setVisible(enabled.checked && toggles.grid.checked);
      markers.setVisible(enabled.checked);
      if (!enabled.checked) return;
      if (grid.visible && drawnRevision !== world.revision) {
        drawnRevision = world.revision;
        grid.clear().lineStyle(1, 0xe9d5fc, .42);
        for (const {x, y} of world.cells.values()) {
          grid.strokeRect(x * tileSize, y * tileSize, tileSize, tileSize);
        }
      }

      markers.clear();
      const blocked = world.blocked();
      if (toggles.collision.checked) {
        markers.fillStyle(0xff718c, .28);
        for (const cell of world.cells.values()) {
          if (!world.canWalk(cell, blocked)) {
            markers.fillRect(cell.x * tileSize + 2, cell.y * tileSize + 2, tileSize - 4, tileSize - 4);
          }
        }
      }

      for (const object of world.objects) {
        if (toggles.footprint.checked) {
          markers.lineStyle(1, 0xd6a0ff, 1);
          for (const {x, y} of world.cellsOf(object)) {
            markers.strokeRect(x * tileSize + 1, y * tileSize + 1, tileSize - 2, tileSize - 2);
          }
        }
        if (toggles.interaction.checked) {
          markers.fillStyle(0xffe18a, 1);
          for (const cell of world.doors(object)) {
            if (world.canWalk(cell, blocked)) markers.fillCircle(cellCenter(cell.x), cellCenter(cell.y), 2);
          }
        }
      }

      const drawSprite = (image, x, y) => {
        if (toggles.bounds.checked) {
          const bounds = image.getBounds();
          markers.lineStyle(1, 0x8af6e1, .9).strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
        }
        if (toggles.anchor.checked) {
          markers.lineStyle(1, 0xfff0e8, 1);
          markers.lineBetween(x - 3, y, x + 3, y);
          markers.lineBetween(x, y - 3, x, y + 3);
        }
      };
      for (const image of scene.entitySprites.values()) drawSprite(image, image.x, image.y);
      for (const actor of scene.personSprites.values()) drawSprite(actor.list[1], actor.x, actor.y);
    });
  }

  globalThis.IsleArtCalibration = {candidates, seed, attach};
})();

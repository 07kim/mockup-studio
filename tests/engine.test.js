// engine の純関数テスト（§12）: 色導出 / fitRect
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lum, mixc, hexToRgb, rgbToHex, derivePalette, fitRect } from '../lib/engine.js';

test('hexToRgb / rgbToHex 往復', () => {
  assert.deepEqual(hexToRgb('#ff0000'), { r: 255, g: 0, b: 0 });
  assert.deepEqual(hexToRgb('#0f0'), { r: 0, g: 255, b: 0 });
  assert.equal(rgbToHex({ r: 255, g: 128, b: 0 }), '#ff8000');
});

test('lum: 白 > 黒', () => {
  assert.ok(lum('#ffffff') > 0.9);
  assert.ok(lum('#000000') < 0.01);
  assert.ok(lum('#ffffff') > lum('#808080'));
});

test('mixc: 正で明るく / 負で暗く', () => {
  assert.equal(mixc('#808080', 1), '#ffffff'); // 完全に白へ
  assert.equal(mixc('#808080', -1), '#000000'); // 完全に黒へ
  assert.ok(lum(mixc('#404040', 0.3)) > lum('#404040'));
});

test('derivePalette: 暗い色は light=false、notch は常に黒', () => {
  const dark = derivePalette('#15171c');
  assert.equal(dark.isLight, false);
  assert.equal(dark.notch, '#000000');
  const light = derivePalette('#e3e4e6');
  assert.equal(light.isLight, true);
});

test('fitRect cover: box を完全に覆う（dest=box、source をクロップ）', () => {
  const r = fitRect(2000, 1000, 100, 100, 'cover'); // 横長画像を正方形へ
  assert.equal(r.dx, 0);
  assert.equal(r.dy, 0);
  assert.equal(r.dw, 100);
  assert.equal(r.dh, 100);
  assert.ok(r.sw < 2000); // 横がクロップされる
  assert.equal(r.sh, 1000);
});

test('fitRect contain: box 内に収まり letterbox', () => {
  const r = fitRect(2000, 1000, 100, 100, 'contain');
  assert.equal(r.dw, 100); // 横がフィット基準
  assert.equal(r.dh, 50);
  assert.equal(r.dy, 25); // 上下に余白
});

test('fitRect stretch: source 全体を box 全体へ', () => {
  const r = fitRect(2000, 1000, 100, 100, 'stretch');
  assert.deepEqual([r.sx, r.sy, r.sw, r.sh], [0, 0, 2000, 1000]);
  assert.deepEqual([r.dx, r.dy, r.dw, r.dh], [0, 0, 100, 100]);
});

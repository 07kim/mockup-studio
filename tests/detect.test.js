// 自動デバイス判定テスト（§3.2 境界値）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectDevice } from '../lib/detect.js';

test('解像度マッチ: iPhone 1170×2532 → iphone-island / portrait', () => {
  const r = detectDevice(1170, 2532);
  assert.equal(r.device, 'iphone-island');
  assert.equal(r.orientation, 'portrait');
  assert.equal(r.matched, true);
});

test('解像度マッチ: 回転（landscape）も同一モデル', () => {
  const r = detectDevice(2532, 1170);
  assert.equal(r.device, 'iphone-island');
  assert.equal(r.orientation, 'landscape');
  assert.equal(r.matched, true);
});

test('解像度マッチ: iPhone SE 750×1334', () => {
  assert.equal(detectDevice(750, 1334).device, 'iphone-se');
});

test('解像度マッチ: iPad 2048×2732', () => {
  assert.equal(detectDevice(2048, 2732).device, 'ipad');
});

test('±3% 許容内でマッチ', () => {
  const r = detectDevice(1180, 2540); // 1170×2532 に近い
  assert.equal(r.matched, true);
  assert.equal(r.device, 'iphone-island');
});

test('比率ヒューリスティック: 16:9 横長 → browser', () => {
  const r = detectDevice(1600, 900); // aspect 1.78、解像度表に無い
  assert.equal(r.matched, false);
  assert.equal(r.device, 'browser');
});

test('比率ヒューリスティック: 縦長 phone (aspect<=0.7)', () => {
  const r = detectDevice(500, 1100); // aspect 0.45
  assert.equal(r.device, 'iphone-island');
  assert.equal(r.orientation, 'portrait');
});

test('比率ヒューリスティック: 3:4 縦長 → tablet', () => {
  const r = detectDevice(600, 800); // aspect 0.75
  assert.equal(r.device, 'ipad');
});

test('比率ヒューリスティック: 横長 aspect>=1.90 → phone 横', () => {
  const r = detectDevice(2200, 1000); // aspect 2.2
  assert.equal(r.device, 'iphone-island');
  assert.equal(r.orientation, 'landscape');
});

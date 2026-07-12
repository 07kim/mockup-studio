// 検証・警告テスト（§3.7）: 最頻値・少数派判定
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { batchMismatchWarnings } from '../lib/warnings.js';

const settings = { scale: 2, fit: 'cover' };

function items(devices) {
  return devices.map((d, i) => ({ id: i + 1, kind: 'image', name: `i${i}`, device: d, orientation: 'portrait' }));
}

test('3件未満は警告なし', () => {
  assert.equal(batchMismatchWarnings(items(['ipad', 'iphone-island']), settings).length, 0);
});

test('多数派 iPhone、1件だけ iPad → 警告1件', () => {
  const its = items(['iphone-island', 'iphone-island', 'iphone-island', 'iphone-island', 'iphone-island', 'iphone-island', 'iphone-island', 'ipad']);
  const w = batchMismatchWarnings(its, settings);
  assert.equal(w.length, 1);
  assert.equal(w[0].majority, 'iphone-island');
  assert.ok(w[0].label.includes('iPad'));
});

test('全て同一なら警告なし', () => {
  assert.equal(batchMismatchWarnings(items(['ipad', 'ipad', 'ipad', 'ipad']), settings).length, 0);
});

test('少数派が20%超なら対象外', () => {
  // 5件中2件が別 = 40% は少数派しきい値(20%)超 → 警告なし
  const its = items(['iphone-island', 'iphone-island', 'iphone-island', 'ipad', 'ipad']);
  assert.equal(batchMismatchWarnings(its, settings).length, 0);
});

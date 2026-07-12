// ファイル名生成テスト（§3.6.1）: トークン展開 / サニタイズ / 連番衝突
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitize, expandTemplate, dedupeNames, withExt } from '../lib/filename.js';

const settings = { scale: 2, format: 'png', frameColor: '#15171c', indexPad: 2 };

test('sanitize: 拡張子除去・禁止文字→ハイフン・60字上限', () => {
  assert.equal(sanitize('My Shot.png'), 'My-Shot');
  assert.equal(sanitize('a/b\\c#d:e%f g'), 'a-b-c-d-e-f-g');
  assert.equal(sanitize(''), 'mockup');
  assert.equal(sanitize('   '), 'mockup');
  assert.equal(sanitize('x'.repeat(80)).length, 60);
});

test('expandTemplate: 既定テンプレ portrait', () => {
  const item = { name: 'home', device: 'iphone-island', orientation: 'portrait' };
  const out = expandTemplate('{name}_{device}{_orient}@{scale}x', { item, settings, index: 1, date: '20260711', time: '1200' });
  assert.equal(out, 'home_iphone-island@2x');
});

test('expandTemplate: landscape は _yoko が付く', () => {
  const item = { name: 'home', device: 'iphone-island', orientation: 'landscape' };
  const out = expandTemplate('{name}_{device}{_orient}@{scale}x', { item, settings, index: 1 });
  assert.equal(out, 'home_iphone-island_yoko@2x');
});

test('expandTemplate: {index:3} 桁数指定', () => {
  const item = { name: 'a', device: 'ipad', orientation: 'portrait' };
  const out = expandTemplate('{name}-{index:3}', { item, settings, index: 5 });
  assert.equal(out, 'a-005');
});

test('expandTemplate: {date}{time}{color}', () => {
  const item = { name: 'a', device: 'ipad', orientation: 'portrait' };
  const out = expandTemplate('{name}_{date}_{time}_{color}', { item, settings, index: 1, date: '20260711', time: '0930' });
  assert.equal(out, 'a_20260711_0930_15171c');
});

test('dedupeNames: 重複に -2,-3', () => {
  assert.deepEqual(dedupeNames(['a', 'a', 'b', 'a']), ['a', 'a-2', 'b', 'a-3']);
});

test('withExt: 形式ごとの拡張子', () => {
  assert.equal(withExt('x', 'png'), 'x.png');
  assert.equal(withExt('x', 'jpg'), 'x.jpg');
  assert.equal(withExt('x', 'svg'), 'x.svg');
});

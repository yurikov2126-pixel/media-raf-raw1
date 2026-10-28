import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyMchsObservation as detect } from '../src/lib/mchsClassification.js';

test('four MCHS observation types', () => {
  assert.equal(detect('РСЧС, Тульская область',
    'ОПАСНОСТЬ АТАКИ БПЛА на территории Тульской области!'), 'UAV_DANGER');
  assert.equal(detect('РСЧС', 'ОТБОЙ опасности атаки БПЛА!'), 'UAV_ALL_CLEAR');
  assert.equal(detect('РСЧС', 'РАКЕТНАЯ ОПАСНОСТЬ!'), 'MISSILE_DANGER');
  assert.equal(detect('РСЧС', 'ОТБОЙ РАКЕТНОЙ ОПАСНОСТИ!'), 'MISSILE_ALL_CLEAR');
});
test('unrecognised and ambiguous notices are not actionable', () => {
  assert.equal(detect('Новости МЧС', 'Профилактика пожаров'), 'UNCLASSIFIED');
  assert.equal(detect('РСЧС', 'Опасность атаки БПЛА и ракетная опасность'), 'UNCLASSIFIED');
  assert.equal(detect('РСЧС', 'Отбой по всему региону'), 'UNCLASSIFIED');
});
